'use strict';

/*
 * NEXUS Profile Module
 * --------------------
 * Simulation-only account/profile management.
 *
 * Handles:
 * - Profile display
 * - Profile editing
 * - Verification status
 * - Referral/invitation code
 * - Security preferences
 * - Notification preferences
 * - Settings
 * - Activity summaries
 * - Sign out
 *
 * No real identity verification or financial
 * account operations are performed.
 */

(function () {
  const STORAGE_KEY = 'nexusSimulatorState';

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

  function clone(value) {
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
        return clone(
          DEFAULT_STATE
        );
      }

      const parsed =
        JSON.parse(raw);

      return {
        ...clone(
          DEFAULT_STATE
        ),

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
        'NEXUS profile: could not load state.',
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
        'NEXUS profile: could not save state.',
        error
      );

      return false;
    }
  }

  function getUser() {
    return loadState().user;
  }

  function getInitials(name) {
    const safeName =
      String(
        name ||
          'Trader Account'
      ).trim();

    if (!safeName) {
      return 'T';
    }

    const parts =
      safeName.split(/\s+/);

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
    try {
      return new Intl.NumberFormat(
        'en-US',
        {
          style: 'currency',
          currency: 'USD',
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

  function setText(
    selector,
    value
  ) {
    document
      .querySelectorAll(
        selector
      )
      .forEach(
        (node) => {
          node.textContent =
            String(
              value ?? ''
            );
        }
      );
  }

  function showToast(message) {
    const wrap =
      document.getElementById(
        'toastWrap'
      );

    if (!wrap) {
      console.info(
        `NEXUS profile: ${message}`
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

    wrap.appendChild(
      toast
    );

    window.setTimeout(
      () => toast.remove(),
      3000
    );
  }

  function getVerificationStatus(
    user
  ) {
    return user?.verified
      ? 'Verified'
      : 'Not verified';
  }

  function getVerificationClass(
    user
  ) {
    return user?.verified
      ? 'verified'
      : 'unverified';
  }

  function renderIdentity() {
    const state =
      loadState();

    const user =
      state.user;

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
      '[data-profile-verification]',
      getVerificationStatus(
        user
      )
    );

    setText(
      '[data-profile-invite]',
      user.inviteCode ||
        '—'
    );

    document
      .querySelectorAll(
        '[data-profile-verification-status]'
      )
      .forEach(
        (node) => {
          node.textContent =
            getVerificationStatus(
              user
            );

          node.classList.remove(
            'verified',
            'unverified'
          );

          node.classList.add(
            getVerificationClass(
              user
            )
          );
        }
      );
  }

  function renderStats() {
    const state =
      loadState();

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

    const deposits =
      transactions
        .filter(
          (item) =>
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

    const withdrawals =
      transactions
        .filter(
          (item) =>
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
        deposits
      )
    );

    setText(
      '[data-profile-withdrawals]',
      formatMoney(
        withdrawals
      )
    );
  }

  function renderSettings() {
    const state =
      loadState();

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
                state.settings
                  ?.notifications
              );
          } else {
            control.setAttribute(
              'aria-pressed',
              String(
                Boolean(
                  state.settings
                    ?.notifications
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
            control.value
          ) {
            control.value =
              state.settings
                ?.dark
                ? 'dark'
                : 'light';
          }
        }
      );

    applyTheme(
      Boolean(
        state.settings
          ?.dark
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
      loadState();

    if (
      !state.loggedIn
    ) {
      return {
        success: false,
        message:
          'Sign in before editing your profile.'
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
          'Enter a valid name.'
      };
    }

    if (
      cleanName.length >
      80
    ) {
      return {
        success: false,
        message:
          'Name must be 80 characters or fewer.'
      };
    }

    state.user.name =
      cleanName;

    saveState(
      state
    );

    render();

    dispatch(
      'nexus:profile-updated',
      {
        user:
          state.user
      }
    );

    return {
      success: true
    };
  }

  function toggleNotifications(
    enabled
  ) {
    const state =
      loadState();

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
          state.settings
      }
    );

    return {
      success: true,
      enabled:
        state.settings
          .notifications
    };
  }

  function toggleTheme(
    dark
  ) {
    const state =
      loadState();

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

    dispatch(
      'nexus:settings-updated',
      {
        settings:
          state.settings
      }
    );

    return {
      success: true,
      dark:
        state.settings.dark
    };
  }

  function getTransactionSummary() {
    const state =
      loadState();

    const transactions =
      Array.isArray(
        state.transactions
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
            'simulated_deposit'
        ).length,

      withdrawals:
        transactions.filter(
          (item) =>
            item.type ===
            'simulated_withdrawal'
        ).length,

      trading:
        transactions.filter(
          (item) =>
            item.type ===
              'simulated_investment' ||
            item.type ===
              'simulated_result'
        ).length
    };
  }

  function renderTransactions() {
    const state =
      loadState();

    const transactions =
      Array.isArray(
        state.transactions
      )
        ? state.transactions.slice(
            0,
            12
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
              'No simulated transactions yet.';

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
                'Simulation activity';

              const amount =
                document.createElement(
                  'span'
                );

              amount.textContent =
                formatMoney(
                  transaction.amount
                );

              const meta =
                document.createElement(
                  'small'
                );

              meta.textContent =
                new Intl.DateTimeFormat(
                  'en-US',
                  {
                    dateStyle:
                      'medium',
                    timeStyle:
                      'short'
                  }
                ).format(
                  new Date(
                    transaction.timestamp
                  )
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

  function render() {
    renderIdentity();
    renderStats();
    renderSettings();
    renderTransactions();

    dispatch(
      'nexus:profile-rendered',
      {
        state:
          loadState()
      }
    );
  }

  function openEditProfile() {
    const state =
      loadState();

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
        state.user.name ||
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

    if (
      result.success
    ) {
      closeEditProfile();

      showToast(
        'Profile updated.'
      );

      return;
    }

    showToast(
      result.message
    );
  }

  function signOut() {
    const state =
      loadState();

    state.loggedIn =
      false;

    state.activeTrade =
      null;

    /*
     * Keep simulated account data in place
     * so the prototype can be signed back into
     * without destroying the demo history.
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

  function handleSecurityAction(
    action
  ) {
    const messages = {
      password:
        'Prototype only: connect a secure authentication provider before enabling password changes.',

      sessions:
        'Prototype only: secure session management should be handled by the production authentication provider.',

      twoFactor:
        'Prototype only: two-factor authentication is not connected in simulation mode.'
    };

    showToast(
      messages[
        action
      ] ||
        'Security action is available in the prototype.'
    );
  }

  function bindEvents() {
    document
      .querySelectorAll(
        '[data-edit-profile]'
      )
      .forEach(
        (button) => {
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
          control.addEventListener(
            'change',
            () => {
              toggleNotifications(
                control.type ===
                  'checkbox'
                  ? control.checked
                  : control.getAttribute(
                      'aria-pressed'
                    ) !==
                    'true'
              );
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

    document.addEventListener(
      'keydown',
      (event) => {
        if (
          event.key !==
          'Escape'
        ) {
          return;
        }

        const modal =
          document.getElementById(
            'editProfileModal'
          );

        if (
          modal &&
          !modal.classList.contains(
            'hidden'
          )
        ) {
          closeEditProfile();
        }
      }
    );

    window.addEventListener(
      'nexus:trade-completed',
      render
    );

    window.addEventListener(
      'nexus:balance-updated',
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
            detail
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

  window.NexusProfile =
    Object.freeze({
      loadState,
      saveState,
      getUser,
      updateProfile,
      toggleNotifications,
      toggleTheme,
      getTransactionSummary,
      render,
      openEditProfile,
      closeEditProfile,
      signOut
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
