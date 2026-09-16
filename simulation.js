'use strict';

/*
 * NEXUS Simulation Engine
 * -----------------------
 * Simulation-only market/trading environment.
 *
 * This module:
 * - Generates fictional market prices
 * - Creates simulated arbitrage opportunities
 * - Produces realistic activity updates
 * - Calculates simulated spread/fees/slippage
 * - Feeds activity into the active trading cycle
 * - Provides demo deposit/withdrawal helpers
 *
 * No real exchange APIs.
 * No real wallet transactions.
 * No real-money movement.
 */

(function () {
  const STORAGE_KEY = 'nexusSimulatorState';

  const ENGINE_INTERVAL = 3500;

  const ASSETS = Object.freeze([
    {
      symbol: 'BTC',
      name: 'Bitcoin',
      basePrice: 104250
    },
    {
      symbol: 'ETH',
      name: 'Ethereum',
      basePrice: 3920
    },
    {
      symbol: 'SOL',
      name: 'Solana',
      basePrice: 146
    },
    {
      symbol: 'USDT',
      name: 'Tether',
      basePrice: 1
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      basePrice: 1
    }
  ]);

  const VENUES = Object.freeze([
    'Nexus Exchange A',
    'Nexus Exchange B',
    'Nexus Exchange C'
  ]);

  const MARKET_STATE = new Map();

  let timer = null;

  function clone(value) {
    return JSON.parse(
      JSON.stringify(value)
    );
  }

  const DEFAULT_STATE = Object.freeze({
    loggedIn: false,

    user: {
      name: 'Trader Account',
      email: 'demo@nexus.local',
      verified: false,
      inviteCode: ''
    },

    balance: 0,

    selectedPlan: 'daily',

    activeTrade: null,

    tradeHistory: [],

    transactions: [],

    communityPosts: [],

    notifications: 2,

    tourSeen: false,

    tourStep: 0,

    settings: {
      notifications: true,
      dark: true
    }
  });

  function loadState() {
    try {
      const raw =
        localStorage.getItem(
          STORAGE_KEY
        );

      if (!raw) {
        return clone(
          DEFAULT_STATE
        );
      }

      const parsed =
        JSON.parse(raw);

      return {
        ...clone(DEFAULT_STATE),
        ...parsed,

        user: {
          ...clone(
            DEFAULT_STATE.user
          ),
          ...(parsed.user || {})
        },

        settings: {
          ...clone(
            DEFAULT_STATE.settings
          ),
          ...(parsed.settings || {})
        },

        tradeHistory:
          Array.isArray(
            parsed.tradeHistory
          )
            ? parsed.tradeHistory
            : [],

        transactions:
          Array.isArray(
            parsed.transactions
          )
            ? parsed.transactions
            : [],

        communityPosts:
          Array.isArray(
            parsed.communityPosts
          )
            ? parsed.communityPosts
            : []
      };
    } catch (error) {
      console.warn(
        'NEXUS simulation: could not load state.',
        error
      );

      return clone(
        DEFAULT_STATE
      );
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state)
      );

      return true;
    } catch (error) {
      console.warn(
        'NEXUS simulation: could not save state.',
        error
      );

      return false;
    }
  }

  function random(min, max) {
    return (
      min +
      Math.random() *
        (max - min)
    );
  }

  function clamp(
    value,
    min,
    max
  ) {
    return Math.min(
      Math.max(
        value,
        min
      ),
      max
    );
  }

  function round(
    value,
    decimals = 2
  ) {
    const factor =
      10 ** decimals;

    return (
      Math.round(
        value * factor
      ) / factor
    );
  }

  function formatMoney(
    amount,
    currency = 'USD'
  ) {
    try {
      return new Intl.NumberFormat(
        'en-US',
        {
          style: 'currency',
          currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }
      ).format(
        Number(amount) || 0
      );
    } catch (error) {
      return `$${(
        Number(amount) || 0
      ).toFixed(2)}`;
    }
  }

  function formatPercent(
    decimal
  ) {
    return `${(
      (Number(decimal) || 0) *
      100
    ).toFixed(2)}%`;
  }

  function now() {
    return Date.now();
  }

  function randomId(prefix) {
    return `${prefix}-${now()}-${Math.floor(
      Math.random() * 1000000
    )}`;
  }

  function initializeMarkets() {
    if (
      MARKET_STATE.size >
      0
    ) {
      return;
    }

    ASSETS.forEach(
      (asset) => {
        const prices =
          {};

        VENUES.forEach(
          (venue) => {
            const variation =
              asset.symbol ===
              'USDT' ||
              asset.symbol ===
              'USDC'
                ? random(
                    -0.001,
                    0.001
                  )
                : random(
                    -0.006,
                    0.006
                  );

            prices[venue] =
              round(
                asset.basePrice *
                  (1 + variation),
                asset.basePrice <
                  10
                  ? 4
                  : 2
              );
          }
        );

        MARKET_STATE.set(
          asset.symbol,
          {
            ...asset,
            prices
          }
        );
      }
    );
  }

  function updateMarketPrices() {
    initializeMarkets();

    MARKET_STATE.forEach(
      (market) => {
        const volatility =
          market.basePrice <=
          1
            ? 0.0007
            : 0.0018;

        Object.keys(
          market.prices
        ).forEach(
          (venue) => {
            const current =
              Number(
                market.prices[
                  venue
                ]
              ) || market.basePrice;

            const drift =
              random(
                -volatility,
                volatility
              );

            let next =
              current *
              (1 + drift);

            /*
             * Stablecoins remain close
             * to their simulated peg.
             */
            if (
              market.symbol ===
                'USDT' ||
              market.symbol ===
                'USDC'
            ) {
              next = clamp(
                next,
                0.995,
                1.005
              );
            }

            market.prices[
              venue
            ] = round(
              next,
              market.basePrice <
                10
                ? 4
                : 2
            );
          }
        );
      }
    );

    dispatch(
      'nexus:market-updated',
      {
        markets:
          getMarketSnapshot()
      }
    );
  }

  function getMarketSnapshot() {
    initializeMarkets();

    return Array.from(
      MARKET_STATE.values()
    ).map(
      (market) => ({
        symbol:
          market.symbol,

        name:
          market.name,

        prices: {
          ...market.prices
        }
      })
    );
  }

  function findBestOpportunity() {
    initializeMarkets();

    let best =
      null;

    MARKET_STATE.forEach(
      (market) => {
        const venues =
          Object.keys(
            market.prices
          );

        for (
          let i = 0;
          i < venues.length;
          i += 1
        ) {
          for (
            let j = i + 1;
            j < venues.length;
            j += 1
          ) {
            const venueA =
              venues[i];

            const venueB =
              venues[j];

            const priceA =
              Number(
                market.prices[
                  venueA
                ]
              );

            const priceB =
              Number(
                market.prices[
                  venueB
                ]
              );

            if (
              !Number.isFinite(
                priceA
              ) ||
              !Number.isFinite(
                priceB
              ) ||
              priceA <= 0 ||
              priceB <= 0
            ) {
              continue;
            }

            const buyVenue =
              priceA <= priceB
                ? venueA
                : venueB;

            const sellVenue =
              priceA <= priceB
                ? venueB
                : venueA;

            const buyPrice =
              Math.min(
                priceA,
                priceB
              );

            const sellPrice =
              Math.max(
                priceA,
                priceB
              );

            const grossSpread =
              (
                sellPrice -
                buyPrice
              ) / buyPrice;

            if (
              !best ||
              grossSpread >
                best.grossSpread
            ) {
              best = {
                asset:
                  market.symbol,

                assetName:
                  market.name,

                buyVenue,

                sellVenue,

                buyPrice,

                sellPrice,

                grossSpread
              };
            }
          }
        }
      }
    );

    return best;
  }

  function calculateOpportunity(
    opportunity,
    capital
  ) {
    const safeCapital =
      Math.max(
        0,
        Number(capital) || 0
      );

    if (
      !opportunity ||
      safeCapital <= 0
    ) {
      return null;
    }

    const tradingFee =
      random(
        0.0004,
        0.0012
      );

    const slippage =
      random(
        0.00008,
        0.00055
      );

    const executionCost =
      random(
        0.00002,
        0.00018
      );

    const grossProfit =
      safeCapital *
      opportunity.grossSpread;

    const totalCosts =
      safeCapital *
      (
        tradingFee +
        slippage +
        executionCost
      );

    const netProfit =
      Math.max(
        0,
        grossProfit -
          totalCosts
      );

    const netSpread =
      Math.max(
        0,
        opportunity.grossSpread -
          tradingFee -
          slippage -
          executionCost
      );

    return {
      id:
        randomId('ARB'),

      timestamp:
        now(),

      asset:
        opportunity.asset,

      assetName:
        opportunity.assetName,

      buyVenue:
        opportunity.buyVenue,

      sellVenue:
        opportunity.sellVenue,

      buyPrice:
        opportunity.buyPrice,

      sellPrice:
        opportunity.sellPrice,

      grossSpread:
        opportunity.grossSpread,

      tradingFee,

      slippage,

      executionCost,

      totalCosts,

      grossProfit,

      netSpread,

      netProfit,

      status:
        'simulated'
    };
  }

  function createActivityEvent(
    message,
    type = 'market'
  ) {
    return {
      id:
        randomId('ACT'),

      timestamp:
        now(),

      type,

      message
    };
  }

  function getActivityMessage(
    opportunity
  ) {
    if (!opportunity) {
      return 'Scanning simulated markets for price differences.';
    }

    const messages = [
      `${opportunity.asset} spread detected between ${opportunity.buyVenue} and ${opportunity.sellVenue}.`,

      `Comparing ${opportunity.asset} execution prices across simulated venues.`,

      `${opportunity.asset}/USDT opportunity passed the simulated spread check.`,

      `Simulated arbitrage execution completed for ${opportunity.asset}.`,

      `Fees and slippage calculated for ${opportunity.asset} opportunity.`
    ];

    return messages[
      Math.floor(
        Math.random() *
          messages.length
      )
    ];
  }

  function appendEvent(
    activeTrade,
    event
  ) {
    if (!activeTrade) {
      return;
    }

    if (
      !Array.isArray(
        activeTrade.events
      )
    ) {
      activeTrade.events =
        [];
    }

    activeTrade.events.unshift(
      event
    );

    activeTrade.events =
      activeTrade.events.slice(
        0,
        30
      );

    activeTrade.lastEvent =
      event.message;
  }

  function appendOpportunity(
    activeTrade,
    opportunity
  ) {
    if (
      !activeTrade ||
      !opportunity
    ) {
      return;
    }

    if (
      !Array.isArray(
        activeTrade.opportunities
      )
    ) {
      activeTrade.opportunities =
        [];
    }

    activeTrade.opportunities.unshift(
      opportunity
    );

    activeTrade.opportunities =
      activeTrade.opportunities.slice(
        0,
        50
      );
  }

  function updateActiveSimulation() {
    const state =
      loadState();

    const active =
      state.activeTrade;

    if (
      !active ||
      active.status !==
        'active'
    ) {
      return;
    }

    const currentTime =
      now();

    const elapsed =
      clamp(
        currentTime -
          active.startTime,
        0,
        active.durationMs
      );

    const progress =
      active.durationMs > 0
        ? clamp(
            elapsed /
              active.durationMs,
            0,
            1
          )
        : 1;

    active.progress =
      progress;

    const targetProfit =
      Number(
        active.projectedProfit
      ) || 0;

    /*
     * This provides a smooth simulation
     * result rather than random jumps.
     */
    active.realizedProfit =
      round(
        targetProfit *
          progress,
        2
      );

    active.currentBalance =
      round(
        active.investment +
          active.realizedProfit,
        2
      );

    const opportunity =
      findBestOpportunity();

    /*
     * Generate activity only periodically
     * so the feed feels natural.
     */
    const lastActivity =
      active.events?.[0];

    const activityAge =
      lastActivity
        ? currentTime -
          Number(
            lastActivity.timestamp
          )
        : Infinity;

    if (
      activityAge >=
        ENGINE_INTERVAL * 2 &&
      opportunity
    ) {
      const simulated =
        calculateOpportunity(
          opportunity,
          active.investment
        );

      if (simulated) {
        appendOpportunity(
          active,
          simulated
        );

        appendEvent(
          active,
          createActivityEvent(
            getActivityMessage(
              simulated
            ),
            'arbitrage'
          )
        );
      }
    }

    saveState(state);

    renderSimulation();

    dispatch(
      'nexus:simulation-tick',
      {
        state
      }
    );
  }

  function simulateDeposit(
    amount
  ) {
    const state =
      loadState();

    const numeric =
      Number(amount);

    if (
      !state.loggedIn
    ) {
      return {
        success: false,
        message:
          'Sign in before using the simulator.'
      };
    }

    if (
      !Number.isFinite(
        numeric
      ) ||
      numeric <= 0
    ) {
      return {
        success: false,
        message:
          'Enter a valid simulated deposit amount.'
      };
    }

    const safeAmount =
      round(
        numeric,
        2
      );

    state.balance =
      round(
        (
          Number(
            state.balance
          ) || 0
        ) +
          safeAmount,
        2
      );

    state.transactions.unshift({
      id:
        randomId('TX'),

      type:
        'simulated_deposit',

      status:
        'completed',

      amount:
        safeAmount,

      timestamp:
        now(),

      description:
        'Simulated deposit added to demo balance.'
    });

    saveState(state);

    renderSimulation();

    dispatch(
      'nexus:balance-updated',
      {
        balance:
          state.balance,
        reason:
          'simulated_deposit'
      }
    );

    return {
      success: true,
      balance:
        state.balance
    };
  }

  function simulateWithdrawal(
    amount
  ) {
    const state =
      loadState();

    const numeric =
      Number(amount);

    if (
      !state.loggedIn
    ) {
      return {
        success: false,
        message:
          'Sign in before using the simulator.'
      };
    }

    if (
      !Number.isFinite(
        numeric
      ) ||
      numeric <= 0
    ) {
      return {
        success: false,
        message:
          'Enter a valid simulated withdrawal amount.'
      };
    }

    const safeAmount =
      round(
        numeric,
        2
      );

    const currentBalance =
      Number(
        state.balance
      ) || 0;

    if (
      safeAmount >
      currentBalance
    ) {
      return {
        success: false,
        message:
          'Simulated withdrawal exceeds the available balance.'
      };
    }

    state.balance =
      round(
        currentBalance -
          safeAmount,
        2
      );

    state.transactions.unshift({
      id:
        randomId('TX'),

      type:
        'simulated_withdrawal',

      status:
        'completed',

      amount:
        safeAmount,

      timestamp:
        now(),

      description:
        'Simulated withdrawal deducted from demo balance.'
    });

    saveState(state);

    renderSimulation();

    dispatch(
      'nexus:balance-updated',
      {
        balance:
          state.balance,
        reason:
          'simulated_withdrawal'
      }
    );

    return {
      success: true,
      balance:
        state.balance
    };
  }

  function renderSimulation() {
    const state =
      loadState();

    updateBalanceNodes(
      state.balance
    );

    updateMarketNodes();

    updateActivityNodes(
      state.activeTrade
    );
  }

  function updateBalanceNodes(
    balance
  ) {
    document
      .querySelectorAll(
        '[data-simulated-balance]'
      )
      .forEach(
        (node) => {
          node.textContent =
            formatMoney(
              balance
            );
        }
      );
  }

  function updateMarketNodes() {
    initializeMarkets();

    document
      .querySelectorAll(
        '[data-market-symbol]'
      )
      .forEach(
        (node) => {
          const symbol =
            node.dataset.marketSymbol;

          const market =
            MARKET_STATE.get(
              symbol
            );

          if (!market) {
            return;
          }

          const venue =
            node.dataset.marketVenue;

          if (
            venue &&
            market.prices[
              venue
            ] !== undefined
          ) {
            node.textContent =
              formatMoney(
                market.prices[
                  venue
                ]
              );
          }
        }
      );

    const opportunity =
      findBestOpportunity();

    document
      .querySelectorAll(
        '[data-best-spread]'
      )
      .forEach(
        (node) => {
          node.textContent =
            opportunity
              ? formatPercent(
                  opportunity.grossSpread
                )
              : '—';
        }
      );

    document
      .querySelectorAll(
        '[data-best-asset]'
      )
      .forEach(
        (node) => {
          node.textContent =
            opportunity
              ? opportunity.asset
              : 'Scanning';
        }
      );
  }

  function updateActivityNodes(
    active
  ) {
    document
      .querySelectorAll(
        '[data-live-simulation]'
      )
      .forEach(
        (node) => {
          node.textContent =
            active?.status ===
              'active'
              ? 'Simulation running'
              : 'Simulation ready';
        }
      );

    document
      .querySelectorAll(
        '[data-simulation-event]'
      )
      .forEach(
        (node) => {
          node.textContent =
            active?.lastEvent ||
            'Scanning simulated markets.';
        }
      );
  }

  function bindDepositForms() {
    document
      .querySelectorAll(
        '[data-simulated-deposit-form]'
      )
      .forEach(
        (form) => {
          if (
            form.dataset.bound ===
            'true'
          ) {
            return;
          }

          form.dataset.bound =
            'true';

          form.addEventListener(
            'submit',
            (event) => {
              event.preventDefault();

              const input =
                form.querySelector(
                  '[data-deposit-amount]'
                );

              const result =
                simulateDeposit(
                  input?.value
                );

              notifyResult(
                result,
                'Deposit'
              );

              if (
                result.success &&
                input
              ) {
                input.value =
                  '';
              }
            }
          );
        }
      );
  }

  function bindWithdrawalForms() {
    document
      .querySelectorAll(
        '[data-simulated-withdrawal-form]'
      )
      .forEach(
        (form) => {
          if (
            form.dataset.bound ===
            'true'
          ) {
            return;
          }

          form.dataset.bound =
            'true';

          form.addEventListener(
            'submit',
            (event) => {
              event.preventDefault();

              const input =
                form.querySelector(
                  '[data-withdrawal-amount]'
                );

              const result =
                simulateWithdrawal(
                  input?.value
                );

              notifyResult(
                result,
                'Withdrawal'
              );

              if (
                result.success &&
                input
              ) {
                input.value =
                  '';
              }
            }
          );
        }
      );
  }

  function notifyResult(
    result,
    action
  ) {
    const message =
      result?.message ||
      (result?.success
        ? `${action} completed.`
        : `${action} failed.`);

    const toastWrap =
      document.getElementById(
        'toastWrap'
      );

    if (!toastWrap) {
      console.info(
        `NEXUS ${action}: ${message}`
      );
      return;
    }

    const toast =
      document.createElement(
        'div'
      );

    toast.className =
      'toast';

    toast.textContent =
      message;

    toastWrap.appendChild(
      toast
    );

    window.setTimeout(
      () => toast.remove(),
      3000
    );
  }

  function start() {
    if (timer) {
      return;
    }

    initializeMarkets();

    timer =
      window.setInterval(
        () => {
          updateMarketPrices();
          updateActiveSimulation();
        },
        ENGINE_INTERVAL
      );

    updateMarketPrices();
    updateActiveSimulation();
  }

  function stop() {
    if (!timer) {
      return;
    }

    window.clearInterval(
      timer
    );

    timer = null;
  }

  function dispatch(
    eventName,
    detail
  ) {
    try {
      window.dispatchEvent(
        new CustomEvent(
          eventName,
          {
            detail
          }
        )
      );
    } catch (error) {
      console.debug(
        'NEXUS simulation event skipped.',
        error
      );
    }
  }

  function bindEvents() {
    bindDepositForms();
    bindWithdrawalForms();

    window.addEventListener(
      'nexus:trade-rendered',
      renderSimulation
    );

    window.addEventListener(
      'nexus:trade-completed',
      renderSimulation
    );
  }

  function init() {
    bindEvents();
    renderSimulation();
    start();
  }

  window.NexusSimulation =
    Object.freeze({
      start,
      stop,

      loadState,
      saveState,

      getMarkets:
        getMarketSnapshot,

      findBestOpportunity,

      calculateOpportunity,

      simulateDeposit,

      simulateWithdrawal,

      render:
        renderSimulation,

      formatMoney,

      formatPercent
    });

  if (
    document.readyState ===
    'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      init,
      {
        once: true
      }
    );
  } else {
    init();
  }
})();
