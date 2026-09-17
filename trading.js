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

  const fmt = (number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(number) || 0);
  };

  const pct = (number) => {
    return `${(
      (Number(number) || 0) * 100
    ).toFixed(0)}%`;
  };

  const money = (value) => {
    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : 0;
  };

  const getPlan = (id) => {
    return PLANS[id] || PLANS.daily;
  };

  const getState = () => {
    return NexusStorage.get();
  };

  /*
   * Keeps the account ledger consistent.
   *
   * Total balance:
   *   state.balance
   *
   * Locked balance:
   *   active trade investment
   *
   * Available balance:
   *   total - locked
   */
  function syncLedger(state) {
    state.balance = Number(
      money(state.balance).toFixed(2)
    );

    const trade = state.activeTrade;

    if (
      trade &&
      trade.status === 'active'
    ) {
      const locked = Math.max(
        0,
        money(trade.investment)
      );

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

  /*
   * Start a new trading cycle.
   */
  function start(planId, amount) {
    const state = getState();

    syncLedger(state);

    if (!state.loggedIn) {
      return {
        ok: false,
        msg: 'Sign in first.',
      };
    }

    if (
      state.activeTrade &&
      state.activeTrade.status === 'active'
    ) {
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

    if (
      !Number.isFinite(investment) ||
      investment <= 0
    ) {
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
      selectedPlan.days *
        86_400_000;

    const projectedProfit = Number(
      (
        investment *
        selectedPlan.roi
      ).toFixed(2)
    );

    state.selectedPlan = planId;

    state.activeTrade = {
      id:
        `NX-${startTime
          .toString(36)
          .toUpperCase()}`,

      planId,

      planName:
        selectedPlan.name,

      investment:
        Number(
          investment.toFixed(2)
        ),

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
        'Scanning market spreads.',

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
     * Immediately create the first
     * arbitrage opportunity.
     */
    addMarketOpportunity(
      state.activeTrade,
      startTime
    );

    /*
     * Lock the investment.
     */
    state.lockedBalance =
      Number(
        investment.toFixed(2)
      );

    state.availableBalance =
      Number(
        Math.max(
          0,
          state.balance -
            investment
        ).toFixed(2)
      );

    /*
     * Record start transaction.
     */
    state.transactions.unshift({
      id:
        `TX-START-${startTime}`,

      type:
        'trade_start',

      amount:
        Number(
          investment.toFixed(2)
        ),

      status:
        'completed',

      timestamp:
        startTime,

      description:
        `${selectedPlan.name} trading cycle started`,

      tradeId:
        state.activeTrade.id,
    });

    NexusStorage.set(state);

    render();

    return {
      ok: true,

      trade:
        state.activeTrade,
    };
  }

  /*
   * Create a new arbitrage activity item.
   */
  function addMarketOpportunity(
    trade,
    timestamp
  ) {
    if (!trade) {
      return;
    }

    if (!Array.isArray(trade.events)) {
      trade.events = [];
    }

    if (
      !Array.isArray(
        trade.opportunities
      )
    ) {
      trade.opportunities = [];
    }

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

    const message =
      `${pair} spread detected: ${buy} → ${sell} · net ${pct(net)}.`;

    trade.events.unshift({
      ts:
        timestamp,

      msg:
        message,
    });

    trade.events =
      trade.events.slice(
        0,
        20
      );

    trade.opportunities.unshift({
      ts:
        timestamp,

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
      message;
  }

  /*
   * Complete an active cycle.
   *
   * Only profit is added to the total
   * because the principal remained part
   * of the total balance while locked.
   */
  function completeTrade(
    state,
    trade,
    completedAt
  ) {
    const profit = Number(
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
      'Trading cycle completed.';

    /*
     * Add profit to total balance.
     */
    state.balance = Number(
      (
        money(state.balance) +
        profit
      ).toFixed(2)
    );

    /*
     * Release principal.
     */
    state.lockedBalance =
      0;

    state.availableBalance = Number(
      state.balance.toFixed(2)
    );

    /*
     * Record result.
     */
    state.transactions.unshift({
      id:
        `TX-RESULT-${completedAt}`,

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

      tradeId:
        trade.id,
    });

    /*
     * Add to completed trade history.
     */
    state.tradeHistory.unshift({
      id:
        trade.id,

      planId:
        trade.planId,

      planName:
        trade.planName,

      investment:
        trade.investment,

      targetRoi:
        trade.targetRoi,

      profit:
        profit,

      completedAt:
        completedAt,

      status:
        'completed',
    });

    return state;
  }

  /*
   * Stop an active trade.
   *
   * The principal is released.
   * No profit is credited.
   */
  function stopTrade() {
    const state = getState();

    const trade =
      state.activeTrade;

    if (
      !trade ||
      trade.status !== 'active'
    ) {
      return {
        ok: false,
        msg:
          'There is no active trade to stop.',
      };
    }

    const stoppedAt =
      Date.now();

    const releasedAmount =
      Number(
        money(
          trade.investment
        ).toFixed(2)
      );

    trade.status =
      'stopped';

    trade.stoppedAt =
      stoppedAt;

    trade.stopReason =
      'Cycle stopped by user.';

    trade.currentProfit =
      0;

    trade.lastEvent =
      'Trading cycle stopped. Funds released.';

    /*
     * Release the locked funds.
     */
    state.lockedBalance =
      0;

    state.availableBalance =
      Number(
        money(
          state.balance
        ).toFixed(2)
      );

    /*
     * Record the stop.
     */
    state.transactions.unshift({
      id:
        `TX-STOP-${stoppedAt}`,

      type:
        'trade_stop',

      amount:
        releasedAmount,

      status:
        'completed',

      timestamp:
        stoppedAt,

      description:
        `${trade.planName} cycle stopped by user`,

      tradeId:
        trade.id,
    });

    /*
     * Keep the stopped cycle visible
     * in the history, but with zero
     * credited profit.
     */
    state.tradeHistory.unshift({
      id:
        trade.id,

      planId:
        trade.planId,

      planName:
        trade.planName,

      investment:
        trade.investment,

      targetRoi:
        trade.targetRoi,

      profit:
        0,

      stoppedAt:
        stoppedAt,

      status:
        'stopped',
    });

    NexusStorage.set(state);

    render();

    window.NexusApp?.toast?.(
      `Trade stopped. ${fmt(
        releasedAmount
      )} released to available balance.`
    );

    return {
      ok: true,

      amount:
        releasedAmount,
    };
  }

  /*
   * Main active-trade timer.
   */
  function tick() {
    const state =
      getState();

    const trade =
      state.activeTrade;

    if (
      !trade ||
      trade.status !== 'active'
    ) {
      render();

      return;
    }

    const currentTime =
      Date.now();

    const startTime =
      money(
        trade.startTime
      );

    const endTime =
      money(
        trade.endTime
      );

    const duration =
      endTime -
      startTime;

    const elapsed =
      currentTime -
      startTime;

    const remaining =
      Math.max(
        0,
        endTime -
          currentTime
      );

    /*
     * Update progress.
     */
    trade.progress =
      duration > 0
        ? Math.min(
            1,
            Math.max(
              0,
              elapsed /
                duration
            )
          )
        : 1;

    /*
     * Update current profit.
     */
    trade.currentProfit =
      Number(
        (
          money(
            trade.projectedProfit
          ) *
          trade.progress
        ).toFixed(2)
      );

    /*
     * Generate new arbitrage activity
     * approximately every five seconds.
     */
    const latestEvent =
      trade.events?.[0];

    const shouldCreateEvent =
      !latestEvent ||
      currentTime -
        money(
          latestEvent.ts
        ) >=
        5_000;

    if (
      shouldCreateEvent
    ) {
      addMarketOpportunity(
        trade,
        currentTime
      );
    }

    /*
     * Complete once countdown reaches zero.
     */
    if (
      remaining <= 0
    ) {
      completeTrade(
        state,
        trade,
        currentTime
      );

      NexusStorage.set(
        state
      );

      render();

      window.NexusApp?.toast?.(
        `Trade cycle completed. Profit +${fmt(
          trade.projectedProfit
        )}.`
      );

      return;
    }

    /*
     * Keep principal locked while active.
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

    NexusStorage.set(
      state
    );

    render();
  }

  /*
   * Update all trading UI.
   */
  function render() {
    const state =
      getState();

    syncLedger(
      state
    );

    const trade =
      state.activeTrade;

    const selectedPlan =
      getPlan(
        state.selectedPlan
      );

    /*
     * During an active cycle the
     * displayed total includes the
     * current accrued profit.
     */
    const displayBalance =
      trade?.status === 'active'
        ? Number(
            (
              money(
                state.balance
              ) +
              money(
                trade.currentProfit
              )
            ).toFixed(2)
          )
        : money(
            state.balance
          );

    document
      .querySelectorAll(
        '[data-balance]'
      )
      .forEach(
        (node) => {
          node.textContent =
            fmt(
              displayBalance
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
            trade?.status === 'active'
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
          const progress =
            Math.min(
              1,
              Math.max(
                0,
                money(
                  trade?.progress
                )
              )
            );

          node.style.width =
            `${(
              progress *
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
          if (
            trade?.status ===
            'active'
          ) {
            node.textContent =
              'Trading';
          } else if (
            trade?.status ===
            'completed'
          ) {
            node.textContent =
              'Completed';
          } else if (
            trade?.status ===
            'stopped'
          ) {
            node.textContent =
              'Stopped';
          } else {
            node.textContent =
              'Ready';
          }
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
              trade?.status ===
                'stopped'
                ? 0
                : trade?.currentProfit ||
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

    updateStopButton(
      trade
    );

    renderActivity(
      state
    );

    renderHistory(
      state
    );
  }

  /*
   * Start button state.
   */
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
              'Start trading cycle';
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

  /*
   * Stop button state.
   */
  function updateStopButton(
    trade
  ) {
    document
      .querySelectorAll(
        '[data-cancel-trade]'
      )
      .forEach(
        (button) => {
          const active =
            trade?.status ===
            'active';

          button.classList.toggle(
            'hidden',
            !active
          );

          button.disabled =
            !active;

          button.textContent =
            'Stop trade';
        }
      );
  }

  /*
   * Render live arbitrage activity.
   */
  function renderActivity(
    state
  ) {
    document
      .querySelectorAll(
        '[data-trading-activity]'
      )
      .forEach(
        (container) => {
          const trade =
            state.activeTrade;

          container.innerHTML =
            '';

          if (
            !trade ||
            trade.status !==
              'active'
          ) {
            container.innerHTML =
              '<div class="empty-state">Trading activity will appear when a cycle is active.</div>';

            return;
          }

          const opportunities =
            Array.isArray(
              trade.opportunities
            )
              ? trade.opportunities.slice(
                  0,
                  8
                )
              : [];

          if (
            !opportunities.length
          ) {
            const empty =
              document.createElement(
                'div'
              );

            empty.className =
              'empty-state';

            empty.textContent =
              'Scanning market spreads…';

            container.appendChild(
              empty
            );

            return;
          }

          opportunities.forEach(
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

              const details =
                document.createElement(
                  'span'
                );

              const result =
                document.createElement(
                  'b'
                );

              title.textContent =
                item.pair ||
                'Market spread';

              const time =
                item.ts
                  ? new Date(
                      item.ts
                    ).toLocaleTimeString(
                      [],
                      {
                        hour:
                          '2-digit',

                        minute:
                          '2-digit',

                        second:
                          '2-digit',
                      }
                    )
                  : 'now';

              details.textContent =
                `${
                  item.buy ||
                  'NEXUS A'
                } → ${
                  item.sell ||
                  'NEXUS B'
                } · ${time}`;

              result.textContent =
                `+${pct(
                  item.net ||
                    0
                )}`;

              info.append(
                title,
                details
              );

              row.append(
                info,
                result
              );

              container.appendChild(
                row
              );
            }
          );
        }
      );
  }

  /*
   * Render completed/stopped trades.
   */
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

                const result =
                  document.createElement(
                    'b'
                  );

                title.textContent =
                  item.planName ||
                  'Trade Cycle';

                const timestamp =
                  item.status ===
                  'stopped'
                    ? item.stoppedAt
                    : item.completedAt;

                date.textContent =
                  timestamp
                    ? new Date(
                        timestamp
                      ).toLocaleDateString()
                    : '—';

                if (
                  item.status ===
                  'stopped'
                ) {
                  result.textContent =
                    'Stopped';
                } else {
                  result.textContent =
                    `+${fmt(
                      item.profit
                    )}`;
                }

                info.append(
                  title,
                  date
                );

                row.append(
                  info,
                  result
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

  /*
   * Countdown display.
   */
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

  /*
   * Bind trading controls.
   */
  function bind() {
    /*
     * Plan cards.
     */
    document
      .querySelectorAll(
        '[data-plan-card]'
      )
      .forEach(
        (card) => {
          card.addEventListener(
            'click',
            () => {
              const state =
                NexusStorage.get();

              if (
                state.activeTrade
                  ?.status ===
                'active'
              ) {
                window.NexusApp
                  ?.toast?.(
                    'Finish or stop the active trade before changing plans.'
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
                (current) => {
                  current.selectedPlan =
                    card.dataset
                      .planCard;

                  return current;
                }
              );

              renderPlanForm();
            }
          );
        }
      );

    /*
     * Start trade.
     */
    document
      .querySelectorAll(
        '[data-start-trade]'
      )
      .forEach(
        (button) => {
          button.addEventListener(
            'click',
            () => {
              if (
                button.disabled
              ) {
                return;
              }

              const planId =
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
                  planId,
                  amount
                );

              if (
                result.ok
              ) {
                window.NexusApp
                  ?.toast?.(
                    `Trade cycle started — ${fmt(
                      Number(amount)
                    )} locked.`
                  );
              } else {
                window.NexusApp
                  ?.toast?.(
                    result.msg
                  );
              }
            }
          );
        }
      );

    /*
     * Stop trade.
     */
    document
      .querySelectorAll(
        '[data-cancel-trade]'
      )
      .forEach(
        (button) => {
          button.addEventListener(
            'click',
            () => {
              if (
                button.disabled
              ) {
                return;
              }

              stopTrade();
            }
          );
        }
      );

    /*
     * Initial render.
     */
    renderPlanForm();

    render();

    /*
     * Update once per second.
     */
    window.setInterval(
      tick,
      1_000
    );
  }

  /*
   * Render plan information.
   */
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

  /*
   * Public API.
   */
  window.NexusTrading = {
    PLANS,

    start,

    stop:
      stopTrade,

    plan:
      getPlan,

    render,

    tick,

    fmt,

    pct,

    syncLedger,
  };

  /*
   * Initialize after DOM is ready.
   */
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
