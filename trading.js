'use strict';

/*
 * NEXUS Trading Module
 * Simulation-only trading cycle manager.
 *
 * Responsibilities:
 * - Daily / Weekly / Monthly / Yearly plans
 * - Plan selection
 * - Investment amount validation
 * - Active cycle creation
 * - Cycle progress
 * - Countdown
 * - Simulated arbitrage activity
 * - Projected result
 * - Trade history
 */

(() => {
  const STORAGE_KEY = 'nexusSimulatorState';

  const PLANS = {
    daily: {
      id: 'daily',
      name: 'Daily',
      durationLabel: '24 hours',
      durationMs: 24 * 60 * 60 * 1000,
      targetRoi: 0.25,
    },

    weekly: {
      id: 'weekly',
      name: 'Weekly',
      durationLabel: '7 days',
      durationMs: 7 * 24 * 60 * 60 * 1000,
      targetRoi: 1.00,
    },

    monthly: {
      id: 'monthly',
      name: 'Monthly',
      durationLabel: '30 days',
      durationMs: 30 * 24 * 60 * 60 * 1000,
      targetRoi: 3.00,
    },

    yearly: {
      id: 'yearly',
      name: 'Yearly',
      durationLabel: '365 days',
      durationMs: 365 * 24 * 60 * 60 * 1000,
      targetRoi: 5.00,
    },
  };

  const MARKETS = [
    {
      asset: 'SOL',
      pair: 'SOL/USDT',
      buyVenue: 'Nexus Exchange A',
      sellVenue: 'Nexus Exchange B',
    },

    {
      asset: 'ETH',
      pair: 'ETH/USDT',
      buyVenue: 'Nexus Exchange B',
      sellVenue: 'Nexus Exchange C',
    },

    {
      asset: 'BTC',
      pair: 'BTC/USDT',
      buyVenue: 'Nexus Exchange C',
      sellVenue: 'Nexus Exchange A',
    },

    {
      asset: 'USDC',
      pair: 'USDC/USDT',
      buyVenue: 'Nexus Exchange A',
      sellVenue: 'Nexus Exchange C',
    },
  ];

  let engineTimer = null;
  let countdownTimer = null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        return {
          loggedIn: false,

          user: {
            name: 'Trader Account',
            email: 'demo@nexus.local',
            verified: false,
            inviteCode: '',
          },

          balance: 0,
          selectedPlan: 'daily',
          activeTrade: null,
          tradeHistory: [],
          transactions: [],
          communityPosts: [],
          notifications: 2,
          firstRun: true,
          tourSeen: false,
          tourStep: 0,

          settings: {
            notifications: true,
            dark: true,
          },
        };
      }

      const parsed = JSON.parse(raw);

      return {
        loggedIn: false,
        balance: 0,
        selectedPlan: 'daily',
        activeTrade: null,
        tradeHistory: [],
        transactions: [],
        communityPosts: [],
        notifications: 2,
        firstRun: true,
        tourSeen: false,
        tourStep: 0,

        ...parsed,

        user: {
          name: 'Trader Account',
          email: 'demo@nexus.local',
          verified: false,
          inviteCode: '',
          ...(parsed.user || {}),
        },

        settings: {
          notifications: true,
          dark: true,
          ...(parsed.settings || {}),
        },

        tradeHistory: Array.isArray(parsed.tradeHistory)
          ? parsed.tradeHistory
          : [],

        transactions: Array.isArray(parsed.transactions)
          ? parsed.transactions
          : [],

        communityPosts: Array.isArray(parsed.communityPosts)
          ? parsed.communityPosts
          : [],
      };
    } catch (error) {
      console.warn(
        'NEXUS trading: unable to load state.',
        error
      );

      return {
        loggedIn: false,
        user: {
          name: 'Trader Account',
          email: 'demo@nexus.local',
          verified: false,
          inviteCode: '',
        },
        balance: 0,
        selectedPlan: 'daily',
        activeTrade: null,
        tradeHistory: [],
        transactions: [],
        communityPosts: [],
        notifications: 2,
        firstRun: true,
        tourSeen: false,
        tourStep: 0,
        settings: {
          notifications: true,
          dark: true,
        },
      };
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
        'NEXUS trading: unable to save state.',
        error
      );

      return false;
    }
  }

  function getPlan(planId) {
    return (
      PLANS[String(planId || '').toLowerCase()] ||
      PLANS.daily
    );
  }

  function formatMoney(amount) {
    const value = Number(amount) || 0;

    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      return `$${value.toFixed(2)}`;
    }
  }

  function formatPercent(decimal) {
    return `${(
      (Number(decimal) || 0) * 100
    ).toFixed(2)}%`;
  }

  function formatDate(timestamp) {
    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return '—';
    }

    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  function formatDuration(milliseconds) {
    const totalSeconds = Math.max(
      0,
      Math.floor(
        (Number(milliseconds) || 0) / 1000
      )
    );

    const days = Math.floor(
      totalSeconds / 86400
    );

    const hours = Math.floor(
      (totalSeconds % 86400) / 3600
    );

    const minutes = Math.floor(
      (totalSeconds % 3600) / 60
    );

    const seconds = totalSeconds % 60;

    if (days > 0) {
      return `${days}d ${String(hours).padStart(
        2,
        '0'
      )}h ${String(minutes).padStart(
        2,
        '0'
      )}m`;
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
      Math.random() * (max - min)
    );
  }

  function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.floor(
      Math.random() * 1000000
    )}`;
  }

  function selectMarket() {
    return MARKETS[
      Math.floor(
        Math.random() * MARKETS.length
      )
    ];
  }

  function generateOpportunity(investment) {
    const market = selectMarket();

    const grossSpread = randomBetween(
      0.0025,
      0.009
    );

    const tradingFee = randomBetween(
      0.0004,
      0.0012
    );

    const slippage = randomBetween(
      0.00008,
      0.00055
    );

    const executionCost = randomBetween(
      0.00002,
      0.00018
    );

    const totalCostRate =
      tradingFee +
      slippage +
      executionCost;

    const grossProfit =
      investment * grossSpread;

    const totalCosts =
      investment * totalCostRate;

    const netProfit = Math.max(
      0,
      grossProfit - totalCosts
    );

    return {
      id: createId('ARB'),

      timestamp: Date.now(),

      asset: market.asset,
      pair: market.pair,

      buyVenue: market.buyVenue,
      sellVenue: market.sellVenue,

      grossSpread,

      tradingFee,
      slippage,
      executionCost,

      totalCosts,

      grossProfit,
      netProfit,

      netSpread: Math.max(
        0,
        grossSpread - totalCostRate
      ),

      status: 'completed',
    };
  }

  function addEvent(
    activeTrade,
    message,
    type = 'trading'
  ) {
    if (!activeTrade) {
      return;
    }

    if (!Array.isArray(activeTrade.events)) {
      activeTrade.events = [];
    }

    activeTrade.events.unshift({
      id: createId('EV'),
      timestamp: Date.now(),
      type,
      message,
    });

    activeTrade.events =
      activeTrade.events.slice(
        0,
        30
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

    const opportunity =
      generateOpportunity(
        activeTrade.investment
      );

    if (!Array.isArray(
      activeTrade.opportunities
    )) {
      activeTrade.opportunities = [];
    }

    activeTrade.opportunities.unshift(
      opportunity
    );

    activeTrade.opportunities =
      activeTrade.opportunities.slice(
        0,
        50
      );

    const messages = [
      `${opportunity.asset} spread detected across ${opportunity.buyVenue} and ${opportunity.sellVenue}.`,

      `${opportunity.pair} opportunity passed the spread check.`,

      `Simulated ${opportunity.asset} arbitrage execution completed.`,

      `Execution costs calculated for ${opportunity.asset}.`,

      `Market spread monitored across simulated venues.`,
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
      message,
      'arbitrage'
    );
  }

  function hasActiveTrade() {
    const state = loadState();

    return Boolean(
      state.activeTrade &&
      state.activeTrade.status === 'active'
    );
  }

  function validateAmount(amount) {
    const numeric =
      Number(amount);

    if (!Number.isFinite(numeric)) {
      return {
        valid: false,
        message:
          'Enter a valid investment amount.',
      };
    }

    if (numeric <= 0) {
      return {
        valid: false,
        message:
          'Investment amount must be greater than zero.',
      };
    }

    return {
      valid: true,
      amount: Number(
        numeric.toFixed(2)
      ),
    };
  }

  function createCycle(
    planId,
    amount
  ) {
    const state = loadState();

    if (!state.loggedIn) {
      return {
        success: false,
        message:
          'Please sign in before starting a trade.',
      };
    }

    if (hasActiveTrade()) {
      return {
        success: false,
        message:
          'You already have an active trading cycle.',
      };
    }

    const plan = getPlan(planId);
    const validation =
      validateAmount(amount);

    if (!validation.valid) {
      return {
        success: false,
        message:
          validation.message,
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

    const activeTrade = {
      id: createId('TRADE'),

      status: 'active',

      planId: plan.id,
      planName: plan.name,

      durationLabel:
        plan.durationLabel,

      durationMs:
        plan.durationMs,

      targetRoi:
        plan.targetRoi,

      investment,

      projectedProfit,
      projectedBalance,

      realizedProfit: 0,
      currentBalance: investment,

      startTime,
      endTime,

      progress: 0,

      lastEvent:
        'Trading cycle started.',

      events: [
        {
          id: createId('EV'),
          timestamp: startTime,
          type: 'system',
          message:
            'Trading cycle started.',
        },
      ],

      opportunities: [],
    };

    state.selectedPlan =
      plan.id;

    state.activeTrade =
      activeTrade;

    state.balance =
      Number(
        (
          (
            Number(state.balance) ||
            0
          ) +
          investment
        ).toFixed(2)
      );

    state.transactions.unshift({
      id: createId('TX'),

      type:
        'investment',

      status:
        'completed',

      amount:
        investment,

      plan:
        plan.name,

      timestamp:
        startTime,

      description:
        `${plan.name} trading cycle started`,
    });

    saveState(state);

    render();

    dispatch(
      'nexus:trade-started',
      {
        trade:
          activeTrade,
      }
    );

    return {
      success: true,
      trade:
        activeTrade,
    };
  }

  function updateCycleProgress(
    activeTrade
  ) {
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

    activeTrade.realizedProfit =
      Number(
        (
          activeTrade.projectedProfit *
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
    const state = loadState();
    const activeTrade =
      state.activeTrade;

    if (!activeTrade) {
      return;
    }

    if (
      activeTrade.status !==
      'active'
    ) {
      return;
    }

    activeTrade.progress = 1;

    activeTrade.realizedProfit =
      Number(
        activeTrade.projectedProfit
      ) || 0;

    activeTrade.currentBalance =
      Number(
        (
          activeTrade.investment +
          activeTrade.realizedProfit
        ).toFixed(2)
      );

    activeTrade.status =
      'completed';

    activeTrade.completedAt =
      Date.now();

    addEvent(
      activeTrade,
      'Trading cycle completed.',
      'system'
    );

    state.balance =
      activeTrade.currentBalance;

    state.tradeHistory.unshift({
      id:
        activeTrade.id,

      planId:
        activeTrade.planId,

      planName:
        activeTrade.planName,

      investment:
        activeTrade.investment,

      targetRoi:
        activeTrade.targetRoi,

      profit:
        activeTrade.realizedProfit,

      finalBalance:
        activeTrade.currentBalance,

      startTime:
        activeTrade.startTime,

      endTime:
        activeTrade.endTime,

      completedAt:
        activeTrade.completedAt,

      status:
        'completed',
    });

    state.transactions.unshift({
      id: createId('TX'),

      type:
        'trade_result',

      status:
        'completed',

      amount:
        activeTrade.realizedProfit,

      plan:
        activeTrade.planName,

      timestamp:
        Date.now(),

      description:
        `${activeTrade.planName} trading cycle completed`,
    });

    saveState(state);

    render();

    dispatch(
      'nexus:trade-completed',
      {
        trade:
          activeTrade,
      }
    );
  }

  function engineTick() {
    const state = loadState();
    const activeTrade =
      state.activeTrade;

    if (
      !activeTrade ||
      activeTrade.status !==
        'active'
    ) {
      return;
    }

    updateCycleProgress(
      activeTrade
    );

    const remaining =
      activeTrade.endTime -
      Date.now();

    if (remaining <= 0) {
      completeCycle();
      return;
    }

    if (Math.random() < 0.65) {
      addOpportunity(
        activeTrade
      );
    }

    saveState(state);

    render();
  }

  function updateCountdown() {
    const state = loadState();
    const activeTrade =
      state.activeTrade;

    const countdownNodes =
      document.querySelectorAll(
        '[data-trade-countdown]'
      );

    const progressNodes =
      document.querySelectorAll(
        '[data-trade-progress]'
      );

    if (
      !activeTrade ||
      activeTrade.status !==
        'active'
    ) {
      countdownNodes.forEach(
        (node) => {
          node.textContent =
            'No active cycle';
        }
      );

      progressNodes.forEach(
        (node) => {
          node.style.width =
            '0%';
        }
      );

      return;
    }

    const remaining =
      Math.max(
        0,
        activeTrade.endTime -
          Date.now()
      );

    const progress =
      activeTrade.durationMs > 0
        ? clamp(
            (
              activeTrade.durationMs -
              remaining
            ) /
              activeTrade.durationMs,
            0,
            1
          )
        : 1;

    countdownNodes.forEach(
      (node) => {
        node.textContent =
          formatDuration(
            remaining
          );
      }
    );

    progressNodes.forEach(
      (node) => {
        node.style.width =
          `${(
            progress *
            100
          ).toFixed(1)}%`;

        node.setAttribute(
          'aria-valuenow',
          String(
            (
              progress *
              100
            ).toFixed(1)
          )
        );
      }
    );

    if (remaining <= 0) {
      completeCycle();
    }
  }

  function renderPlans() {
    const state = loadState();
    const selected =
      state.selectedPlan ||
      'daily';

    document
      .querySelectorAll(
        '[data-plan-card]'
      )
      .forEach(
        (card) => {
          const planId =
            card.dataset.planCard;

          const isSelected =
            planId ===
            selected;

          card.classList.toggle(
            'selected',
            isSelected
          );

          card.setAttribute(
            'aria-selected',
            String(
              isSelected
            )
          );
        }
      );

    const select =
      document.querySelector(
        '[data-plan-select]'
      );

    if (select) {
      select.value =
        selected;
    }

    const plan =
      getPlan(selected);

    document
      .querySelectorAll(
        '[data-selected-plan]'
      )
      .forEach(
        (node) => {
          node.textContent =
            plan.name;
        }
      );

    document
      .querySelectorAll(
        '[data-plan-duration]'
      )
      .forEach(
        (node) => {
          node.textContent =
            plan.durationLabel;
        }
      );

    document
      .querySelectorAll(
        '[data-plan-roi]'
      )
      .forEach(
        (node) => {
          node.textContent =
            formatPercent(
              plan.targetRoi
            );
        }
      );
  }

  function renderBalance() {
    const state =
      loadState();

    document
      .querySelectorAll(
        '[data-simulated-balance]'
      )
      .forEach(
        (node) => {
          node.textContent =
            formatMoney(
              state.balance
            );
        }
      );

    const active =
      state.activeTrade;

    document
      .querySelectorAll(
        '[data-active-investment]'
      )
      .forEach(
        (node) => {
          node.textContent =
            active
              ? formatMoney(
                  active.investment
                )
              : '$0.00';
        }
      );

    document
      .querySelectorAll(
        '[data-projected-profit]'
      )
      .forEach(
        (node) => {
          node.textContent =
            active
              ? formatMoney(
                  active.projectedProfit
                )
              : '$0.00';
        }
      );

    document
      .querySelectorAll(
        '[data-current-simulated-profit]'
      )
      .forEach(
        (node) => {
          node.textContent =
            active
              ? formatMoney(
                  active.realizedProfit
                )
              : '$0.00';
        }
      );

    document
      .querySelectorAll(
        '[data-current-simulated-balance]'
      )
      .forEach(
        (node) => {
          node.textContent =
            active
              ? formatMoney(
                  active.currentBalance
                )
              : '$0.00';
        }
      );
  }

  function renderActiveTrade() {
    const state =
      loadState();

    const active =
      state.activeTrade;

    document
      .querySelectorAll(
        '[data-trade-status]'
      )
      .forEach(
        (node) => {
          node.textContent =
            active
              ? active.status ===
                'active'
                ? 'Trading'
                : 'Completed'
              : 'Ready';
        }
      );

    document
      .querySelectorAll(
        '[data-trade-id]'
      )
      .forEach(
        (node) => {
          node.textContent =
            active?.id ||
            '—';
        }
      );

    document
      .querySelectorAll(
        '[data-trade-plan]'
      )
      .forEach(
        (node) => {
          node.textContent =
            active?.planName ||
            '—';
        }
      );

    document
      .querySelectorAll(
        '[data-trade-investment]'
      )
      .forEach(
        (node) => {
          node.textContent =
            active
              ? formatMoney(
                  active.investment
                )
              : '$0.00';
        }
      );

    document
      .querySelectorAll(
        '[data-trade-roi]'
      )
      .forEach(
        (node) => {
          node.textContent =
            active
              ? formatPercent(
                  active.targetRoi
                )
              : '—';
        }
      );

    document
      .querySelectorAll(
        '[data-trade-start]'
      )
      .forEach(
        (node) => {
          node.textContent =
            active
              ? formatDate(
                  active.startTime
                )
              : '—';
        }
      );

    document
      .querySelectorAll(
        '[data-trade-end]'
      )
      .forEach(
        (node) => {
          node.textContent =
            active
              ? formatDate(
                  active.endTime
                )
              : '—';
        }
      );

    document
      .querySelectorAll(
        '[data-trade-last-event]'
      )
      .forEach(
        (node) => {
          node.textContent =
            active?.lastEvent ||
            'Ready to begin trading.';
        }
      );
  }

  function renderHistory() {
    const state =
      loadState();

    const history =
      Array.isArray(
        state.tradeHistory
      )
        ? state.tradeHistory.slice(
            0,
            10
          )
        : [];

    document
      .querySelectorAll(
        '[data-trade-history]'
      )
      .forEach(
        (container) => {
          container.innerHTML =
            '';

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
              'No completed trades yet.';

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
                  'strong'
                );

              title.textContent =
                `${trade.planName} Trade`;

              const profit =
                document.createElement(
                  'span'
                );

              profit.textContent =
                `+${formatMoney(
                  trade.profit
                )}`;

              const meta =
                document.createElement(
                  'small'
                );

              meta.textContent =
                `${formatDate(
                  trade.completedAt
                )} · ${formatPercent(
                  trade.targetRoi
                )}`;

              row.append(
                title,
                profit,
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

    document
      .querySelectorAll(
        '[data-trading-activity]'
      )
      .forEach(
        (container) => {
          container.innerHTML =
            '';

          if (
            events.length ===
            0
          ) {
            const empty =
              document.createElement(
                'div'
              );

            empty.className =
              'empty-state';

            empty.textContent =
              'Trading activity will appear here.';

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

  function render() {
    renderPlans();
    renderBalance();
    renderActiveTrade();
    renderHistory();
    renderActivity();
    updateCountdown();

    dispatch(
      'nexus:trading-rendered',
      {
        state:
          loadState(),
      }
    );
  }

  function showMessage(message) {
    const targets = [
      '#tradeError',
      '[data-trade-message]',
    ];

    let displayed = false;

    targets.forEach(
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

              displayed = true;
            }
          );
      }
    );

    if (!displayed) {
      console.info(
        `NEXUS: ${message}`
      );
    }
  }

  function handleStartTrade(
    event
  ) {
    event?.preventDefault();

    const select =
      document.querySelector(
        '[data-plan-select]'
      );

    const selectedCard =
      document.querySelector(
        '[data-plan-card].selected'
      );

    const amountInput =
      document.querySelector(
        '[data-trade-amount]'
      );

    const planId =
      select?.value ||
      selectedCard?.dataset.planCard ||
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

    if (amountInput) {
      amountInput.value =
        '';
    }

    showMessage(
      'Trading cycle started successfully.'
    );
  }

  function handlePlanSelect(
    card
  ) {
    const planId =
      card.dataset.planCard;

    if (!PLANS[planId]) {
      return;
    }

    const state =
      loadState();

    state.selectedPlan =
      planId;

    saveState(state);

    document
      .querySelectorAll(
        '[data-plan-card]'
      )
      .forEach(
        (item) => {
          const active =
            item.dataset.planCard ===
            planId;

          item.classList.toggle(
            'selected',
            active
          );

          item.setAttribute(
            'aria-selected',
            String(active)
          );
        }
      );

    const select =
      document.querySelector(
        '[data-plan-select]'
      );

    if (select) {
      select.value =
        planId;
    }

    renderPlans();
  }

  function cancelTrade() {
    const state =
      loadState();

    const active =
      state.activeTrade;

    if (
      !active ||
      active.status !==
        'active'
    ) {
      showMessage(
        'There is no active trade to cancel.'
      );

      return;
    }

    /*
     * Simulation-only cancellation.
     * No real funds are involved.
     */
    active.status =
      'cancelled';

    active.cancelledAt =
      Date.now();

    active.realizedProfit =
      0;

    addEvent(
      active,
      'Trading cycle cancelled.',
      'system'
    );

    saveState(state);

    render();

    showMessage(
      'Trading cycle cancelled.'
    );
  }

  function bindEvents() {
    document
      .querySelectorAll(
        '[data-plan-card]'
      )
      .forEach(
        (card) => {
          if (
            card.dataset.bound ===
            'true'
          ) {
            return;
          }

          card.dataset.bound =
            'true';

          card.addEventListener(
            'click',
            () =>
              handlePlanSelect(
                card
              )
          );
        }
      );

    document
      .querySelectorAll(
        '[data-start-trade]'
      )
      .forEach(
        (button) => {
          if (
            button.dataset.bound ===
            'true'
          ) {
            return;
          }

          button.dataset.bound =
            'true';

          button.addEventListener(
            'click',
            handleStartTrade
          );
        }
      );

    document
      .querySelectorAll(
        '[data-cancel-trade]'
      )
      .forEach(
        (button) => {
          if (
            button.dataset.bound ===
            'true'
          ) {
            return;
          }

          button.dataset.bound =
            'true';

          button.addEventListener(
            'click',
            cancelTrade
          );
        }
      );

    document
      .querySelectorAll(
        '[data-plan-select]'
      )
      .forEach(
        (select) => {
          if (
            select.dataset.bound ===
            'true'
          ) {
            return;
          }

          select.dataset.bound =
            'true';

          select.addEventListener(
            'change',
            () => {
              handlePlanSelect(
                {
                  dataset: {
                    planCard:
                      select.value,
                  },
                }
              );
            }
          );
        }
      );
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
            detail,
          }
        )
      );
    } catch (error) {
      console.debug(
        'NEXUS event skipped.',
        error
      );
    }
  }

  function startEngine() {
    if (engineTimer) {
      return;
    }

    engineTimer =
      window.setInterval(
        engineTick,
        8000
      );
  }

  function startCountdown() {
    if (countdownTimer) {
      return;
    }

    countdownTimer =
      window.setInterval(
        updateCountdown,
        1000
      );
  }

  function stop() {
    if (engineTimer) {
      window.clearInterval(
        engineTimer
      );

      engineTimer = null;
    }

    if (countdownTimer) {
      window.clearInterval(
        countdownTimer
      );

      countdownTimer = null;
    }
  }

  function init() {
    const state =
      loadState();

    if (!state.loggedIn) {
      render();
      return;
    }

    bindEvents();
    startEngine();
    startCountdown();
    render();
  }

  window.NexusTrading = {
    plans: clone(PLANS),
    markets: clone(MARKETS),

    loadState,
    saveState,

    getPlan,
    hasActiveTrade,

    createCycle,
    completeCycle,

    render,

    formatMoney,
    formatPercent,
    formatDate,
    formatDuration,

    stop,
  };

  if (
    document.readyState ===
    'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      init,
      {
        once: true,
      }
    );
  } else {
    init();
  }
})();
