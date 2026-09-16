'use strict';

/*
 * NEXUS Trading Simulation Module
 * --------------------------------
 * Simulation-only trading engine.
 *
 * No real exchange APIs.
 * No real deposits or withdrawals.
 * No real financial transactions.
 *
 * Responsibilities:
 * - Plan configuration
 * - Simulation cycle creation
 * - Simulated arbitrage activity
 * - Countdown/progress
 * - Simulated profit calculation
 * - Trade history
 * - Balance updates
 * - Trade screen rendering hooks
 */

(function () {
  const STORAGE_KEY = 'nexusSimulatorState';

  const PLANS = Object.freeze({
    daily: Object.freeze({
      id: 'daily',
      name: 'Daily',
      durationLabel: '24 hours',
      durationMs: 24 * 60 * 60 * 1000,
      targetRoi: 0.25
    }),

    weekly: Object.freeze({
      id: 'weekly',
      name: 'Weekly',
      durationLabel: '7 days',
      durationMs: 7 * 24 * 60 * 60 * 1000,
      targetRoi: 1.00
    }),

    monthly: Object.freeze({
      id: 'monthly',
      name: 'Monthly',
      durationLabel: '30 days',
      durationMs: 30 * 24 * 60 * 60 * 1000,
      targetRoi: 3.00
    }),

    yearly: Object.freeze({
      id: 'yearly',
      name: 'Yearly',
      durationLabel: '365 days',
      durationMs: 365 * 24 * 60 * 60 * 1000,
      targetRoi: 5.00
    })
  });

  const SIMULATION_MARKETS = Object.freeze([
    {
      asset: 'SOL',
      pair: 'SOL/USDT',
      buyVenue: 'Nexus Exchange A',
      sellVenue: 'Nexus Exchange B'
    },
    {
      asset: 'ETH',
      pair: 'ETH/USDT',
      buyVenue: 'Nexus Exchange B',
      sellVenue: 'Nexus Exchange C'
    },
    {
      asset: 'BTC',
      pair: 'BTC/USDT',
      buyVenue: 'Nexus Exchange C',
      sellVenue: 'Nexus Exchange A'
    },
    {
      asset: 'USDC',
      pair: 'USDC/USDT',
      buyVenue: 'Nexus Exchange A',
      sellVenue: 'Nexus Exchange C'
    }
  ]);

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

  let clockTimer = null;
  let engineTimer = null;

  function deepClone(value) {
    return JSON.parse(
      JSON.stringify(value)
    );
  }

  function loadState() {
    try {
      const raw =
        localStorage.getItem(
          STORAGE_KEY
        );

      if (!raw) {
        return deepClone(
          DEFAULT_STATE
        );
      }

      const parsed =
        JSON.parse(raw);

      return {
        ...deepClone(DEFAULT_STATE),
        ...parsed,

        user: {
          ...deepClone(
            DEFAULT_STATE.user
          ),
          ...(parsed.user || {})
        },

        settings: {
          ...deepClone(
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
        'NEXUS trading: state could not be loaded.',
        error
      );

      return deepClone(
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
        'NEXUS trading: state could not be saved.',
        error
      );

      return false;
    }
  }

  function getPlan(planId) {
    return (
      PLANS[
        String(planId || '').toLowerCase()
      ] ||
      PLANS.daily
    );
  }

  function formatMoney(
    amount,
    currency = 'USD'
  ) {
    const numeric =
      Number(amount) || 0;

    try {
      return new Intl.NumberFormat(
        'en-US',
        {
          style: 'currency',
          currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }
      ).format(numeric);
    } catch (error) {
      return `$${numeric.toFixed(2)}`;
    }
  }

  function formatPercent(decimal) {
    return `${(
      (Number(decimal) || 0) * 100
    ).toFixed(2)}%`;
  }

  function formatDate(timestamp) {
    const date =
      new Date(timestamp);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return '—';
    }

    return new Intl.DateTimeFormat(
      'en-US',
      {
        dateStyle: 'medium',
        timeStyle: 'short'
      }
    ).format(date);
  }

  function formatDuration(ms) {
    const safeMs =
      Math.max(
        0,
        Number(ms) || 0
      );

    const totalSeconds =
      Math.floor(
        safeMs / 1000
      );

    const days =
      Math.floor(
        totalSeconds / 86400
      );

    const hours =
      Math.floor(
        (totalSeconds % 86400) / 3600
      );

    const minutes =
      Math.floor(
        (totalSeconds % 3600) / 60
      );

    const seconds =
      totalSeconds % 60;

    if (days > 0) {
      return `${days}d ${String(
        hours
      ).padStart(2, '0')}h ${String(
        minutes
      ).padStart(2, '0')}m`;
    }

    return `${String(hours).padStart(
      2,
      '0'
    )}:${String(minutes).padStart(
      2,
      '0'
    )}:${String(seconds).padStart(
      2,
      '0'
    )}`;
  }

  function clamp(value, min, max) {
    return Math.min(
      Math.max(value, min),
      max
    );
  }

  function randomBetween(min, max) {
    return (
      min +
      Math.random() *
        (max - min)
    );
  }

  function selectMarket() {
    const index =
      Math.floor(
        Math.random() *
          SIMULATION_MARKETS.length
      );

    return SIMULATION_MARKETS[
      index
    ];
  }

  function makeSimulatedOpportunity(
    investment
  ) {
    const market =
      selectMarket();

    const grossSpread =
      randomBetween(
        0.0025,
        0.009
      );

    const tradingFees =
      randomBetween(
        0.0006,
        0.0014
      );

    const slippage =
      randomBetween(
        0.0001,
        0.0007
      );

    const networkCosts =
      randomBetween(
        0.00005,
        0.00025
      );

    const netSpread = Math.max(
      0,
      grossSpread -
        tradingFees -
        slippage -
        networkCosts
    );

    const grossProfit =
      investment *
      grossSpread;

    const totalCosts =
      investment *
      (tradingFees +
        slippage +
        networkCosts);

    const netProfit =
      Math.max(
        0,
        grossProfit -
          totalCosts
      );

    return {
      id: `OP-${Date.now()}-${Math.floor(
        Math.random() * 100000
      )}`,

      timestamp:
        Date.now(),

      asset:
        market.asset,

      pair:
        market.pair,

      buyVenue:
        market.buyVenue,

      sellVenue:
        market.sellVenue,

      grossSpread,

      tradingFees,

      slippage,

      networkCosts,

      netSpread,

      grossProfit,

      totalCosts,

      netProfit,

      status: 'completed'
    };
  }

  function getActiveTrade() {
    return loadState().activeTrade;
  }

  function hasActiveTrade() {
    const active =
      getActiveTrade();

    if (!active) {
      return false;
    }

    return (
      active.status ===
      'active'
    );
  }

  function validateInvestmentAmount(
    amount
  ) {
    const numeric =
      Number(amount);

    if (
      !Number.isFinite(
        numeric
      )
    ) {
      return {
        valid: false,
        message:
          'Enter a valid simulation amount.'
      };
    }

    if (numeric <= 0) {
      return {
        valid: false,
        message:
          'Simulation amount must be greater than zero.'
      };
    }

    return {
      valid: true,
      amount: Number(
        numeric.toFixed(2)
      )
    };
  }

  function createCycle(
    planId,
    amount
  ) {
    const state =
      loadState();

    if (!state.loggedIn) {
      return {
        success: false,
        message:
          'Sign in before starting a simulation.'
      };
    }

    if (hasActiveTrade()) {
      return {
        success: false,
        message:
          'You already have an active simulation cycle.'
      };
    }

    const plan =
      getPlan(planId);

    const validation =
      validateInvestmentAmount(
        amount
      );

    if (!validation.valid) {
      return {
        success: false,
        message:
          validation.message
      };
    }

    const investment =
      validation.amount;

    const startTime =
      Date.now();

    const endTime =
      startTime +
      plan.durationMs;

    const projectedProfit =
      Number(
        (
          investment *
          plan.targetRoi
        ).toFixed(2)
      );

    const projectedBalance =
      Number(
        (
          investment +
          projectedProfit
        ).toFixed(2)
      );

    const firstOpportunity =
      makeSimulatedOpportunity(
        investment
      );

    const activeTrade = {
      id: `SIM-${startTime}-${Math.floor(
        Math.random() * 10000
      )}`,

      mode: 'simulation',

      status: 'active',

      planId:
        plan.id,

      planName:
        plan.name,

      durationMs:
        plan.durationMs,

      durationLabel:
        plan.durationLabel,

      targetRoi:
        plan.targetRoi,

      investment,

      projectedProfit,

      projectedBalance,

      realizedProfit: 0,

      currentBalance:
        investment,

      startTime,

      endTime,

      progress: 0,

      lastEvent:
        'Simulation started',

      events: [
        {
          id: `EV-${Date.now()}`,
          timestamp: startTime,
          type: 'system',
          message:
            'Simulation cycle started.'
        }
      ],

      opportunities: [
        firstOpportunity
      ]
    };

    state.selectedPlan =
      plan.id;

    state.activeTrade =
      activeTrade;

    state.balance =
      Number(
        (
          state.balance +
          investment
        ).toFixed(2)
      );

    state.transactions.unshift({
      id: `TX-${startTime}`,
      type: 'simulated_investment',
      status: 'completed',
      amount: investment,
      plan: plan.name,
      timestamp: startTime,
      description:
        `${plan.name} simulation started`
    });

    saveState(state);

    renderAll();

    return {
      success: true,
      activeTrade
    };
  }

  function addEvent(
    activeTrade,
    message,
    type = 'trading'
  ) {
    if (
      !activeTrade ||
      !Array.isArray(
        activeTrade.events
      )
    ) {
      return;
    }

    activeTrade.events.unshift({
      id: `EV-${Date.now()}-${Math.floor(
        Math.random() * 10000
      )}`,

      timestamp:
        Date.now(),

      type,

      message
    });

    activeTrade.events =
      activeTrade.events.slice(
        0,
        25
      );

    activeTrade.lastEvent =
      message;
  }

  function addOpportunity(
    activeTrade
  ) {
    if (!activeTrade) {
      return;
    }

    const remaining =
      Math.max(
        0,
        activeTrade.endTime -
          Date.now()
      );

    const timeRatio =
      activeTrade.durationMs > 0
        ? remaining /
          activeTrade.durationMs
        : 0;

    /*
     * Small simulated opportunity count.
     * This is display activity; the plan's
     * projected outcome remains separate.
     */
    if (
      Math.random() >
      0.36
    ) {
      return;
    }

    const opportunity =
      makeSimulatedOpportunity(
        activeTrade.investment
      );

    activeTrade.opportunities.unshift(
      opportunity
    );

    activeTrade.opportunities =
      activeTrade.opportunities.slice(
        0,
        40
      );

    const messages = [
      `${opportunity.asset} spread detected across ${opportunity.buyVenue} and ${opportunity.sellVenue}.`,
      `${opportunity.pair} simulated arbitrage execution completed.`,
      `Net simulated spread: ${formatPercent(
        opportunity.netSpread
      )}.`,
      `Fees and slippage accounted for in simulated result.`
    ];

    const message =
      messages[
        Math.floor(
          Math.random() *
            messages.length
        )
      ];

    addEvent(
      activeTrade,
      message
    );

    void timeRatio;
  }

  function updateProgress(
    activeTrade
  ) {
    if (!activeTrade) {
      return;
    }

    const now =
      Date.now();

    const elapsed =
      clamp(
        now -
          activeTrade.startTime,
        0,
        activeTrade.durationMs
      );

    activeTrade.progress =
      activeTrade.durationMs > 0
        ? clamp(
            elapsed /
              activeTrade.durationMs,
            0,
            1
          )
        : 1;

    const targetProfit =
      Number(
        activeTrade.projectedProfit
      ) || 0;

    /*
     * The simulator makes the displayed
     * running result progress toward the
     * configured target over the cycle.
     */
    activeTrade.realizedProfit =
      Number(
        (
          targetProfit *
          activeTrade.progress
        ).toFixed(2)
      );

    activeTrade.currentBalance =
      Number(
        (
          activeTrade.investment +
          activeTrade.realizedProfit
        ).toFixed(2)
      );
  }

  function completeCycle() {
    const state =
      loadState();

    const active =
      state.activeTrade;

    if (!active) {
      return;
    }

    const finalProfit =
      Number(
        active.projectedProfit
      ) || 0;

    const finalBalance =
      Number(
        (
          active.investment +
          finalProfit
        ).toFixed(2)
      );

    active.progress = 1;

    active.realizedProfit =
      finalProfit;

    active.currentBalance =
      finalBalance;

    active.status =
      'completed';

    active.completedAt =
      Date.now();

    addEvent(
      active,
      'Simulation cycle completed.',
      'system'
    );

    state.balance =
      Number(
        finalBalance.toFixed(2)
      );

    state.tradeHistory.unshift({
      id:
        active.id,

      mode:
        'simulation',

      planId:
        active.planId,

      planName:
        active.planName,

      investment:
        active.investment,

      targetRoi:
        active.targetRoi,

      profit:
        finalProfit,

      finalBalance,

      startTime:
        active.startTime,

      endTime:
        active.endTime,

      completedAt:
        active.completedAt,

      status:
        'completed'
    });

    state.transactions.unshift({
      id: `TX-${Date.now()}`,
      type: 'simulated_result',
      status: 'completed',
      amount: finalProfit,
      plan: active.planName,
      timestamp: Date.now(),
      description:
        `${active.planName} simulation completed`
    });

    /*
     * Keep completed cycle visible until
     * the UI acknowledges it. A new cycle
     * cannot start while activeTrade exists.
     */
    state.activeTrade =
      active;

    saveState(state);

    renderAll();

    dispatch(
      'nexus:trade-completed',
      {
        trade:
          active,
        state
      }
    );
  }

  function engineTick() {
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

    const now =
      Date.now();

    updateProgress(
      active
    );

    if (
      now >=
      active.endTime
    ) {
      completeCycle();
      return;
    }

    addOpportunity(
      active
    );

    addEventIfNeeded(
      active
    );

    saveState(state);

    renderAll();
  }

  function addEventIfNeeded(
    activeTrade
  ) {
    if (
      !activeTrade ||
      !Array.isArray(
        activeTrade.events
      )
    ) {
      return;
    }

    const lastEvent =
      activeTrade.events[0];

    if (!lastEvent) {
      return;
    }

    const elapsed =
      Date.now() -
      Number(
        lastEvent.timestamp
      );

    if (
      elapsed <
      12000
    ) {
      return;
    }

    const statusMessages = [
      'Scanning simulated markets for arbitrage spreads.',
      'Comparing simulated venue prices.',
      'Checking simulated fees and slippage.',
      'Evaluating executable simulated spread.',
      'Monitoring liquidity across simulated venues.'
    ];

    const message =
      statusMessages[
        Math.floor(
          Math.random() *
            statusMessages.length
        )
      ];

    addEvent(
      activeTrade,
      message,
      'scanner'
    );
  }

  function ensureTimers() {
    if (!clockTimer) {
      clockTimer =
        window.setInterval(
          updateLiveCountdown,
          1000
        );
    }

    if (!engineTimer) {
      engineTimer =
        window.setInterval(
          engineTick,
          8000
        );
    }
  }

  function stopTimers() {
    if (clockTimer) {
      window.clearInterval(
        clockTimer
      );

      clockTimer = null;
    }

    if (engineTimer) {
      window.clearInterval(
        engineTimer
      );

      engineTimer = null;
    }
  }

  function updateLiveCountdown() {
    const state =
      loadState();

    const active =
      state.activeTrade;

    if (
      !active ||
      active.status !==
        'active'
    ) {
      updateCountdownElements(
        null
      );
      return;
    }

    const remaining =
      Math.max(
        0,
        active.endTime -
          Date.now()
      );

    const progress =
      active.durationMs > 0
        ? clamp(
            (
              active.durationMs -
              remaining
            ) /
              active.durationMs,
            0,
            1
          )
        : 1;

    updateCountdownElements(
      {
        remaining,
        progress
      }
    );

    if (
      remaining <= 0
    ) {
      completeCycle();
    }
  }

  function updateCountdownElements(
    data
  ) {
    const countdownNodes =
      document.querySelectorAll(
        '[data-trade-countdown]'
      );

    countdownNodes.forEach(
      (node) => {
        if (!data) {
          node.textContent =
            'No active cycle';
          return;
        }

        node.textContent =
          formatDuration(
            data.remaining
          );
      }
    );

    const progressNodes =
      document.querySelectorAll(
        '[data-trade-progress]'
      );

    progressNodes.forEach(
      (node) => {
        const value =
          data
            ? data.progress * 100
            : 0;

        node.style.width =
          `${value.toFixed(1)}%`;

        node.setAttribute(
          'aria-valuenow',
          value.toFixed(1)
        );
      }
    );
  }

  function setText(
    selector,
    value
  ) {
    document
      .querySelectorAll(
        selector
      )
      .forEach(
        (element) => {
          element.textContent =
            value;
        }
      );
  }

  function renderPlanSummary() {
    const state =
      loadState();

    const plan =
      getPlan(
        state.selectedPlan
      );

    setText(
      '[data-selected-plan]',
      plan.name
    );

    setText(
      '[data-plan-duration]',
      plan.durationLabel
    );

    setText(
      '[data-plan-roi]',
      formatPercent(
        plan.targetRoi
      )
    );
  }

  function renderBalance() {
    const state =
      loadState();

    setText(
      '[data-simulated-balance]',
      formatMoney(
        state.balance
      )
    );

    const active =
      state.activeTrade;

    if (active) {
      setText(
        '[data-active-investment]',
        formatMoney(
          active.investment
        )
      );

      setText(
        '[data-projected-profit]',
        formatMoney(
          active.projectedProfit
        )
      );

      setText(
        '[data-current-simulated-profit]',
        formatMoney(
          active.realizedProfit
        )
      );

      setText(
        '[data-current-simulated-balance]',
        formatMoney(
          active.currentBalance
        )
      );
    } else {
      setText(
        '[data-active-investment]',
        '$0.00'
      );

      setText(
        '[data-projected-profit]',
        '$0.00'
      );

      setText(
        '[data-current-simulated-profit]',
        '$0.00'
      );
    }
  }

  function renderActiveTrade() {
    const state =
      loadState();

    const active =
      state.activeTrade;

    setText(
      '[data-trade-status]',
      active
        ? active.status ===
          'active'
          ? 'Trading'
          : 'Completed'
        : 'No active trade'
    );

    if (!active) {
      setText(
        '[data-trade-id]',
        '—'
      );

      setText(
        '[data-trade-start]',
        '—'
      );

      setText(
        '[data-trade-end]',
        '—'
      );

      setText(
        '[data-trade-last-event]',
        'Ready to start a simulation.'
      );

      return;
    }

    setText(
      '[data-trade-id]',
      active.id
    );

    setText(
      '[data-trade-start]',
      formatDate(
        active.startTime
      )
    );

    setText(
      '[data-trade-end]',
      formatDate(
        active.endTime
      )
    );

    setText(
      '[data-trade-last-event]',
      active.lastEvent ||
        'Monitoring simulated markets.'
    );

    setText(
      '[data-trade-plan]',
      active.planName
    );

    setText(
      '[data-trade-roi]',
      formatPercent(
        active.targetRoi
      )
    );

    setText(
      '[data-trade-investment]',
      formatMoney(
        active.investment
      )
    );
  }

  function renderTradeHistory() {
    const state =
      loadState();

    const nodes =
      document.querySelectorAll(
        '[data-trade-history]'
      );

    nodes.forEach(
      (container) => {
        container.innerHTML =
          '';

        const history =
          state.tradeHistory.slice(
            0,
            10
          );

        if (
          history.length ===
          0
        ) {
          const empty =
            document.createElement(
              'div'
            );

          empty.className =
            'empty-state';

          empty.textContent =
            'No completed simulations yet.';

          container.appendChild(
            empty
          );

          return;
        }

        history.forEach(
          (trade) => {
            const row =
              document.createElement(
                'div'
              );

            row.className =
              'trade-history-row';

            const title =
              document.createElement(
                'div'
              );

            title.className =
              'trade-history-title';

            title.textContent =
              `${trade.planName} Simulation`;

            const amount =
              document.createElement(
                'div'
              );

            amount.className =
              'trade-history-amount';

            amount.textContent =
              `+${formatMoney(
                trade.profit
              )}`;

            const meta =
              document.createElement(
                'div'
              );

            meta.className =
              'trade-history-meta';

            meta.textContent =
              `${formatDate(
                trade.completedAt
              )} · ${formatPercent(
                trade.targetRoi
              )} target`;

            row.append(
              title,
              amount,
              meta
            );

            container.appendChild(
              row
            );
          }
        );
      }
    );
  }

  function renderActivity() {
    const state =
      loadState();

    const active =
      state.activeTrade;

    const nodes =
      document.querySelectorAll(
        '[data-trading-activity]'
      );

    nodes.forEach(
      (container) => {
        container.innerHTML =
          '';

        const events =
          active &&
          Array.isArray(
            active.events
          )
            ? active.events.slice(
                0,
                8
              )
            : [];

        if (
          events.length === 0
        ) {
          const empty =
            document.createElement(
              'div'
            );

          empty.className =
            'empty-state';

          empty.textContent =
            'Trading activity will appear here during a simulation.';

          container.appendChild(
            empty
          );

          return;
        }

        events.forEach(
          (event) => {
            const item =
              document.createElement(
                'div'
              );

            item.className =
              'activity-item';

            const message =
              document.createElement(
                'div'
              );

            message.textContent =
              event.message;

            const time =
              document.createElement(
                'time'
              );

            time.dateTime =
              new Date(
                event.timestamp
              ).toISOString();

            time.textContent =
              formatDate(
                event.timestamp
              );

            item.append(
              message,
              time
            );

            container.appendChild(
              item
            );
          }
        );
      }
    );
  }

  function renderAll() {
    renderPlanSummary();
    renderBalance();
    renderActiveTrade();
    renderTradeHistory();
    renderActivity();
    updateLiveCountdown();

    dispatch(
      'nexus:trade-rendered',
      {
        state:
          loadState()
      }
    );
  }

  function showMessage(
    message
  ) {
    const selectors = [
      '#tradeError',
      '[data-trade-message]'
    ];

    let shown = false;

    selectors.forEach(
      (selector) => {
        document
          .querySelectorAll(
            selector
          )
          .forEach(
            (node) => {
              node.textContent =
                message;

              node.classList.remove(
                'hidden'
              );

              shown = true;
            }
          );
      }
    );

    if (!shown) {
      console.info(
        `NEXUS trading: ${message}`
      );
    }
  }

  function startFromUI(
    event
  ) {
    event?.preventDefault();

    const planSelect =
      document.querySelector(
        '[data-plan-select]'
      );

    const activePlan =
      document.querySelector(
        '[data-plan-card].selected'
      );

    const amountInput =
      document.querySelector(
        '[data-trade-amount]'
      );

    const planId =
      planSelect?.value ||
      activePlan?.dataset.planCard ||
      loadState().selectedPlan ||
      'daily';

    const amount =
      Number(
        amountInput?.value
      );

    const result =
      createCycle(
        planId,
        amount
      );

    if (!result.success) {
      showMessage(
        result.message
      );
      return;
    }

    showMessage(
      'Simulation started successfully.'
    );
  }

  function bindPlanSelection() {
    document
      .querySelectorAll(
        '[data-plan-card]'
      )
      .forEach(
        (card) => {
          card.addEventListener(
            'click',
            () => {
              const planId =
                card.dataset.planCard;

              if (
                !PLANS[planId]
              ) {
                return;
              }

              const state =
                loadState();

              state.selectedPlan =
                planId;

              saveState(
                state
              );

              document
                .querySelectorAll(
                  '[data-plan-card]'
                )
                .forEach(
                  (item) => {
                    item.classList.toggle(
                      'selected',
                      item === card
                    );

                    item.setAttribute(
                      'aria-selected',
                      String(
                        item === card
                      )
                    );
                  }
                );

              const selector =
                document.querySelector(
                  '[data-plan-select]'
                );

              if (selector) {
                selector.value =
                  planId;
              }

              renderPlanSummary();
            }
          );
        }
      );
  }

  function bindStartButton() {
    document
      .querySelectorAll(
        '[data-start-trade]'
      )
      .forEach(
        (button) => {
          button.addEventListener(
            'click',
            startFromUI
          );
        }
      );
  }

  function bindCancelButton() {
    document
      .querySelectorAll(
        '[data-cancel-trade]'
      )
      .forEach(
        (button) => {
          button.addEventListener(
            'click',
            cancelActiveCycle
          );
        }
      );
  }

  function cancelActiveCycle(
    event
  ) {
    event?.preventDefault();

    const state =
      loadState();

    if (
      !state.activeTrade ||
      state.activeTrade.status !==
        'active'
    ) {
      showMessage(
        'There is no active simulation to cancel.'
      );
      return;
    }

    /*
     * Cancellation is simulation-only.
     * The original simulation amount is returned
     * to the simulated balance without adding
     * the projected profit.
     */
    const investment =
      Number(
        state.activeTrade.investment
      ) || 0;

    state.activeTrade.status =
      'cancelled';

    state.activeTrade.cancelledAt =
      Date.now();

    state.activeTrade.realizedProfit =
      0;

    state.activeTrade.currentBalance =
      investment;

    addEvent(
      state.activeTrade,
      'Simulation cycle cancelled.',
      'system'
    );

    state.balance =
      Number(
        Math.max(
          0,
          state.balance
        ).toFixed(2)
      );

    state.transactions.unshift({
      id: `TX-${Date.now()}`,
      type: 'simulated_cancel',
      status: 'completed',
      amount: investment,
      plan:
        state.activeTrade.planName,
      timestamp: Date.now(),
      description:
        'Simulation cycle cancelled'
    });

    saveState(
      state
    );

    renderAll();

    showMessage(
      'Simulation cycle cancelled.'
    );
  }

  function clearCompletedCycle() {
    const state =
      loadState();

    if (
      !state.activeTrade ||
      state.activeTrade.status ===
        'active'
    ) {
      return {
        success: false,
        message:
          'No completed simulation is available to clear.'
      };
    }

    state.activeTrade =
      null;

    saveState(
      state
    );

    renderAll();

    return {
      success: true
    };
  }

  function calculateProjectedResult(
    planId,
    amount
  ) {
    const plan =
      getPlan(planId);

    const numeric =
      Number(amount) || 0;

    const profit =
      Number(
        (
          numeric *
          plan.targetRoi
        ).toFixed(2)
      );

    return {
      plan,
      investment:
        numeric,

      targetRoi:
        plan.targetRoi,

      projectedProfit:
        profit,

      projectedBalance:
        Number(
          (
            numeric +
            profit
          ).toFixed(2)
        )
    };
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
      /*
       * Older environments may not support
       * CustomEvent construction.
       */
      console.debug(
        'NEXUS event dispatch skipped.',
        error
      );
    }
  }

  function init() {
    const state =
      loadState();

    if (
      !state.loggedIn
    ) {
      stopTimers();
      return;
    }

    bindPlanSelection();
    bindStartButton();
    bindCancelButton();

    ensureTimers();

    renderAll();
  }

  window.NexusTrading =
    Object.freeze({
      plans: PLANS,

      markets:
        SIMULATION_MARKETS,

      loadState,

      saveState,

      getPlan,

      hasActiveTrade,

      createCycle,

      calculateProjectedResult,

      clearCompletedCycle,

      completeCycle,

      renderAll,

      formatMoney,

      formatPercent,

      formatDate,

      formatDuration
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
