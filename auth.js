'use strict';

/* NEXUS Authentication Module
 * Simulation-only authentication flow.
 * Stores prototype session data in localStorage; no real credentials are transmitted.
 */
(function () {
  const STORAGE_KEY = 'nexusSimulatorState';
  const NEEDS_VERIFICATION_KEY = 'nexusNeedsVerification';
  const VALID_INVITES = new Set([
    'NEXUS-7F3K',
    'NEXUS-2026',
    'DEMO-ACCESS'
  ]);

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  const defaultState = {
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
  };

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (!saved) {
        return clone(defaultState);
      }

      const parsed = JSON.parse(saved);

      return {
        ...clone(defaultState),
        ...parsed,

        user: {
          ...clone(defaultState.user),
          ...(parsed.user || {})
        },

        settings: {
          ...clone(defaultState.settings),
          ...(parsed.settings || {})
        },

        tradeHistory: Array.isArray(parsed.tradeHistory)
          ? parsed.tradeHistory
          : [],

        transactions: Array.isArray(parsed.transactions)
          ? parsed.transactions
          : [],

        communityPosts: Array.isArray(parsed.communityPosts)
          ? parsed.communityPosts
          : []
      };
    } catch (error) {
      console.warn(
        'NEXUS auth: unable to read local session.',
        error
      );

      return clone(defaultState);
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
        'NEXUS auth: unable to save local session.',
        error
      );

      return false;
    }
  }

  function showAuthError(message) {
    const node = document.getElementById('authError');

    if (node) {
      node.textContent = message;
      node.classList.remove('hidden');
      return;
    }

    window.alert(message);
  }

  function clearAuthError() {
    const node = document.getElementById('authError');

    if (node) {
      node.textContent = '';
      node.classList.add('hidden');
    }
  }

  function showToast(message) {
    const wrap = document.getElementById('toastWrap');

    if (!wrap) {
      return;
    }

    const node = document.createElement('div');

    node.className = 'toast';
    node.textContent = message;

    wrap.appendChild(node);

    window.setTimeout(() => {
      node.remove();
    }, 3200);
  }

  function switchTo(view) {
    const signin = document.getElementById('signinView');
    const signup = document.getElementById('signupView');

    if (!signin || !signup) {
      return;
    }

    signin.classList.toggle(
      'hidden',
      view !== 'signin'
    );

    signup.classList.toggle(
      'hidden',
      view !== 'signup'
    );

    clearAuthError();
  }

  function setBusy(form, busy) {
    const buttons = form.querySelectorAll(
      'button[type="submit"]'
    );

    buttons.forEach((button) => {
      button.disabled = busy;
      button.setAttribute(
        'aria-busy',
        String(busy)
      );
    });
  }

  function completeSession(state) {
    saveState(state);
    window.location.reload();
  }

  function handleSignIn(event) {
    event.preventDefault();
    clearAuthError();

    const form = event.currentTarget;

    const email =
      document
        .getElementById('signinEmail')
        ?.value
        .trim()
        .toLowerCase() || '';

    const password =
      document
        .getElementById('signinPassword')
        ?.value || '';

    if (!email || !password) {
      showAuthError(
        'Enter your email and password to continue.'
      );
      return;
    }

    setBusy(form, true);

    const state = loadState();

    state.loggedIn = true;

    state.user = {
      ...state.user,
      email,
      name:
        state.user.name ||
        email.split('@')[0] ||
        'Trader Account'
    };

    completeSession(state);
  }

  function handleSignUp(event) {
    event.preventDefault();
    clearAuthError();

    const form = event.currentTarget;

    const name =
      document
        .getElementById('signupName')
        ?.value
        .trim() || '';

    const email =
      document
        .getElementById('signupEmail')
        ?.value
        .trim()
        .toLowerCase() || '';

    const password =
      document
        .getElementById('signupPassword')
        ?.value || '';

    const confirm =
      document
        .getElementById('signupConfirm')
        ?.value || '';

    const invite =
      document
        .getElementById('inviteCode')
        ?.value
        .trim()
        .toUpperCase() || '';

    if (!name) {
      showAuthError(
        'Enter your full name.'
      );
      return;
    }

    if (!email || !email.includes('@')) {
      showAuthError(
        'Enter a valid email address.'
      );
      return;
    }

    if (password.length < 8) {
      showAuthError(
        'Use a password with at least 8 characters.'
      );
      return;
    }

    if (password !== confirm) {
      showAuthError(
        'Passwords do not match.'
      );
      return;
    }

    if (!VALID_INVITES.has(invite)) {
      showAuthError(
        'That invitation code is not valid for this simulation.'
      );
      return;
    }

    setBusy(form, true);

    const base = loadState();

    const state = {
      ...base,

      loggedIn: true,

      user: {
        name,
        email,
        verified: false,
        inviteCode: invite
      },

      balance: 0,
      activeTrade: null,
      tradeHistory: [],
      transactions: [],
      tourSeen: false,
      tourStep: 0
    };

    try {
      localStorage.setItem(
        NEEDS_VERIFICATION_KEY,
        '1'
      );
    } catch (error) {
      console.warn(
        'NEXUS auth: unable to store verification flag.',
        error
      );
    }

    completeSession(state);
  }

  function init() {
    const showSignupBtn =
      document.getElementById(
        'showSignupBtn'
      );

    const showSigninBtn =
      document.getElementById(
        'showSigninBtn'
      );

    const signinForm =
      document.getElementById(
        'signinForm'
      );

    const signupForm =
      document.getElementById(
        'signupForm'
      );

    const forgotBtn =
      document.getElementById(
        'forgotBtn'
      );

    showSignupBtn?.addEventListener(
      'click',
      () => switchTo('signup')
    );

    showSigninBtn?.addEventListener(
      'click',
      () => switchTo('signin')
    );

    signinForm?.addEventListener(
      'submit',
      handleSignIn
    );

    signupForm?.addEventListener(
      'submit',
      handleSignUp
    );

    forgotBtn?.addEventListener(
      'click',
      () => {
        showToast(
          'Prototype password reset: connect a secure auth provider for production.'
        );
      }
    );

    switchTo('signin');
  }

  window.NexusAuth = Object.freeze({
    loadState,
    saveState,

    validInvitationCodes:
      Object.freeze(
        Array.from(VALID_INVITES)
      ),

    needsVerificationKey:
      NEEDS_VERIFICATION_KEY
  });

  if (
    document.readyState === 'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      init,
      { once: true }
    );
  } else {
    init();
  }
})();
