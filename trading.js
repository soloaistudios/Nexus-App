'use strict';

(() => {
  const PLANS = Object.freeze({
    daily: {
      name: 'Daily',
      days: 1,
      roi: 0.25,
    },
    weekly: {
      name: 'Weekly',
      days: 7,
      roi: 1,
    },
    monthly: {
      name: 'Monthly',
      days: 30,
      roi: 3,
    },
    yearly: {
      name: 'Yearly',
      days: 365,
      roi: 5,
    },
  });

  const MARKETS = [
    'BTC/USDT',
    'ETH/USDT',
    'SOL/USDT',
    'USDC/USDT',
  ];

  const VENUES = [
    'NEXUS A',
    'NEXUS B',
    'NEXUS C',
  ];

  const fmt = (number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Number(number) || 0);

  const pct = (number) =>
    `${((Number(number) || 0) * 100).toFixed(0)}%`;

  const getPlan = (id) =>
    PLANS[id] || PLANS.daily;

  const getState = () =>
    NexusStorage.get();

  const money = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  };

  /*
   * Keeps the three balance figures consistent:
   *
   * total balance  = state.balance
   * locked balance = active trade investment while active
   * available      = total - locked
   */
  function syncLedger(state) {
    state.balance = Number(money(state.balance).toFixed(2));

    const activeTrade = state.activeTrade;
    const hasActiveTrade =
      activeTrade && activeTrade.status === 'active';

    if (hasActiveTrade) {
      const locked = Math.max(0, money(activeTrade.investment));

      state.lockedBalance = Number(
        locked.toFixed(2)
      );

      state.availableBalance = Number(
        Math.max(
          0,
          state.balance - locked
        ).toFixed(2)
      );
    } else {
      state.lockedBalance = 0;

      state.availableBalance = Number(
        state.balance.toFixed(2)
      );
    }

    if (!Array.isArray(state.transactions)) {
      state.transactions = [];
    }

    if (!Array.isArray(state.tradeHistory)) {
      state.tradeHistory = [];
    }

    return state;
  }

  function start(planId, amount) {
    const state = getState();

    syncLedger(state);

    if (!state.loggedIn) {
      return {
        ok: false,
        msg: 'Sign in first.',
      };
    }

    if (state.activeTrade?.status === 'active') {
      return {
        ok: false,
        msg: 'A trade cycle is already active.',
      };
    }

    if (!state.user?.verified) {
      return {
        ok: false,
        msg: 'Complete profile verification first.',
      };
    }

    const selectedPlan = getPlan(planId);

    const investment = Number(amount);

    if (!Number.isFinite(investment) || investment <= 0) {
      return {
        ok: false,
        msg: 'Enter a valid amount.',
      };
    }

    const availableBalance =
      money(state.availableBalance);

    if (investment > availableBalance) {
      return {
        ok: false,
        msg: 'Amount exceeds the available balance.',
      };
    }

    const startTime = Date.now();

    const endTime =
      startTime +
      selectedPlan.days * 86_400_000;

    const projectedProfit = Number(
      (
        investment *
        selectedPlan.roi
      ).toFixed(2)
    );

    state.selectedPlan = planId;

    state.activeTrade = {
      id:
        `NX-${startTime.toString(36).toUpperCase()}`,

      planId,

      planName:
        selectedPlan.name,

      investment:
        Number(investment.toFixed(2)),

      targetRoi:
        selectedPlan.roi,

      projectedProfit,

      currentProfit:
        0,

      startTime,

      endTime,

      status:
        'active',

      progress:
        0,

      lastEvent:
        'Scanning simulated market spreads.',

      events: [
        {
          ts: startTime,
          msg:
            'Trading cycle started.',
        },
      ],

      opportunities: [],
    };

    /*
     * Principal stays inside total balance while locked.
     * Only available balance moves down.
     */
    state.lockedBalance =
      Number(investment.toFixed(2));

    state.availableBalance =
      Number(
        Math.max(
          0,
          state.balance - investment
        ).toFixed(2)
      );

    state.transactions.unshift({
      id:
        `TX-${startTime}`,

      type:
        'trade_start',

      amount:
        investment,

      status:
        'completed',

      timestamp:
        startTime,

      description:
        `${selectedPlan.name} trading cycle started`,
    });

    NexusStorage.set(state);

    render();

    return {
      ok: true,
      trade:
        state.activeTrade,
    };
  }

  function completeTrade(
    state,
    trade,
    completedAt
  ) {
    const profit =
      Number(
        money(
          trade.projectedProfit
        ).toFixed(2)
      );

    trade.status =
      'completed';

    trade.progress =
      1;

    trade.currentProfit =
      profit;

    trade.completedAt =
      completedAt;

    trade.lastEvent =
      'Trading cycle completed successfully.';

    /*
     * The investment was never subtracted from
     * total balance, so completion only adds profit.
     * The locked principal is then released.
     */
    state.balance =
      Number(
        (
          money(state.balance) +
          profit
        ).toFixed(2)
      );

    state.lockedBalance =
      0;

    state.availableBalance =
      Number(
        state.balance.toFixed(2)
      );

    state.transactions.unshift({
      id:
        `TX-${completedAt}`,

      type:
        'trade_result',

      amount:
        profit,

      status:
        'completed',

      timestamp:
        completedAt,

      description:
        `${trade.planName} cycle completed`,
    });

    state.tradeHistory.unshift({
      id:
        trade.id,

      planName:
        trade.planName,

      investment:
        trade.investment,

      targetRoi:
        trade.targetRoi,

      profit,

      completedAt,

      status:
        'completed',
    });

    return state;
  }

  function tick() {
    const state =
      getState();

    const trade =
      state.activeTrade;

    if (
      !trade ||
      trade.status !== 'active'
    ) {
      return;
    }

    syncLedger(state);

    const currentTime =
      Date.now();

    const remaining =
      Math.max(
        0,
        money(trade.endTime) -
          currentTime
      );

    const duration =
      money(trade.endTime) -
      money(trade.startTime);

    trade.progress =
      duration > 0
        ? Math.min(
            1,
            Math.max(
              0,
              (
                currentTime -
                money(
                  trade.startTime
                )
              ) /
                duration
            )
          )
        : 1;

    trade.currentProfit =
      Number(
        (
          money(
            trade.projectedProfit
          ) *
          trade.progress
        ).toFixed(2)
      );

    const lastEvent =
      trade.events?.[0];

    const shouldCreateEvent =
      !lastEvent ||
      currentTime -
        money(lastEvent.ts) >
        11_000;

    if (shouldCreateEvent) {
      const pair =
        MARKETS[
          Math.floor(
            Math.random() *
              MARKETS.length
          )
        ];

      const buy =
        VENUES[
          Math.floor(
            Math.random() *
              VENUES.length
          )
        ];

      let sell =
        VENUES[
          Math.floor(
            Math.random() *
              VENUES.length
          )
        ];

      while (sell === buy) {
        sell =
          VENUES[
            Math.floor(
              Math.random() *
                VENUES.length
            )
          ];
      }

      const gross =
        Math.random() *
          0.006 +
        0.002;

      const fees =
        Math.random() *
          0.001 +
        0.0005;

      const net =
        Math.max(
          0,
          gross - fees
        );

      trade.events.unshift({
        ts:
          currentTime,

        msg:
          `${pair} spread detected: ${buy} → ${sell} · net ${pct(net)}.`,
      });

      trade.events =
        trade.events.slice(
          0,
          20
        );

      trade.opportunities.unshift({
        ts:
          currentTime,

        pair,

        buy,

        sell,

        gross,

        fees,

        net,
      });

      trade.opportunities =
        trade.opportunities.slice(
          0,
          20
        );

      trade.lastEvent =
        trade.events[0].msg;
    }

    if (remaining <= 0) {
      completeTrade(
        state,
        trade,
        currentTime
      );
    } else {
      /*
       * During the active cycle the investment
       * remains locked.
       */
      state.lockedBalance =
        Number(
          money(
            trade.investment
          ).toFixed(2)
        );

      state.availableBalance =
        Number(
          Math.max(
            0,
            money(
              state.balance
            ) -
              money(
                trade.investment
              )
          ).toFixed(2)
        );
    }

    NexusStorage.set(state);

    render();
  }

  function render() {
    const state =
      getState();

    syncLedger(state);

    const trade =
      state.activeTrade;

    const selectedPlan =
      getPlan(
        state.selectedPlan
      );

    document
      .querySelectorAll(
        '[data-balance]'
      )
      .forEach(
        (node) => {
          node.textContent =
            fmt(
              state.balance
            );
        }
      );

    document
      .querySelectorAll(
        '[data-available]'
      )
      .forEach(
        (node) => {
          node.textContent =
            fmt(
              state.availableBalance
            );
        }
      );

    document
      .querySelectorAll(
        '[data-locked]'
      )
      .forEach(
        (node) => {
          node.textContent =
            fmt(
              state.lockedBalance
            );
        }
      );

    document
      .querySelectorAll(
        '[data-trade-countdown]'
      )
      .forEach(
        (node) => {
          node.textContent =
            trade &&
            trade.status === 'active'
              ? countdown(
                  money(
                    trade.endTime
                  ) -
                    Date.now()
                )
              : 'No active cycle';
        }
      );

    document
      .querySelectorAll(
        '[data-trade-progress]'
      )
      .forEach(
        (node) => {
          node.style.width =
            `${(
              (
                money(
                  trade?.progress
                ) || 0
              ) *
                100
            ).toFixed(1)}%`;
        }
      );

    document
      .querySelectorAll(
        '[data-trade-status]'
      )
      .forEach(
        (node) => {
          node.textContent =
            trade?.status ===
            'active'
              ? 'Trading'
              : trade?.status ===
                'completed'
                ? 'Completed'
                : 'Ready';
        }
      );

    document
      .querySelectorAll(
        '[data-trade-last-event]'
      )
      .forEach(
        (node) => {
          node.textContent =
            trade?.lastEvent ||
            'Ready to start a trading cycle.';
        }
      );

    document
      .querySelectorAll(
        '[data-trade-investment]'
      )
      .forEach(
        (node) => {
          node.textContent =
            fmt(
              trade?.investment ||
                0
            );
        }
      );

    document
      .querySelectorAll(
        '[data-trade-profit]'
      )
      .forEach(
        (node) => {
          node.textContent =
            fmt(
              trade?.currentProfit ||
                0
            );
        }
      );

    document
      .querySelectorAll(
        '[data-trade-roi]'
      )
      .forEach(
        (node) => {
          node.textContent =
            pct(
              trade?.targetRoi ??
                selectedPlan.roi
            );
        }
      );

    document
      .querySelectorAll(
        '[data-trade-plan]'
      )
      .forEach(
        (node) => {
          node.textContent =
            trade?.planName ||
            selectedPlan.name;
        }
      );

    document
      .querySelectorAll(
        '[data-trade-id]'
      )
      .forEach(
        (node) => {
          node.textContent =
            trade?.id ||
            '—';
        }
      );

    updateStartButton(
      trade
    );

    renderHistory(
      state
    );
  }

  function updateStartButton(
    trade
  ) {
    document
      .querySelectorAll(
        '[data-start-trade]'
      )
      .forEach(
        (button) => {
          const active =
            trade?.status ===
            'active';

          if (
            !button.dataset
              .defaultLabel
          ) {
            button.dataset
              .defaultLabel =
              button.textContent
                .trim() ||
              'Start Trade';
          }

          button.disabled =
            active;

          button.setAttribute(
            'aria-disabled',
            String(active)
          );

          button.textContent =
            active
              ? 'Trade Running…'
              : button.dataset
                  .defaultLabel;
        }
      );
  }

  function renderHistory(
    state
  ) {
    document
      .querySelectorAll(
        '[data-trade-history]'
      )
      .forEach(
        (container) => {
          container.innerHTML =
            '';

          (
            state.tradeHistory ||
            []
          )
            .slice(0, 8)
            .forEach(
              (item) => {
                const row =
                  document.createElement(
                    'div'
                  );

                row.className =
                  'history-row';

                const info =
                  document.createElement(
                    'div'
                  );

                const title =
                  document.createElement(
                    'strong'
                  );

                const date =
                  document.createElement(
                    'span'
                  );

                const profit =
                  document.createElement(
                    'b'
                  );

                title.textContent =
                  item.planName ||
                  'Trade Cycle';

                date.textContent =
                  item.completedAt
                    ? new Date(
                        item.completedAt
                      ).toLocaleDateString()
                    : '—';

                profit.textContent =
                  `+${fmt(
                    item.profit
                  )}`;

                info.append(
                  title,
                  date
                );

                row.append(
                  info,
                  profit
                );

                container.appendChild(
                  row
                );
              }
            );

          if (
            !container.children
              .length
          ) {
            container.innerHTML =
              '<div class="empty-state">No completed cycles yet.</div>';
          }
        }
      );
  }

  function countdown(
    milliseconds
  ) {
    const value =
      Math.max(
        0,
        money(milliseconds)
      );

    const days =
      Math.floor(
        value /
          86_400_000
      );

    const hours =
      Math.floor(
        value /
          3_600_000
      ) % 24;

    const minutes =
      Math.floor(
        value /
          60_000
      ) % 60;

    const seconds =
      Math.floor(
        value /
          1_000
      ) % 60;

    if (days) {
      return `${days}d ${String(
        hours
      ).padStart(
        2,
        '0'
      )}h`;
    }

    return `${String(
      hours
    ).padStart(
      2,
      '0'
    )}:${String(
      minutes
    ).padStart(
      2,
      '0'
    )}:${String(
      seconds
    ).padStart(
      2,
      '0'
    )}`;
  }

  function bind() {
    document
      .querySelectorAll(
        '[data-plan-card]'
      )
      .forEach(
        (card) => {
          card.addEventListener(
            'click',
            () => {
              if (
                NexusStorage.get()
                  .activeTrade
                  ?.status ===
                'active'
              ) {
                window.NexusApp
                  ?.toast?.(
                    'Finish the active trade cycle before selecting another plan.'
                  );

                return;
              }

              document
                .querySelectorAll(
                  '[data-plan-card]'
                )
                .forEach(
                  (item) => {
                    item.classList.remove(
                      'selected'
                    );
                  }
                );

              card.classList.add(
                'selected'
              );

              NexusStorage.update(
                (state) => {
                  state.selectedPlan =
                    card.dataset
                      .planCard;

                  return state;
                }
              );

              renderPlanForm();
            }
          );
        }
      );

    document
      .querySelector(
        '[data-start-trade]'
      )
      ?.addEventListener(
        'click',
        () => {
          const button =
            document.querySelector(
              '[data-start-trade]'
            );

          if (button?.disabled) {
            return;
          }

          const id =
            document.querySelector(
              '[data-plan-select]'
            )?.value ||
            NexusStorage.get()
              .selectedPlan;

          const amount =
            document.querySelector(
              '[data-trade-amount]'
            )?.value;

          const result =
            start(
              id,
              amount
            );

          window.NexusApp
            ?.toast?.(
              result.ok
                ? `Trade cycle started — ${fmt(
                    Number(amount)
                  )} locked.`
                : result.msg
            );
        }
      );

    document
      .querySelector(
        '[data-cancel-trade]'
      )
      ?.addEventListener(
        'click',
        () => {
          window.NexusApp
            ?.toast?.(
              'Active cycle cancellation is disabled in this prototype.'
            );
        }
      );

    renderPlanForm();

    render();

    window.setInterval(
      tick,
      1_000
    );
  }

  function renderPlanForm() {
    const state =
      getState();

    const selectedPlan =
      getPlan(
        state.selectedPlan
      );

    document
      .querySelectorAll(
        '[data-plan-select]'
      )
      .forEach(
        (node) => {
          node.value =
            state.selectedPlan;
        }
      );

    document
      .querySelectorAll(
        '[data-plan-roi-preview]'
      )
      .forEach(
        (node) => {
          node.textContent =
            pct(
              selectedPlan.roi
            );
        }
      );

    document
      .querySelectorAll(
        '[data-plan-duration-preview]'
      )
      .forEach(
        (node) => {
          node.textContent =
            `${selectedPlan.days} day${
              selectedPlan.days ===
              1
                ? ''
                : 's'
            }`;
        }
      );
  }

  window.NexusTrading = {
    PLANS,

    start,

    plan:
      getPlan,

    render,

    fmt,

    pct,

    tick,

    syncLedger,
  };

  if (
    document.readyState ===
    'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      bind,
      {
        once: true,
      }
    );
  } else {
    bind();
  }
})();
