'use strict';

(() => {
  const STORAGE_KEY = 'nexusStateV2';
  const STORAGE_VERSION = 3;
  const HISTORY_SEED_VERSION = 1;

  const DEFAULT_STATE = {
    version: STORAGE_VERSION,
    loggedIn: false,
    firstRun: false,

    user: {
      name: 'Trader Account',
      email: 'demo@nexus.local',
      verified: true,
      inviteCode: 'NEXUS-2026',
    },

    balance: 26450,
    availableBalance: 26450,
    lockedBalance: 0,

    startingCapital: 2000,
    cumulativeProfit: 47650,
    totalWithdrawals: 23200,

    selectedPlan: 'daily',

    activeTrade: null,

    tradeHistory: [],

    transactions: [],

    communityPosts: [],

    notifications: 2,

    tourSeen: true,
    tourStep: 0,

    historySeedVersion:
      HISTORY_SEED_VERSION,

    settings: {
      notifications: true,
      theme: 'dark',
    },
  };

  const PROFIT_TOTAL = 47650;
  const WITHDRAWAL_TOTAL = 23200;
  const STARTING_CAPITAL = 2000;

  /*
   * Exactly 73 completed trade profits.
   * Total = $47,650.00
   */
  const TRADE_PROFITS = [
    436, 576, 713, 850, 557, 694, 831, 538, 675, 812,
    519, 656, 793, 500, 637, 774, 481, 618, 755, 462,
    599, 736, 443, 580, 717, 854, 561, 698, 835, 542,
    679, 816, 523, 660, 797, 504, 641, 778, 485, 622,
    759, 466, 603, 740, 447, 584, 721, 858, 565, 702,
    839, 546, 683, 820, 527, 664, 801, 508, 645, 782,
    489, 626, 763, 470, 607, 744, 451, 588, 725, 862,
    569, 706, 843
  ];

  /*
   * Exactly 10 completed withdrawals.
   * Total = $23,200.00
   */
  const WITHDRAWALS = [
    2000,
    2400,
    2600,
    2700,
    2800,
    2500,
    2700,
    2300,
    1700,
    1500,
  ];

  const fmtNumber = (value) => {
    const number = Number(value);

    return Number.isFinite(number)
      ? Number(number.toFixed(2))
      : 0;
  };

  const clone = (value) =>
    JSON.parse(JSON.stringify(value));

  function safeParse(raw) {
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch (error) {
      console.warn(
        'NEXUS storage parse error:',
        error
      );

      return null;
    }
  }

  function mergeState(base, incoming) {
    const source =
      incoming &&
      typeof incoming === 'object'
        ? incoming
        : {};

    return {
      ...clone(base),
      ...source,

      user: {
        ...clone(base.user),
        ...(source.user || {}),
      },

      settings: {
        ...clone(base.settings),
        ...(source.settings || {}),
      },

      tradeHistory:
        Array.isArray(
          source.tradeHistory
        )
          ? source.tradeHistory
          : [],

      transactions:
        Array.isArray(
          source.transactions
        )
          ? source.transactions
          : [],

      communityPosts:
        Array.isArray(
          source.communityPosts
        )
          ? source.communityPosts
          : [],
    };
  }

  function totalsAreCorrect(state) {
    const tradeProfitTotal =
      (state.tradeHistory || [])
        .filter(
          (trade) =>
            trade?.status === 'completed'
        )
        .reduce(
          (sum, trade) =>
            sum +
            Number(
              trade.profit || 0
            ),
          0
        );

    const withdrawalTotal =
      (state.transactions || [])
        .filter(
          (tx) =>
            tx?.type === 'withdrawal'
        )
        .reduce(
          (sum, tx) =>
            sum +
            Number(
              tx.amount || 0
            ),
          0
        );

    const completedTrades =
      Number(
        (
          state.tradeHistory || []
        ).filter(
          (trade) =>
            trade?.status ===
            'completed'
        ).length
      );

    return (
      Math.abs(
        tradeProfitTotal -
          PROFIT_TOTAL
      ) < 0.01 &&
      Math.abs(
        withdrawalTotal -
          WITHDRAWAL_TOTAL
      ) < 0.01 &&
      completedTrades === 73
    );
  }

  function addDays(
    timestamp,
    days
  ) {
    return (
      timestamp +
      days *
        86_400_000
    );
  }

  function makeTradeHistory(
    now
  ) {
    const history = [];

    /*
     * Spread the 73 historical trades
     * across roughly 11 weeks.
     */
    const totalDays = 77;

    TRADE_PROFITS.forEach(
      (profit, index) => {
        const completedAt =
          addDays(
            now -
              totalDays *
                86_400_000,

            (index + 1) *
              (
                totalDays /
                TRADE_PROFITS.length
              )
          );

        const planId =
          index % 4 === 0
            ? 'daily'
            : index % 5 === 0
              ? 'monthly'
              : 'weekly';

        const planRoi = {
          daily: 0.25,
          weekly: 1,
          monthly: 3,
          yearly: 5,
        }[planId];

        const planNames = {
          daily: 'Daily',
          weekly: 'Weekly',
          monthly: 'Monthly',
          yearly: 'Yearly',
        };

        const investment =
          fmtNumber(
            profit /
              planRoi
          );

        history.push({
          id:
            `NX-H${String(
              index + 1
            ).padStart(
              3,
              '0'
            )}`,

          planId,

          planName:
            planNames[planId],

          investment,

          targetRoi:
            planRoi,

          profit:
            fmtNumber(profit),

          completedAt,

          status:
            'completed',
        });
      }
    );

    /*
     * Newest trade first.
     */
    return history.reverse();
  }

  function makeTransactions(
    tradeHistory,
    now
  ) {
    const transactions = [];

    const startingTimestamp =
      now -
      77 *
        86_400_000;

    /*
     * Initial capital.
     */
    transactions.push({
      id:
        `TX-START-${startingTimestamp}`,

      type:
        'deposit',

      amount:
        STARTING_CAPITAL,

      status:
        'completed',

      timestamp:
        startingTimestamp,

      description:
        'Initial trading capital',
    });

    /*
     * Trade profit transactions.
     * Principal is not counted as a new
     * deposit on completion.
     */
    tradeHistory
      .slice()
      .reverse()
      .forEach(
        (trade) => {
          transactions.push({
            id:
              `TX-RESULT-${trade.id}`,

            type:
              'trade_result',

            amount:
              trade.profit,

            status:
              'completed',

            timestamp:
              trade.completedAt,

            description:
              `${trade.planName} cycle completed`,

            tradeId:
              trade.id,
          });
        }
      );

    /*
     * Historical withdrawals.
     */
    WITHDRAWALS.forEach(
      (amount, index) => {
        const timestamp =
          addDays(
            startingTimestamp,
            9 +
              index * 7
          );

        transactions.push({
          id:
            `TX-WD-${index + 1}`,

          type:
            'withdrawal',

          amount,

          status:
            'completed',

          timestamp,

          description:
            'Withdrawal completed',
        });
      }
    );

    transactions.sort(
      (a, b) =>
        Number(
          b.timestamp
        ) -
        Number(
          a.timestamp
        )
    );

    return transactions;
  }

  function buildSeededState(
    existing
  ) {
    const now =
      Date.now();

    const tradeHistory =
      makeTradeHistory(
        now
      );

    const transactions =
      makeTransactions(
        tradeHistory,
        now
      );

    return {
      ...clone(
        DEFAULT_STATE
      ),

      ...existing,

      version:
        STORAGE_VERSION,

      loggedIn:
        Boolean(
          existing?.loggedIn
        ),

      firstRun:
        false,

      balance:
        STARTING_CAPITAL +
        PROFIT_TOTAL -
        WITHDRAWAL_TOTAL,

      availableBalance:
        STARTING_CAPITAL +
        PROFIT_TOTAL -
        WITHDRAWAL_TOTAL,

      lockedBalance:
        0,

      startingCapital:
        STARTING_CAPITAL,

      cumulativeProfit:
        PROFIT_TOTAL,

      totalWithdrawals:
        WITHDRAWAL_TOTAL,

      activeTrade:
        null,

      tradeHistory,

      transactions,

      historySeedVersion:
        HISTORY_SEED_VERSION,
    };
  }

  function shouldSeed(
    existing
  ) {
    if (
      !existing ||
      typeof existing !==
        'object'
    ) {
      return true;
    }

    /*
     * Already migrated/seeded.
     */
    if (
      Number(
        existing.historySeedVersion
      ) >=
      HISTORY_SEED_VERSION
    ) {
      return false;
    }

    const hasTradeHistory =
      Array.isArray(
        existing.tradeHistory
      ) &&
      existing.tradeHistory
        .length > 0;

    const hasTransactions =
      Array.isArray(
        existing.transactions
      ) &&
      existing.transactions
        .length > 0;

    const balance =
      Number(
        existing.balance || 0
      );

    const available =
      Number(
        existing.availableBalance ||
          0
      );

    /*
     * Only seed an empty/new account.
     * Existing accounts with activity
     * are left untouched.
     */
    return (
      !hasTradeHistory &&
      !hasTransactions &&
      balance === 0 &&
      available === 0
    );
  }

  function get() {
    const parsed =
      safeParse(
        window.localStorage.getItem(
          STORAGE_KEY
        )
      );

    /*
     * Brand-new storage.
     */
    if (!parsed) {
      const seeded =
        buildSeededState(
          null
        );

      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          seeded
        )
      );

      return clone(
        seeded
      );
    }

    let state =
      mergeState(
        DEFAULT_STATE,
        parsed
      );

    /*
     * One-time historical
     * account seed.
     */
    if (
      shouldSeed(parsed)
    ) {
      state =
        buildSeededState(
          parsed
        );

      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          state
        )
      );

      return clone(
        state
      );
    }

    state.version =
      STORAGE_VERSION;

    if (
      !Number.isFinite(
        Number(
          state.startingCapital
        )
      )
    ) {
      state.startingCapital =
        STARTING_CAPITAL;
    }

    if (
      !Number.isFinite(
        Number(
          state.cumulativeProfit
        )
      )
    ) {
      state.cumulativeProfit =
        state.tradeHistory
          .filter(
            (trade) =>
              trade?.status ===
              'completed'
          )
          .reduce(
            (sum, trade) =>
              sum +
              Number(
                trade.profit || 0
              ),
            0
          );
    }

    if (
      !Number.isFinite(
        Number(
          state.totalWithdrawals
        )
      )
    ) {
      state.totalWithdrawals =
        state.transactions
          .filter(
            (tx) =>
              tx?.type ===
              'withdrawal'
          )
          .reduce(
            (sum, tx) =>
              sum +
              Number(
                tx.amount || 0
              ),
            0
          );
    }

    /*
     * Active trade:
     * total stays intact,
     * principal becomes locked.
     */
    if (
      state.activeTrade?.status ===
      'active'
    ) {
      const locked =
        Math.max(
          0,
          Number(
            state.activeTrade
              .investment || 0
          )
        );

      state.lockedBalance =
        fmtNumber(
          locked
        );

      state.availableBalance =
        fmtNumber(
          Math.max(
            0,
            Number(
              state.balance ||
                0
            ) -
              locked
          )
        );
    } else {
      /*
       * No active trade:
       * everything is available.
       */
      state.lockedBalance =
        0;

      state.availableBalance =
        fmtNumber(
          state.balance
        );
    }

    return clone(
      state
    );
  }

  function set(
    nextState
  ) {
    const safeState =
      mergeState(
        DEFAULT_STATE,
        nextState
      );

    safeState.version =
      STORAGE_VERSION;

    safeState.balance =
      fmtNumber(
        safeState.balance
      );

    safeState.availableBalance =
      fmtNumber(
        safeState.availableBalance
      );

    safeState.lockedBalance =
      fmtNumber(
        safeState.lockedBalance
      );

    safeState.startingCapital =
      fmtNumber(
        safeState.startingCapital
      );

    safeState.cumulativeProfit =
      fmtNumber(
        safeState.cumulativeProfit
      );

    safeState.totalWithdrawals =
      fmtNumber(
        safeState.totalWithdrawals
      );

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        safeState
      )
    );

    return clone(
      safeState
    );
  }

  function update(
    mutator
  ) {
    const state =
      get();

    const result =
      typeof mutator ===
      'function'
        ? mutator(
            state
          )
        : state;

    return set(
      result || state
    );
  }

  function reset() {
    window.localStorage.removeItem(
      STORAGE_KEY
    );

    const fresh =
      buildSeededState(
        null
      );

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        fresh
      )
    );

    return clone(
      fresh
    );
  }

  function clear() {
    window.localStorage.removeItem(
      STORAGE_KEY
    );
  }

  function exportState() {
    return clone(
      get()
    );
  }

  function getStorageKey() {
    return STORAGE_KEY;
  }

  window.NexusStorage = {
    key:
      STORAGE_KEY,

    version:
      STORAGE_VERSION,

    get,

    set,

    update,

    reset,

    clear,

    exportState,

    getStorageKey,

    totalsAreCorrect,
  };

  try {
    get();
  } catch (error) {
    console.error(
      'NEXUS storage initialization failed:',
      error
    );
  }
})();
