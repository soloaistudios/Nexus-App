'use strict';

(() => {
  const INVITES = new Set([
    'NEXUS-7F3K',
    'NEXUS-2026',
    'DEMO-ACCESS'
  ]);

  const $ = (id) => document.getElementById(id);

  const toast = (message) => {
    window.NexusApp?.toast?.(message);
  };

  function show(which) {
    $('signinView')?.classList.toggle(
      'hidden',
      which !== 'signin'
    );

    $('signupView')?.classList.toggle(
      'hidden',
      which !== 'signup'
    );

    $('authError')?.classList.add('hidden');
  }

  function error(message) {
    const element = $('authError');

    if (element) {
      element.textContent = message;
      element.classList.remove('hidden');
    } else {
      toast(message);
    }
  }

  function init() {
    $('showSignupBtn')?.addEventListener(
      'click',
      () => show('signup')
    );

    $('showSigninBtn')?.addEventListener(
      'click',
      () => show('signin')
    );

    $('forgotBtn')?.addEventListener(
      'click',
      () => {
        toast(
          'Password recovery is not connected in this browser-only prototype.'
        );
      }
    );

    $('signinForm')?.addEventListener(
      'submit',
      (event) => {
        event.preventDefault();

        const email =
          $('signinEmail')
            ?.value
            .trim()
            .toLowerCase() || '';

        const password =
          $('signinPassword')
            ?.value || '';

        if (!email || !password) {
          error(
            'Enter your email and password.'
          );

          return;
        }

        const state =
          NexusStorage.get();

        state.loggedIn = true;
        state.firstRun = false;

        state.user.email = email;

        if (
          !state.user.name ||
          state.user.name === 'Trader Account'
        ) {
          state.user.name =
            email.split('@')[0] ||
            'Trader Account';
        }

        NexusStorage.set(state);

        window.NexusApp?.enterApp();
      }
    );

    $('signupForm')?.addEventListener(
      'submit',
      (event) => {
        event.preventDefault();

        const name =
          $('signupName')
            ?.value
            .trim() || '';

        const email =
          $('signupEmail')
            ?.value
            .trim()
            .toLowerCase() || '';

        const password =
          $('signupPassword')
            ?.value || '';

        const confirmPassword =
          $('signupConfirm')
            ?.value || '';

        const invite =
          $('inviteCode')
            ?.value
            .trim()
            .toUpperCase() || '';

        const terms =
          $('termsCheck')?.checked;

        if (!name) {
          error(
            'Enter your full name.'
          );

          return;
        }

        if (!email.includes('@')) {
          error(
            'Enter a valid email.'
          );

          return;
        }

        if (password.length < 8) {
          error(
            'Password must be at least 8 characters.'
          );

          return;
        }

        if (
          password !==
          confirmPassword
        ) {
          error(
            'Passwords do not match.'
          );

          return;
        }

        if (!INVITES.has(invite)) {
          error(
            'Invalid invitation code.'
          );

          return;
        }

        if (!terms) {
          error(
            'Accept the access notice to continue.'
          );

          return;
        }

        const state =
          NexusStorage.get();

        state.loggedIn = true;
        state.firstRun = true;

        state.user = {
          name,
          email,
          verified: false,
          inviteCode: invite
        };

        NexusStorage.set(state);

        window.NexusApp?.enterApp(true);
      }
    );

    show('signin');
  }

  window.NexusAuth = {
    init,
    validInvites: [
      ...INVITES
    ]
  };

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
