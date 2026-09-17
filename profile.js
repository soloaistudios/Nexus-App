'use strict';

/*
 * NEXUS Profile Module
 * --------------------
 * Handles the account/profile area.
 *
 * Includes:
 * - Profile information
 * - Verification status
 * - Referral / invitation code
 * - Account statistics
 * - Settings
 * - Notifications
 * - Security actions
 * - Transaction history
 * - Edit profile
 * - Sign out
 *
 * Browser-only prototype.
 */

(() => {
  function getStorage() {
    return window.NexusStorage || null;
  }

  function getState() {
    const storage = getStorage();

    if (storage?.get) {
      return storage.get();
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
        'NEXUS profile: unable to load state.',
        error
      );

      return null;
    }
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
        'NEXUS profile: unable to save state.',
        error
      );

      return false;
    }
  }

  function toast(message) {
    if (window.NexusApp?.toast) {
      window.NexusApp.toast(
        message
      );

      return;
    }

    const wrapper =
      document.getElementById(
        'toastWrap'
      );

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

    window.setTimeout(() => {
      element.remove();
    }, 3000);
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
            String(
              value ?? ''
            );
        }
      );
  }

  function getInitials(name) {
    const clean =
      String(
        name ||
          'Trader Account'
      ).trim();

    if (!clean) {
      return 'T';
    }

    const parts =
      clean.split(
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
        timeStyle: 'short',
      }
    ).format(date);
  }

  function renderIdentity() {
    const state =
      getState();

    if (!state) {
      return;
    }

    const user =
      state.user || {};

    setText(
      '[data-profile-name]',
      user.name ||
        'Trader Account'
    );

    setText(
      '[data-profile-email]',
      user.email ||
        '—'
    );

    setText(
      '[data-profile-avatar]',
      getInitials(
        user.name
      )
    );

    setText(
      '[data-profile-initials]',
      getInitials(
        user.name
      )
    );

    setText(
      '[data-profile-invite]',
      user.inviteCode ||
        '—'
    );

    const verified =
      Boolean(
        user.verified
      );

    setText(
      '[data-profile-verification]',
      verified
        ? 'Verified'
        : 'Not verified'
    );

    document
      .querySelectorAll(
        '[data-profile-verification-status]'
      )
      .forEach(
        (element) => {
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

  function renderStats() {
    const state =
      getState();

    if (!state) {
      return;
    }

    const history =
      Array.isArray(
        state.tradeHistory
      )
        ? state.tradeHistory
        : [];

    const transactions =
      Array.isArray(
        state.transactions
      )
        ? state.transactions
        : [];

    const completed =
      history.filter(
        (item) =>
          item.status ===
          'completed'
      );

    const totalProfit =
      completed.reduce(
        (
          total,
          item
        ) =>
          total +
          (
            Number(
              item.profit
            ) || 0
          ),
        0
      );

    const totalDeposits =
      transactions
        .filter(
          (item) =>
            item.type ===
              'deposit' ||
            item.type ===
              'simulated_deposit'
        )
        .reduce(
          (
            total,
            item
          ) =>
            total +
            (
              Number(
                item.amount
              ) || 0
            ),
          0
        );

    const totalWithdrawals =
      transactions
        .filter(
          (item) =>
            item.type ===
              'withdrawal' ||
            item.type ===
              'simulated_withdrawal'
        )
        .reduce(
          (
            total,
            item
          ) =>
            total +
            (
              Number(
                item.amount
              ) || 0
            ),
          0
        );

    setText(
      '[data-profile-balance]',
      formatMoney(
        state.balance
      )
    );

    setText(
      '[data-profile-cycles]',
      completed.length
    );

    setText(
      '[data-profile-profit]',
      formatMoney(
        totalProfit
      )
    );

    setText(
      '[data-profile-deposits]',
      formatMoney(
        totalDeposits
      )
    );

    setText(
      '[data-profile-withdrawals]',
      formatMoney(
        totalWithdrawals
      )
    );
  }

  function renderSettings() {
    const state =
      getState();

    if (!state) {
      return;
    }

    const settings =
      state.settings || {};

    document
      .querySelectorAll(
        '[data-setting-notifications]'
      )
      .forEach(
        (control) => {
          if (
            control.type ===
            'checkbox'
          ) {
            control.checked =
              Boolean(
                settings.notifications
              );
          } else {
            control.setAttribute(
              'aria-pressed',
              String(
                Boolean(
                  settings.notifications
                )
              )
            );
          }
        }
      );

    document
      .querySelectorAll(
        '[data-setting-theme]'
      )
      .forEach(
        (control) => {
          if (
            control.tagName ===
            'SELECT'
          ) {
            control.value =
              settings.dark
                ? 'dark'
                : 'light';
          }
        }
      );

    applyTheme(
      Boolean(
        settings.dark
      )
    );
  }

  function applyTheme(
    dark
  ) {
    document.documentElement.toggleAttribute(
      'data-theme-dark',
      Boolean(dark)
    );

    document.body?.classList.toggle(
      'theme-dark',
      Boolean(dark)
    );
  }

  function updateProfile(
    name
  ) {
    const state =
      getState();

    if (!state?.loggedIn) {
      return {
        success: false,
        message:
          'Sign in before editing your profile.',
      };
    }

    const cleanName =
      String(
        name || ''
      ).trim();

    if (
      cleanName.length <
      2
    ) {
      return {
        success: false,
        message:
          'Enter a valid name.',
      };
    }

    if (
      cleanName.length >
      80
    ) {
      return {
        success: false,
        message:
          'Name must be 80 characters or fewer.',
      };
    }

    state.user = {
      ...state.user,
      name:
        cleanName,
    };

    const saved =
      saveState(
        state
      );

    if (!saved) {
      return {
        success: false,
        message:
          'Unable to save your profile.',
      };
    }

    render();

    dispatch(
      'nexus:profile-updated',
      {
        user:
          state.user,
      }
    );

    return {
      success: true,
    };
  }

  function toggleNotifications(
    enabled
  ) {
    const state =
      getState();

    if (!state) {
      return {
        success: false,
      };
    }

    state.settings =
      state.settings || {};

    state.settings.notifications =
      Boolean(enabled);

    saveState(
      state
    );

    renderSettings();

    dispatch(
      'nexus:settings-updated',
      {
        settings:
          state.settings,
      }
    );

    return {
      success: true,

      enabled:
        state.settings
          .notifications,
    };
  }

  function toggleTheme(
    dark
  ) {
    const state =
      getState();

    if (!state) {
      return {
        success: false,
      };
    }

    state.settings =
      state.settings || {};

    state.settings.dark =
      Boolean(dark);

    saveState(
      state
    );

    applyTheme(
      state.settings.dark
    );

    return {
      success: true,

      dark:
        state.settings.dark,
    };
  }

  function renderTransactions() {
    const state =
      getState();

    if (!state) {
      return;
    }

    const transactions =
      Array.isArray(
        state.transactions
      )
        ? state.transactions.slice(
            0,
            15
          )
        : [];

    document
      .querySelectorAll(
        '[data-profile-transactions]'
      )
      .forEach(
        (container) => {
          container.innerHTML =
            '';

          if (
            transactions.length ===
            0
          ) {
            const empty =
              document.createElement(
                'div'
              );

            empty.className =
              'empty-state';

            empty.textContent =
              'No transactions yet.';

            container.appendChild(
              empty
            );

            return;
          }

          transactions.forEach(
            (transaction) => {
              const row =
                document.createElement(
                  'div'
                );

              row.className =
                'profile-transaction';

              const title =
                document.createElement(
                  'strong'
                );

              title.textContent =
                transaction.description ||
                'Account activity';

              const amount =
                document.createElement(
                  'span'
                );

              const isNegative =
                transaction.type ===
                  'withdrawal' ||
                transaction.type ===
                  'simulated_withdrawal';

              amount.textContent =
                `${isNegative ? '-' : '+'}${formatMoney(
                  transaction.amount
                )}`;

              const meta =
                document.createElement(
                  'small'
                );

              meta.textContent =
                formatDate(
                  transaction.timestamp
                );

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

  function openEditProfile() {
    const state =
      getState();

    const modal =
      document.getElementById(
        'editProfileModal'
      );

    if (!modal) {
      return;
    }

    const input =
      document.getElementById(
        'editProfileName'
      );

    if (input) {
      input.value =
        state?.user?.name ||
        '';
    }

    modal.classList.remove(
      'hidden'
    );

    modal.setAttribute(
      'aria-hidden',
      'false'
    );

    window.setTimeout(
      () => {
        input?.focus();
      },
      50
    );
  }

  function closeEditProfile() {
    const modal =
      document.getElementById(
        'editProfileModal'
      );

    if (!modal) {
      return;
    }

    modal.classList.add(
      'hidden'
    );

    modal.setAttribute(
      'aria-hidden',
      'true'
    );
  }

  function handleEditSubmit(
    event
  ) {
    event.preventDefault();

    const input =
      document.getElementById(
        'editProfileName'
      );

    const result =
      updateProfile(
        input?.value || ''
      );

    if (!result.success) {
      toast(
        result.message
      );

      return;
    }

    closeEditProfile();

    toast(
      'Profile updated successfully.'
    );
  }

  function handleSecurityAction(
    action
  ) {
    const messages = {
      password:
        'Password management is available when a secure production authentication service is connected.',

      sessions:
        'Session management will be handled by the production authentication service.',

      twoFactor:
        'Two-factor authentication is not connected in this prototype.',
    };

    toast(
      messages[action] ||
        'Security settings opened.'
    );
  }

  function getTransactionSummary() {
    const state =
      getState();

    const transactions =
      Array.isArray(
        state?.transactions
      )
        ? state.transactions
        : [];

    return {
      total:
        transactions.length,

      deposits:
        transactions.filter(
          (item) =>
            item.type ===
              'deposit' ||
            item.type ===
              'simulated_deposit'
        ).length,

      withdrawals:
        transactions.filter(
          (item) =>
            item.type ===
              'withdrawal' ||
            item.type ===
              'simulated_withdrawal'
        ).length,

      trades:
        transactions.filter(
          (item) =>
            item.type ===
              'investment' ||
            item.type ===
              'trade_result'
        ).length,
    };
  }

  function signOut() {
    const state =
      getState();

    if (!state) {
      return;
    }

    state.loggedIn =
      false;

    /*
     * The local prototype keeps the
     * demo account data but closes
     * the current session.
     */
    saveState(
      state
    );

    dispatch(
      'nexus:auth-signed-out',
      {}
    );

    window.setTimeout(
      () => {
        window.location.reload();
      },
      100
    );
  }

  function render() {
    renderIdentity();
    renderStats();
    renderSettings();
    renderTransactions();

    dispatch(
      'nexus:profile-rendered',
      {
        state:
          getState(),
      }
    );
  }

  function bindEvents() {
    document
      .querySelectorAll(
        '[data-edit-profile]'
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
            openEditProfile
          );
        }
      );

    document
      .getElementById(
        'editProfileClose'
      )
      ?.addEventListener(
        'click',
        closeEditProfile
      );

    document
      .getElementById(
        'editProfileCancel'
      )
      ?.addEventListener(
        'click',
        closeEditProfile
      );

    document
      .getElementById(
        'editProfileForm'
      )
      ?.addEventListener(
        'submit',
        handleEditSubmit
      );

    document
      .querySelectorAll(
        '[data-setting-notifications]'
      )
      .forEach(
        (control) => {
          if (
            control.dataset.bound ===
            'true'
          ) {
            return;
          }

          control.dataset.bound =
            'true';

          control.addEventListener(
            'change',
            () => {
              if (
                control.type ===
                'checkbox'
              ) {
                toggleNotifications(
                  control.checked
                );
              }
            }
          );
        }
      );

    document
      .querySelectorAll(
        '[data-setting-theme]'
      )
      .forEach(
        (control) => {
          if (
            control.dataset.bound ===
            'true'
          ) {
            return;
          }

          control.dataset.bound =
            'true';

          control.addEventListener(
            'change',
            () => {
              toggleTheme(
                control.value ===
                  'dark'
              );
            }
          );
        }
      );

    document
      .querySelectorAll(
        '[data-security-action]'
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
              handleSecurityAction(
                button.dataset
                  .securityAction
              );
            }
          );
        }
      );

    document
      .querySelectorAll(
        '[data-sign-out]'
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
            signOut
          );
        }
      );

    document
      .getElementById(
        'editProfileModal'
      )
      ?.addEventListener(
        'click',
        (event) => {
          if (
            event.target.id ===
            'editProfileModal'
          ) {
            closeEditProfile();
          }
        }
      );

    window.addEventListener(
      'nexus:balance-updated',
      render
    );

    window.addEventListener(
      'nexus:trade-completed',
      render
    );

    window.addEventListener(
      'nexus:profile-updated',
      render
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
        'NEXUS profile event skipped.',
        error
      );
    }
  }

  function init() {
    bindEvents();
    render();
  }

  window.NexusProfile = {
    init,
    render,
    getState,
    saveState,
    updateProfile,
    toggleNotifications,
    toggleTheme,
    getTransactionSummary,
    openEditProfile,
    closeEditProfile,
    signOut,
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
