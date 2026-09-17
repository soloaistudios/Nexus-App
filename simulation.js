'use strict';

/*
 * NEXUS Simulation Engine
 * ------------------------
 * Browser-only simulation engine.
 *
 * Responsibilities:
 * - Generate fictional market prices
 * - Detect fictional arbitrage spreads
 * - Calculate simulated fees/slippage
 * - Generate trading activity
 * - Update active-cycle display
 * - Simulated deposits
 * - Simulated withdrawals
 *
 * No real exchange API is connected.
 * No real cryptocurrency is transferred.
 */

(() => {
  const ENGINE_INTERVAL = 3500;

  const ASSETS = [
    {
      symbol: 'BTC',
      name: 'Bitcoin',
      basePrice: 104250,
      decimals: 2,
    },

    {
      symbol: 'ETH',
      name: 'Ethereum',
      basePrice: 3920,
      decimals: 2,
    },

    {
      symbol: 'SOL',
      name: 'Solana',
      basePrice: 146,
      decimals: 2,
    },

    {
      symbol: 'USDT',
      name: 'Tether',
      basePrice: 1,
      decimals: 4,
    },

    {
      symbol: 'USDC',
      name: 'USD Coin',
      basePrice: 1,
      decimals: 4,
    },
  ];

  const VENUES = [
    'Nexus Exchange A',
    'Nexus Exchange B',
    'Nexus Exchange C',
  ];

  const marketState = new Map();

  let engineTimer = null;

  function getStorage() {
    return window.NexusStorage || null;
  }

  function getState() {
    const storage = getStorage();

    if (storage?.get) {
      return storage.get();
    }

    return {
      loggedIn: false,
      balance: 0,
      activeTrade: null,
      transactions: [],
    };
  }

  function saveState(state) {
    const storage = getStorage();

    if (storage?.set) {
      return storage.set(state);
    }

    try {
      localStorage.setItem(
        'nexusSimulatorState',
        JSON.stringify(state)
      );

      return true;
    } catch (error) {
      console.warn(
        'NEXUS simulation: unable to save state.',
        error
      );

      return false;
    }
  }

  function randomBetween(min, max) {
    return (
      min +
      Math.random() * (max - min)
    );
  }

  function round(
    value,
    decimals = 2
  ) {
    const multiplier =
      10 ** decimals;

    return (
      Math.round(
        value * multiplier
      ) / multiplier
    );
  }

  function clamp(
    value,
    min,
    max
  ) {
    return Math.min(
      Math.max(value, min),
      max
    );
  }

  function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.floor(
      Math.random() * 1000000
    )}`;
  }

  function formatMoney(amount) {
    const value =
      Number(amount) || 0;

    try {
      return new Intl.NumberFormat(
        'en-US',
        {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }
      ).format(value);
    } catch {
      return `$${value.toFixed(2)}`;
    }
  }

  function formatPercent(decimal) {
    return `${(
      (Number(decimal) || 0) *
      100
    ).toFixed(2)}%`;
  }

  function initializeMarkets() {
    if (marketState.size > 0) {
      return;
    }

    ASSETS.forEach(
      (asset) => {
        const prices = {};

        VENUES.forEach(
          (venue) => {
            const variation =
              asset.symbol === 'USDT' ||
              asset.symbol === 'USDC'
                ? randomBetween(
                    -0.001,
                    0.001
                  )
                : randomBetween(
                    -0.006,
                    0.006
                  );

            let price =
              asset.basePrice *
              (1 + variation);

            if (
              asset.symbol === 'USDT' ||
              asset.symbol === 'USDC'
            ) {
              price = clamp(
                price,
                0.995,
                1.005
              );
            }

            prices[venue] =
              round(
                price,
                asset.decimals
              );
          }
        );

        marketState.set(
          asset.symbol,
          {
            ...asset,
            prices,
          }
        );
      }
    );
  }

  function updateMarketPrices() {
    initializeMarkets();

    marketState.forEach(
      (market) => {
        const stablecoin =
          market.symbol === 'USDT' ||
          market.symbol === 'USDC';

        const volatility =
          stablecoin
            ? 0.0007
            : 0.0018;

        Object.keys(
          market.prices
        ).forEach(
          (venue) => {
            const current =
              Number(
                market.prices[venue]
              ) ||
              market.basePrice;

            let next =
              current *
              (
                1 +
                randomBetween(
                  -volatility,
                  volatility
                )
              );

            if (stablecoin) {
              next = clamp(
                next,
                0.995,
                1.005
              );
            }

            market.prices[venue] =
              round(
                next,
                market.decimals
              );
          }
        );
      }
    );

    updateMarketUI();

    dispatch(
      'nexus:market-updated',
      {
        markets:
          getMarketSnapshot(),
      }
    );
  }

  function getMarketSnapshot() {
    initializeMarkets();

    return Array.from(
      marketState.values()
    ).map(
      (market) => ({
        symbol:
          market.symbol,

        name:
          market.name,

        prices: {
          ...market.prices,
        },
      })
    );
  }

  function findBestOpportunity() {
    initializeMarkets();

    let best =
      null;

    marketState.forEach(
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

            const buyVenue =
              priceA <= priceB
                ? venueA
                : venueB;

            const sellVenue =
              priceA <= priceB
                ? venueB
                : venueA;

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

                pair:
                  `${market.symbol}/USDT`,

                buyVenue,

                sellVenue,

                buyPrice,

                sellPrice,

                grossSpread,
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
    if (!opportunity) {
      return null;
    }

    const amount =
      Number(capital) || 0;

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return null;
    }

    const tradingFee =
      randomBetween(
        0.0004,
        0.0012
      );

    const slippage =
      randomBetween(
        0.00008,
        0.00055
      );

    const executionCost =
      randomBetween(
        0.00002,
        0.00018
      );

    const totalCostRate =
      tradingFee +
      slippage +
      executionCost;

    const grossProfit =
      amount *
      opportunity.grossSpread;

    const totalCosts =
      amount *
      totalCostRate;

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
          totalCostRate
      );

    return {
      id:
        createId('ARB'),

      timestamp:
        Date.now(),

      asset:
        opportunity.asset,

      assetName:
        opportunity.assetName,

      pair:
        opportunity.pair,

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
        'completed',
    };
  }

  function createEvent(
    message,
    type = 'market'
  ) {
    return {
      id:
        createId('ACT'),

      timestamp:
        Date.now(),

      type,

      message,
    };
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
      activeTrade.events = [];
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
  }

  function generateActivity(
    activeTrade
  ) {
    if (!activeTrade) {
      return;
    }

    const opportunity =
      findBestOpportunity();

    if (!opportunity) {
      appendEvent(
        activeTrade,
        createEvent(
          'Scanning simulated markets for arbitrage spreads.'
        )
      );

      return;
    }

    const result =
      calculateOpportunity(
        opportunity,
        activeTrade.investment
      );

    if (!result) {
      return;
    }

    appendOpportunity(
      activeTrade,
      result
    );

    const messages = [
      `${result.asset} spread detected across ${result.buyVenue} and ${result.sellVenue}.`,

      `${result.pair} opportunity passed the simulated spread check.`,

      `Simulated arbitrage execution completed for ${result.asset}.`,

      `Execution fees and slippage calculated for ${result.asset}.`,

      `Monitoring ${result.pair} across simulated venues.`,
    ];

    const message =
      messages[
        Math.floor(
          Math.random() *
          messages.length
        )
      ];

    appendEvent(
      activeTrade,
      createEvent(
        message,
        'arbitrage'
      )
    );
  }

  function updateActiveTrade() {
    const state =
      getState();

    const activeTrade =
      state.activeTrade;

    if (
      !activeTrade ||
      activeTrade.status !==
        'active'
    ) {
      return;
    }

    const currentTime =
      Date.now();

    const elapsed =
      clamp(
        currentTime -
          activeTrade.startTime,
        0,
        activeTrade.durationMs
      );

    const progress =
      activeTrade.durationMs > 0
        ? clamp(
            elapsed /
              activeTrade.durationMs,
            0,
            1
          )
        : 1;

    activeTrade.progress =
      progress;

    activeTrade.realizedProfit =
      Number(
        (
          (
            Number(
              activeTrade.projectedProfit
            ) || 0
          ) *
          progress
        ).toFixed(2)
      );

    activeTrade.currentBalance =
      Number(
        (
          (
            Number(
              activeTrade.investment
            ) || 0
          ) +
          activeTrade.realizedProfit
        ).toFixed(2)
      );

    if (
      Math.random() <
      0.68
    ) {
      generateActivity(
        activeTrade
      );
    }

    saveState(state);

    updateActiveTradeUI();

    dispatch(
      'nexus:simulation-tick',
      {
        trade:
          activeTrade,
      }
    );

    if (
      currentTime >=
      activeTrade.endTime
    ) {
      completeCycle();
    }
  }

  function completeCycle() {
    const state =
      getState();

    const activeTrade =
      state.activeTrade;

    if (
      !activeTrade ||
      activeTrade.status !==
        'active'
    ) {
      return;
    }

    activeTrade.progress =
      1;

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

    appendEvent(
      activeTrade,
      createEvent(
        'Trading cycle completed.',
        'system'
      )
    );

    state.balance =
      activeTrade.currentBalance;

    if (
      !Array.isArray(
        state.tradeHistory
      )
    ) {
      state.tradeHistory = [];
    }

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

    if (
      !Array.isArray(
        state.transactions
      )
    ) {
      state.transactions = [];
    }

    state.transactions.unshift({
      id:
        createId('TX'),

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
        `${activeTrade.planName} cycle completed`,
    });

    saveState(state);

    updateActiveTradeUI();

    updateBalanceUI();

    dispatch(
      'nexus:trade-completed',
      {
        trade:
          activeTrade,
      }
    );
  }

  function simulateDeposit(
    amount
  ) {
    const state =
      getState();

    if (!state.loggedIn) {
      return {
        success: false,
        message:
          'Sign in before making a simulated deposit.',
      };
    }

    const numeric =
      Number(amount);

    if (
      !Number.isFinite(
        numeric
      ) ||
      numeric <= 0
    ) {
      return {
        success: false,
        message:
          'Enter a valid deposit amount.',
      };
    }

    const value =
      Number(
        numeric.toFixed(2)
      );

    state.balance =
      Number(
        (
          (
            Number(
              state.balance
            ) || 0
          ) +
          value
        ).toFixed(2)
      );

    if (
      !Array.isArray(
        state.transactions
      )
    ) {
      state.transactions = [];
    }

    state.transactions.unshift({
      id:
        createId('TX'),

      type:
        'deposit',

      status:
        'completed',

      amount:
        value,

      timestamp:
        Date.now(),

      description:
        'Deposit credited',
    });

    saveState(state);

    updateBalanceUI();

    dispatch(
      'nexus:balance-updated',
      {
        balance:
          state.balance,

        reason:
          'deposit',
      }
    );

    return {
      success: true,
      balance:
        state.balance,
    };
  }

  function simulateWithdrawal(
    amount,
    address
  ) {
    const state =
      getState();

    if (!state.loggedIn) {
      return {
        success: false,
        message:
          'Sign in before making a withdrawal.',
      };
    }

    const numeric =
      Number(amount);

    const destination =
      String(
        address || ''
      ).trim();

    if (
      !Number.isFinite(
        numeric
      ) ||
      numeric <= 0
    ) {
      return {
        success: false,
        message:
          'Enter a valid withdrawal amount.',
      };
    }

    if (!destination) {
      return {
        success: false,
        message:
          'Enter a withdrawal address.',
      };
    }

    const value =
      Number(
        numeric.toFixed(2)
      );

    const balance =
      Number(
        state.balance
      ) || 0;

    if (value > balance) {
      return {
        success: false,
        message:
          'Withdrawal exceeds your available balance.',
      };
    }

    state.balance =
      Number(
        (
          balance -
          value
        ).toFixed(2)
      );

    if (
      !Array.isArray(
        state.transactions
      )
    ) {
      state.transactions = [];
    }

    state.transactions.unshift({
      id:
        createId('TX'),

      type:
        'withdrawal',

      status:
        'completed',

      amount:
        value,

      address:
        destination,

      timestamp:
        Date.now(),

      description:
        'Withdrawal processed',
    });

    saveState(state);

    updateBalanceUI();

    dispatch(
      'nexus:balance-updated',
      {
        balance:
          state.balance,

        reason:
          'withdrawal',
      }
    );

    return {
      success: true,
      balance:
        state.balance,
    };
  }

  function updateBalanceUI() {
    const state =
      getState();

    document
      .querySelectorAll(
        '[data-simulated-balance]'
      )
      .forEach(
        (element) => {
          element.textContent =
            formatMoney(
              state.balance
            );
        }
      );
  }

  function updateActiveTradeUI() {
    const state =
      getState();

    const activeTrade =
      state.activeTrade;

    document
      .querySelectorAll(
        '[data-live-simulation]'
      )
      .forEach(
        (element) => {
          element.textContent =
            activeTrade?.status ===
              'active'
              ? 'Trading'
              : 'Ready';
        }
      );

    document
      .querySelectorAll(
        '[data-simulation-event]'
      )
      .forEach(
        (element) => {
          element.textContent =
            activeTrade?.lastEvent ||
            'Scanning simulated markets.';
        }
      );
  }

  function updateMarketUI() {
    const best =
      findBestOpportunity();

    document
      .querySelectorAll(
        '[data-best-asset]'
      )
      .forEach(
        (element) => {
          element.textContent =
            best?.asset ||
            'Scanning';
        }
      );

    document
      .querySelectorAll(
        '[data-best-spread]'
      )
      .forEach(
        (element) => {
          element.textContent =
            best
              ? formatPercent(
                  best.grossSpread
                )
              : '—';
        }
      );

    document
      .querySelectorAll(
        '[data-market-symbol]'
      )
      .forEach(
        (element) => {
          const symbol =
            element.dataset.marketSymbol;

          const venue =
            element.dataset.marketVenue;

          const market =
            marketState.get(
              symbol
            );

          if (
            market &&
            venue &&
            market.prices[
              venue
            ] !== undefined
          ) {
            element.textContent =
              formatMoney(
                market.prices[
                  venue
                ]
              );
          }
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

              showResult(
                result
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

              const amountInput =
                form.querySelector(
                  '[data-withdrawal-amount]'
                );

              const addressInput =
                form.querySelector(
                  '[data-withdrawal-address]'
                );

              const result =
                simulateWithdrawal(
                  amountInput?.value,
                  addressInput?.value
                );

              showResult(
                result
              );

              if (
                result.success
              ) {
                if (amountInput) {
                  amountInput.value =
                    '';
                }

                if (addressInput) {
                  addressInput.value =
                    '';
                }
              }
            }
          );
        }
      );
  }

  function showResult(result) {
    const message =
      result?.message ||
      (
        result?.success
          ? 'Action completed.'
          : 'Action could not be completed.'
      );

    if (
      window.NexusApp?.toast
    ) {
      window.NexusApp.toast(
        message
      );

      return;
    }

    console.info(
      `NEXUS: ${message}`
    );
  }

  function bindEvents() {
    bindDepositForms();
    bindWithdrawalForms();

    window.addEventListener(
      'nexus:trade-started',
      () => {
        updateActiveTradeUI();
      }
    );

    window.addEventListener(
      'nexus:trade-completed',
      () => {
        updateActiveTradeUI();
        updateBalanceUI();
      }
    );
  }

  function start() {
    if (engineTimer) {
      return;
    }

    initializeMarkets();

    engineTimer =
      window.setInterval(
        () => {
          updateMarketPrices();
          updateActiveTrade();
        },
        ENGINE_INTERVAL
      );

    updateMarketPrices();
    updateActiveTrade();
  }

  function stop() {
    if (!engineTimer) {
      return;
    }

    window.clearInterval(
      engineTimer
    );

    engineTimer = null;
  }

  function render() {
    initializeMarkets();
    updateBalanceUI();
    updateActiveTradeUI();
    updateMarketUI();
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
        'NEXUS simulation event skipped.',
        error
      );
    }
  }

  function init() {
    bindEvents();
    render();
    start();
  }

  window.NexusSimulation = {
    start,
    stop,

    render,

    loadState:
      getState,

    saveState,

    getMarkets:
      getMarketSnapshot,

    findBestOpportunity,

    calculateOpportunity,

    simulateDeposit,

    simulateWithdrawal,

    formatMoney,

    formatPercent,
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
