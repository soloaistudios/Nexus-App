'use strict';

/*
 * NEXUS App Shell
 * ---------------
 * Handles application-wide UI orchestration.
 *
 * Responsibilities:
 * - Authentication/app visibility
 * - Bottom navigation
 * - Hamburger drawer
 * - Modal controls
 * - Quick actions
 * - Deposit / withdrawal modal flow
 * - Trade modal flow
 * - Toast notifications
 * - Balance refresh
 * - Global UI state
 *
 * Financial activity remains browser-local.
 */

(() => {
  const $ = (id) => document.getElementById(id);

  const SELECTORS = {
    authScreen: 'authScreen',
    appShell: 'appShell',
    drawer: 'sideDrawer',
    drawerBackdrop: 'drawerBackdrop',
    depositModal: 'depositModal',
    withdrawalModal: 'withdrawalModal',
    tradeModal: 'tradeModal',
  };

  function getState() {
    if (
      window.NexusStorage?.get
    ) {
      return NexusStorage.get();
    }

    try {
      const raw =
        localStorage.getItem(
          'nexusSimulatorState'
        );

      return raw
        ? JSON.parse(raw)
        : null;
    } catch (error) {
      console.warn(
        'NEXUS app: unable to load state.',
        error
      );

      return null;
    }
  }

  function saveState(state) {
    if (
      window.NexusStorage?.set
    ) {
      return NexusStorage.set(
        state
      );
    }

    try {
      localStorage.setItem(
        'nexusSimulatorState',
        JSON.stringify(state)
      );

      return true;
    } catch (error) {
      console.warn(
        'NEXUS app: unable to save state.',
        error
      );

      return false;
    }
  }

  function showElement(id) {
    const element = $(id);

    if (!element) {
      return;
    }

    element.classList.remove(
      'hidden'
    );

    element.setAttribute(
      'aria-hidden',
      'false'
    );
  }

  function hideElement(id) {
    const element = $(id);

    if (!element) {
      return;
    }

    element.classList.add(
      'hidden'
    );

    element.setAttribute(
      'aria-hidden',
      'true'
    );
  }

  function toast(message) {
    const wrapper =
      $('toastWrap');

    if (!wrapper) {
      console.info(
        `NEXUS: ${message}`
      );

      return;
    }

    const element =
      document.createElement(
        'div'
      );

    element.className =
      'toast';

    element.textContent =
      message;

    wrapper.appendChild(
      element
    );

    window.setTimeout(
      () => {
        element.remove();
      },
      3000
    );
  }

  function showAuth() {
    hideElement(
      SELECTORS.appShell
    );

    showElement(
      SELECTORS.authScreen
    );
  }

  function showApp() {
    hideElement(
      SELECTORS.authScreen
    );

    showElement(
      SELECTORS.appShell
    );
  }

  function enterApp(
    isNewAccount = false
  ) {
    const state =
      getState();

    if (!state) {
      showAuth();
      return;
    }

    state.loggedIn = true;

    if (
      isNewAccount
    ) {
      state.firstRun = true;
      state.tourSeen = false;
      state.tourStep = 0;
    }

    saveState(
      state
    );

    showApp();

    refreshUI();

    dispatch(
      'nexus:auth-updated',
      {
        loggedIn: true,
        firstRun:
          Boolean(
            isNewAccount
          ),
      }
    );

    if (
      isNewAccount &&
      window.NexusOnboarding
    ) {
      window.setTimeout(
        () => {
          NexusOnboarding.openVerification();
        },
        500
      );
    }
  }

  function initializeAuthState() {
    const state =
      getState();

    if (
      state?.loggedIn
    ) {
      showApp();
      return;
    }

    showAuth();
  }

  function getViews() {
    return document.querySelectorAll(
      '[data-view]'
    );
  }

  function setActiveView(
    viewName
  ) {
    if (!viewName) {
      return;
    }

    getViews().forEach(
      (view) => {
        const active =
          view.dataset.view ===
          viewName;

        view.classList.toggle(
          'active',
          active
        );

        view.classList.toggle(
          'hidden',
          !active
        );

        view.setAttribute(
          'aria-hidden',
          String(!active)
        );
      }
    );

    document
      .querySelectorAll(
        '[data-nav]'
      )
      .forEach(
        (button) => {
          const active =
            button.dataset.nav ===
            viewName;

          button.classList.toggle(
            'active',
            active
          );

          button.setAttribute(
            'aria-current',
            active
              ? 'page'
              : 'false'
          );
        }
      );

    closeDrawer();

    dispatch(
      'nexus:view-changed',
      {
        view:
          viewName,
      }
    );
  }

  function navigate(
    viewName
  ) {
    const state =
      getState();

    if (
      !state?.loggedIn
    ) {
      showAuth();
      return;
    }

    setActiveView(
      viewName
    );

    refreshUI();
  }

  function bindNavigation() {
    document
      .querySelectorAll(
        '[data-nav]'
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
            () => {
              navigate(
                button.dataset.nav
              );
            }
          );
        }
      );
  }

  function openDrawer() {
    showElement(
      SELECTORS.drawer
    );

    showElement(
      SELECTORS.drawerBackdrop
    );

    document.body.classList.add(
      'drawer-open'
    );
  }

  function closeDrawer() {
    hideElement(
      SELECTORS.drawer
    );

    hideElement(
      SELECTORS.drawerBackdrop
    );

    document.body.classList.remove(
      'drawer-open'
    );
  }

  function bindDrawer() {
    document
      .querySelectorAll(
        '[data-open-drawer]'
      )
      .forEach(
        (button) => {
          button.addEventListener(
            'click',
            openDrawer
          );
        }
      );

    document
      .querySelectorAll(
        '[data-close-drawer]'
      )
      .forEach(
        (button) => {
          button.addEventListener(
            'click',
            closeDrawer
          );
        }
      );

    $(SELECTORS.drawerBackdrop)
      ?.addEventListener(
        'click',
        closeDrawer
      );
  }

  function openModal(id) {
    if (!$(id)) {
      return;
    }

    showElement(id);

    document.body.classList.add(
      'modal-open'
    );

    const firstInput =
      $(id).querySelector(
        'input, select, textarea, button'
      );

    window.setTimeout(
      () => {
        firstInput?.focus();
      },
      50
    );
  }

  function closeModal(id) {
    hideElement(id);

    const remaining =
      document.querySelectorAll(
        '.modal:not(.hidden), [role="dialog"]:not(.hidden)'
      );

    if (
      remaining.length ===
      0
    ) {
      document.body.classList.remove(
        'modal-open'
      );
    }
  }

  function bindModalButtons() {
    document
      .querySelectorAll(
        '[data-open-modal]'
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
            () => {
              openModal(
                button.dataset.openModal
              );
            }
          );
        }
      );

    document
      .querySelectorAll(
        '[data-close-modal]'
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
            () => {
              closeModal(
                button.dataset.closeModal
              );
            }
          );
        }
      );

    document
      .querySelectorAll(
        '.modal'
      )
      .forEach(
        (modal) => {
          if (
            modal.dataset.bound ===
            'true'
          ) {
            return;
          }

          modal.dataset.bound =
            'true';

          modal.addEventListener(
            'click',
            (event) => {
              if (
                event.target ===
                modal
              ) {
                closeModal(
                  modal.id
                );
              }
            }
          );
        }
      );
  }

  function openDeposit() {
    openModal(
      SELECTORS.depositModal
    );
  }

  function openWithdrawal() {
    openModal(
      SELECTORS.withdrawalModal
    );
  }

  function openTrade() {
    openModal(
      SELECTORS.tradeModal
    );
  }

  function bindQuickActions() {
    document
      .querySelectorAll(
        '[data-action="deposit"]'
      )
      .forEach(
        (button) => {
          button.addEventListener(
            'click',
            openDeposit
          );
        }
      );

    document
      .querySelectorAll(
        '[data-action="withdraw"]'
      )
      .forEach(
        (button) => {
          button.addEventListener(
            'click',
            openWithdrawal
          );
        }
      );

    document
      .querySelectorAll(
        '[data-action="trade"]'
      )
      .forEach(
        (button) => {
          button.addEventListener(
            'click',
            openTrade
          );
        }
      );
  }

  function updateBalance() {
    const state =
      getState();

    if (!state) {
      return;
    }

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

  function formatMoney(
    amount
  ) {
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

  function updateUserUI() {
    const state =
      getState();

    if (!state) {
      return;
    }

    const user =
      state.user || {};

    document
      .querySelectorAll(
        '[data-user-name]'
      )
      .forEach(
        (element) => {
          element.textContent =
            user.name ||
            'Trader Account';
        }
      );

    document
      .querySelectorAll(
        '[data-user-email]'
      )
      .forEach(
        (element) => {
          element.textContent =
            user.email ||
            '—';
        }
      );

    const initials =
      getInitials(
        user.name
      );

    document
      .querySelectorAll(
        '[data-user-avatar]'
      )
      .forEach(
        (element) => {
          element.textContent =
            initials;
        }
      );

    document
      .querySelectorAll(
        '[data-verification-status]'
      )
      .forEach(
        (element) => {
          const verified =
            Boolean(
              user.verified
            );

          element.textContent =
            verified
              ? 'Verified'
              : 'Not verified';

          element.classList.toggle(
            'verified',
            verified
          );

          element.classList.toggle(
            'unverified',
            !verified
          );
        }
      );
  }

  function getInitials(
    name
  ) {
    const value =
      String(
        name ||
          'Trader Account'
      ).trim();

    if (!value) {
      return 'T';
    }

    const parts =
      value.split(
        /\s+/
      );

    if (
      parts.length ===
      1
    ) {
      return parts[0]
        .charAt(0)
        .toUpperCase();
    }

    return (
      parts[0].charAt(0) +
      parts[
        parts.length - 1
      ].charAt(0)
    ).toUpperCase();
  }

  function refreshUI() {
    updateBalance();
    updateUserUI();

    window.NexusTrading?.render?.();
    window.NexusSimulation?.render?.();
    window.NexusCommunity?.render?.();
    window.NexusProfile?.render?.();
  }

  function bindGlobalEvents() {
    window.addEventListener(
      'nexus:balance-updated',
      updateBalance
    );

    window.addEventListener(
      'nexus:trade-started',
      refreshUI
    );

    window.addEventListener(
      'nexus:trade-completed',
      refreshUI
    );

    window.addEventListener(
      'nexus:profile-updated',
      updateUserUI
    );

    window.addEventListener(
      'nexus:storage-updated',
      refreshUI
    );
  }

  function handleCopyAddress(
    event
  ) {
    const button =
      event.currentTarget;

    const targetId =
      button.dataset.copyTarget;

    const target =
      document.getElementById(
        targetId
      );

    if (!target) {
      toast(
        'Address could not be found.'
      );

      return;
    }

    const text =
      target.value ||
      target.textContent ||
      '';

    if (
      !navigator.clipboard
    ) {
      toast(
        'Copy is not available in this browser.'
      );

      return;
    }

    navigator.clipboard
      .writeText(
        text.trim()
      )
      .then(
        () => {
          toast(
            'Address copied.'
          );
        }
      )
      .catch(
        () => {
          toast(
            'Unable to copy address.'
          );
        }
      );
  }

  function bindCopyButtons() {
    document
      .querySelectorAll(
        '[data-copy-target]'
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
            handleCopyAddress
          );
        }
      );
  }

  function bindKeyboardShortcuts() {
    document.addEventListener(
      'keydown',
      (event) => {
        if (
          event.key !==
          'Escape'
        ) {
          return;
        }

        closeDrawer();

        document
          .querySelectorAll(
            '.modal:not(.hidden)'
          )
          .forEach(
            (modal) => {
              closeModal(
                modal.id
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
        'NEXUS app event skipped.',
        error
      );
    }
  }

  function init() {
    initializeAuthState();

    bindNavigation();
    bindDrawer();
    bindModalButtons();
    bindQuickActions();
    bindCopyButtons();
    bindGlobalEvents();
    bindKeyboardShortcuts();

    refreshUI();
  }

  window.NexusApp = {
    init,

    getState,

    saveState,

    showAuth,

    showApp,

    enterApp,

    navigate,

    openDrawer,

    closeDrawer,

    openModal,

    closeModal,

    openDeposit,

    openWithdrawal,

    openTrade,

    refreshUI,

    toast,
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
