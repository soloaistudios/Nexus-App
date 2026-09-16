'use strict';

/*
 * NEXUS Onboarding Module
 * Simulation-only onboarding, profile verification,
 * welcome flow, and first-time guided tour.
 */

(function () {
  const STORAGE_KEY = 'nexusSimulatorState';
  const NEEDS_VERIFICATION_KEY = 'nexusNeedsVerification';

  const TOUR_STEPS = [
    {
      selector: '[data-tour="home"]',
      title: 'Your Home dashboard',
      text: 'See your simulated balance, active trading cycle, progress, and recent activity from one place.',
      position: 'bottom'
    },
    {
      selector: '[data-tour="quick-actions"]',
      title: 'Quick Actions',
      text: 'Use these shortcuts for simulated deposits, withdrawals, and starting a trade.',
      position: 'bottom'
    },
    {
      selector: '[data-tour="trade"]',
      title: 'Trade',
      text: 'Choose a simulation plan, enter an amount, and follow the arbitrage trading cycle.',
      position: 'top'
    },
    {
      selector: '[data-tour="community"]',
      title: 'Community',
      text: 'Join the private community, read updates, create posts, and interact with other simulated users.',
      position: 'top'
    },
    {
      selector: '[data-tour="profile"]',
      title: 'Profile & Menu',
      text: 'Manage your profile, verification status, security, notifications, settings, and support here.',
      position: 'top'
    }
  ];

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
      const raw = localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        return clone(defaultState);
      }

      const parsed = JSON.parse(raw);

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
        'NEXUS onboarding: unable to load state.',
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
        'NEXUS onboarding: unable to save state.',
        error
      );

      return false;
    }
  }

  function hasElement(id) {
    return Boolean(document.getElementById(id));
  }

  function showElement(id) {
    const element = document.getElementById(id);

    if (element) {
      element.classList.remove('hidden');
      element.setAttribute('aria-hidden', 'false');
    }
  }

  function hideElement(id) {
    const element = document.getElementById(id);

    if (element) {
      element.classList.add('hidden');
      element.setAttribute('aria-hidden', 'true');
    }
  }

  function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
      element.textContent = value;
    }
  }

  function showToast(message) {
    const wrap = document.getElementById('toastWrap');

    if (!wrap) {
      return;
    }

    const toast = document.createElement('div');

    toast.className = 'toast';
    toast.textContent = message;

    wrap.appendChild(toast);

    window.setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  function getVerificationElements() {
    return {
      modal: document.getElementById('verificationModal'),
      close: document.getElementById('verificationClose'),
      start: document.getElementById('startVerificationBtn'),
      skip: document.getElementById('skipVerificationBtn'),
      form: document.getElementById('verificationForm')
    };
  }

  function openVerification() {
    const state = loadState();

    if (!state.loggedIn || state.user.verified) {
      return;
    }

    const elements = getVerificationElements();

    if (!elements.modal) {
      return;
    }

    showElement('verificationModal');

    const input = document.getElementById('verificationName');

    if (input && !input.value) {
      input.value = state.user.name || '';
    }

    const firstInput = elements.modal.querySelector(
      'input, select, textarea, button'
    );

    window.setTimeout(() => {
      firstInput?.focus();
    }, 50);
  }

  function closeVerification() {
    hideElement('verificationModal');
  }

  function completeVerification(event) {
    event.preventDefault();

    const state = loadState();

    if (!state.loggedIn) {
      return;
    }

    const name =
      document.getElementById('verificationName')
        ?.value
        .trim() || state.user.name;

    const country =
      document.getElementById('verificationCountry')
        ?.value
        .trim() || '';

    const accepted =
      document.getElementById('verificationTerms')
        ?.checked ?? false;

    if (!name) {
      showToast('Enter the name to continue.');
      return;
    }

    if (!country) {
      showToast('Select your country to continue.');
      return;
    }

    if (!accepted) {
      showToast(
        'Accept the simulation verification notice to continue.'
      );
      return;
    }

    state.user = {
      ...state.user,
      name,
      verificationCountry: country,
      verified: true
    };

    state.tourSeen = false;
    state.tourStep = 0;

    saveState(state);

    try {
      localStorage.removeItem(
        NEEDS_VERIFICATION_KEY
      );
    } catch (error) {
      console.warn(
        'NEXUS onboarding: unable to clear verification flag.',
        error
      );
    }

    closeVerification();

    showToast(
      'Profile verification completed.'
    );

    window.setTimeout(() => {
      openTour(true);
    }, 450);
  }

  function skipVerification() {
    const state = loadState();

    /*
     * Skipping does not mark the profile as verified.
     * The user can continue to the app, but financial
     * simulation actions can require verification.
     */

    closeVerification();

    saveState(state);

    showToast(
      'Verification can be completed later from Profile.'
    );

    window.setTimeout(() => {
      openTour(true);
    }, 350);
  }

  function clearTourHighlight() {
    document
      .querySelectorAll('.nexus-tour-highlight')
      .forEach((element) => {
        element.classList.remove(
          'nexus-tour-highlight'
        );
      });

    document
      .querySelectorAll('[data-tour-active="true"]')
      .forEach((element) => {
        element.removeAttribute(
          'data-tour-active'
        );
      });
  }

  function getTourElements() {
    return {
      modal:
        document.getElementById('tourModal'),

      backdrop:
        document.getElementById('tourBackdrop'),

      title:
        document.getElementById('tourTitle'),

      text:
        document.getElementById('tourText'),

      next:
        document.getElementById('tourNext'),

      back:
        document.getElementById('tourBack'),

      skip:
        document.getElementById('tourSkip'),

      step:
        document.getElementById('tourStep'),

      progress:
        document.getElementById('tourProgress')
    };
  }

  function findTourTarget(step) {
    if (!step || !step.selector) {
      return null;
    }

    try {
      return document.querySelector(
        step.selector
      );
    } catch (error) {
      return null;
    }
  }

  function updateTourPosition(target, modal) {
    if (!target || !modal) {
      return;
    }

    /*
     * Prefer CSS classes/data attributes so the app's
     * responsive stylesheet remains in control.
     */
    modal.dataset.position = 'auto';

    const rect = target.getBoundingClientRect();
    const viewportHeight =
      window.innerHeight ||
      document.documentElement.clientHeight;

    if (rect.top < viewportHeight / 2) {
      modal.dataset.position = 'bottom';
    } else {
      modal.dataset.position = 'top';
    }

    target.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest'
    });
  }

  function renderTourStep() {
    const state = loadState();
    const elements = getTourElements();

    if (!elements.modal) {
      return;
    }

    const total =
      TOUR_STEPS.length;

    let stepIndex =
      Number.isInteger(state.tourStep)
        ? state.tourStep
        : 0;

    stepIndex = Math.min(
      Math.max(stepIndex, 0),
      total - 1
    );

    state.tourStep = stepIndex;
    saveState(state);

    const step =
      TOUR_STEPS[stepIndex];

    clearTourHighlight();

    const target =
      findTourTarget(step);

    if (elements.title) {
      elements.title.textContent =
        step.title;
    }

    if (elements.text) {
      elements.textContent =
        step.text;
    }

    if (elements.step) {
      elements.step.textContent =
        `${stepIndex + 1} of ${total}`;
    }

    if (elements.progress) {
      elements.progress.style.width =
        `${((stepIndex + 1) / total) * 100}%`;
    }

    if (elements.back) {
      elements.back.disabled =
        stepIndex === 0;
    }

    if (elements.next) {
      elements.next.textContent =
        stepIndex === total - 1
          ? 'Finish'
          : 'Next';
    }

    if (target) {
      target.classList.add(
        'nexus-tour-highlight'
      );

      target.setAttribute(
        'data-tour-active',
        'true'
      );

      window.setTimeout(() => {
        updateTourPosition(
          target,
          elements.modal
        );
      }, 40);
    }
  }

  function openTour(force = false) {
    const state = loadState();

    if (!state.loggedIn) {
      return;
    }

    if (state.tourSeen && !force) {
      return;
    }

    const elements = getTourElements();

    if (!elements.modal) {
      return;
    }

    state.tourStep = 0;
    saveState(state);

    showElement('tourModal');

    if (elements.backdrop) {
      showElement('tourBackdrop');
    }

    renderTourStep();

    window.setTimeout(() => {
      elements.next?.focus();
    }, 60);
  }

  function closeTour(markComplete = false) {
    const state = loadState();
    const elements = getTourElements();

    clearTourHighlight();

    hideElement('tourModal');
    hideElement('tourBackdrop');

    if (markComplete) {
      state.tourSeen = true;
      state.tourStep = 0;
      saveState(state);
    }

    elements.modal?.removeAttribute(
      'data-position'
    );
  }

  function nextTourStep() {
    const state = loadState();

    const next =
      Number.isInteger(state.tourStep)
        ? state.tourStep + 1
        : 1;

    if (next >= TOUR_STEPS.length) {
      closeTour(true);

      showToast(
        'You are all set. Welcome to NEXUS.'
      );

      return;
    }

    state.tourStep = next;
    saveState(state);

    renderTourStep();
  }

  function previousTourStep() {
    const state = loadState();

    const previous =
      Number.isInteger(state.tourStep)
        ? state.tourStep - 1
        : 0;

    state.tourStep = Math.max(
      previous,
      0
    );

    saveState(state);

    renderTourStep();
  }

  function maybeStartOnboarding() {
    const state = loadState();

    if (!state.loggedIn) {
      return;
    }

    let needsVerification = false;

    try {
      needsVerification =
        localStorage.getItem(
          NEEDS_VERIFICATION_KEY
        ) === '1';
    } catch (error) {
      needsVerification =
        !state.user.verified;
    }

    if (
      needsVerification &&
      !state.user.verified
    ) {
      window.setTimeout(
        openVerification,
        450
      );

      return;
    }

    if (
      !state.tourSeen
    ) {
      window.setTimeout(
        () => openTour(false),
        700
      );
    }
  }

  function bindEvents() {
    const elements =
      getVerificationElements();

    elements.close?.addEventListener(
      'click',
      closeVerification
    );

    elements.start?.addEventListener(
      'click',
      () => {
        elements.form?.requestSubmit();
      }
    );

    elements.skip?.addEventListener(
      'click',
      skipVerification
    );

    elements.form?.addEventListener(
      'submit',
      completeVerification
    );

    const tour =
      getTourElements();

    tour.next?.addEventListener(
      'click',
      nextTourStep
    );

    tour.back?.addEventListener(
      'click',
      previousTourStep
    );

    tour.skip?.addEventListener(
      'click',
      () => closeTour(false)
    );

    tour.backdrop?.addEventListener(
      'click',
      () => closeTour(false)
    );

    document
      .querySelectorAll(
        '[data-open-verification]'
      )
      .forEach((element) => {
        element.addEventListener(
          'click',
          openVerification
        );
      });

    document
      .querySelectorAll(
        '[data-replay-tour]'
      )
      .forEach((element) => {
        element.addEventListener(
          'click',
          () => openTour(true)
        );
      });

    document.addEventListener(
      'keydown',
      (event) => {
        const tourModal =
          document.getElementById(
            'tourModal'
          );

        const verification =
          document.getElementById(
            'verificationModal'
          );

        if (
          event.key === 'Escape'
        ) {
          if (
            tourModal &&
            !tourModal.classList.contains(
              'hidden'
            )
          ) {
            closeTour(false);
            return;
          }

          if (
            verification &&
            !verification.classList.contains(
              'hidden'
            )
          ) {
            closeVerification();
          }
        }
      }
    );

    window.addEventListener(
      'resize',
      () => {
        const state = loadState();

        if (
          state.loggedIn &&
          !state.tourSeen
        ) {
          const elements =
            getTourElements();

          if (
            elements.modal &&
            !elements.modal.classList.contains(
              'hidden'
            )
          ) {
            renderTourStep();
          }
        }
      }
    );
  }

  window.NexusOnboarding =
    Object.freeze({
      openVerification,
      closeVerification,
      openTour,
      closeTour,
      completeVerification,
      loadState,
      saveState
    });

  function init() {
    bindEvents();
    maybeStartOnboarding();
  }

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
