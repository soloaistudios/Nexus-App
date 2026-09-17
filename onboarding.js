'use strict';

(() => {
  const $ = (id) => document.getElementById(id);

  const TOUR_STEPS = [
    {
      selector: '[data-tour="home"]',
      title: 'Welcome to Home',
      text: 'Your Home dashboard gives you a quick view of your balance, active trade, progress, and recent activity.',
    },
    {
      selector: '[data-tour="quick-actions"]',
      title: 'Quick Actions',
      text: 'Use these shortcuts to access your most important actions without searching through the app.',
    },
    {
      selector: '[data-tour="trade"]',
      title: 'Trade',
      text: 'Choose a trading plan, enter an amount, and follow your active trading cycle from here.',
    },
    {
      selector: '[data-tour="community"]',
      title: 'Community',
      text: 'Connect with the private community, view updates, create posts, and interact with other members.',
    },
    {
      selector: '[data-tour="profile"]',
      title: 'Profile',
      text: 'Manage your profile, verification status, security, notifications, settings, and account information here.',
    },
  ];

  let activeTourStep = 0;

  function getState() {
    return window.NexusStorage
      ? NexusStorage.get()
      : null;
  }

  function saveState(state) {
    if (window.NexusStorage) {
      NexusStorage.set(state);
    }
  }

  function showModal(id) {
    const modal = $(id);

    if (!modal) {
      return;
    }

    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
  }

  function hideModal(id) {
    const modal = $(id);

    if (!modal) {
      return;
    }

    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  }

  function toast(message) {
    window.NexusApp?.toast?.(message);
  }

  function openVerification() {
    const state = getState();

    if (!state?.loggedIn) {
      return;
    }

    if (state.user?.verified) {
      return;
    }

    const nameInput = $('verificationName');

    if (nameInput) {
      nameInput.value =
        state.user?.name || '';
    }

    showModal('verificationModal');

    window.setTimeout(() => {
      nameInput?.focus();
    }, 50);
  }

  function closeVerification() {
    hideModal('verificationModal');
  }

  function completeVerification(event) {
    event.preventDefault();

    const state = getState();

    if (!state?.loggedIn) {
      return;
    }

    const name =
      $('verificationName')
        ?.value
        .trim() || '';

    const country =
      $('verificationCountry')
        ?.value
        .trim() || '';

    const terms =
      $('verificationTerms')
        ?.checked || false;

    if (!name) {
      toast('Enter your full name.');
      return;
    }

    if (!country) {
      toast('Select your country.');
      return;
    }

    if (!terms) {
      toast(
        'Accept the verification notice to continue.'
      );

      return;
    }

    state.user = {
      ...state.user,
      name,
      verificationCountry: country,
      verified: true,
    };

    state.firstRun = true;
    state.tourSeen = false;
    state.tourStep = 0;

    saveState(state);

    closeVerification();

    toast(
      'Profile verification completed.'
    );

    window.setTimeout(() => {
      openTour();
    }, 400);
  }

  function skipVerification() {
    closeVerification();

    toast(
      'You can complete verification later from Profile.'
    );

    const state = getState();

    if (state) {
      state.firstRun = false;
      saveState(state);
    }

    window.setTimeout(() => {
      openTour();
    }, 400);
  }

  function clearHighlight() {
    document
      .querySelectorAll(
        '.nexus-tour-highlight'
      )
      .forEach((element) => {
        element.classList.remove(
          'nexus-tour-highlight'
        );

        element.removeAttribute(
          'data-tour-active'
        );
      });
  }

  function getTarget(step) {
    if (!step?.selector) {
      return null;
    }

    try {
      return document.querySelector(
        step.selector
      );
    } catch {
      return null;
    }
  }

  function renderTourStep() {
    const state = getState();
    const step =
      TOUR_STEPS[activeTourStep];

    if (!step) {
      finishTour();
      return;
    }

    const title = $('tourTitle');
    const text = $('tourText');
    const stepLabel = $('tourStep');
    const progress = $('tourProgress');
    const back = $('tourBack');
    const next = $('tourNext');

    if (title) {
      title.textContent =
        step.title;
    }

    if (text) {
      text.textContent =
        step.text;
    }

    if (stepLabel) {
      stepLabel.textContent =
        `${activeTourStep + 1} of ${TOUR_STEPS.length}`;
    }

    if (progress) {
      progress.style.width =
        `${(
          ((activeTourStep + 1) /
            TOUR_STEPS.length) *
          100
        ).toFixed(1)}%`;
    }

    if (back) {
      back.disabled =
        activeTourStep === 0;
    }

    if (next) {
      next.textContent =
        activeTourStep ===
        TOUR_STEPS.length - 1
          ? 'Finish'
          : 'Next';
    }

    clearHighlight();

    const target =
      getTarget(step);

    if (target) {
      target.classList.add(
        'nexus-tour-highlight'
      );

      target.setAttribute(
        'data-tour-active',
        'true'
      );

      window.setTimeout(() => {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        });
      }, 50);
    }

    if (state) {
      state.tourStep =
        activeTourStep;

      saveState(state);
    }
  }

  function openTour() {
    const state = getState();

    if (!state?.loggedIn) {
      return;
    }

    if (state.tourSeen) {
      return;
    }

    activeTourStep =
      Number.isInteger(
        state.tourStep
      )
        ? Math.max(
            0,
            Math.min(
              state.tourStep,
              TOUR_STEPS.length - 1
            )
          )
        : 0;

    showModal('tourModal');
    showModal('tourBackdrop');

    renderTourStep();

    window.setTimeout(() => {
      $('tourNext')?.focus();
    }, 60);
  }

  function nextStep() {
    if (
      activeTourStep >=
      TOUR_STEPS.length - 1
    ) {
      finishTour();
      return;
    }

    activeTourStep += 1;

    renderTourStep();
  }

  function previousStep() {
    if (
      activeTourStep <= 0
    ) {
      return;
    }

    activeTourStep -= 1;

    renderTourStep();
  }

  function finishTour() {
    const state = getState();

    clearHighlight();

    hideModal('tourModal');
    hideModal('tourBackdrop');

    activeTourStep = 0;

    if (state) {
      state.tourSeen = true;
      state.tourStep = 0;
      state.firstRun = false;

      saveState(state);
    }

    toast(
      'Welcome to NEXUS. You are all set.'
    );
  }

  function skipTour() {
    const state = getState();

    clearHighlight();

    hideModal('tourModal');
    hideModal('tourBackdrop');

    activeTourStep = 0;

    if (state) {
      state.tourSeen = true;
      state.tourStep = 0;
      state.firstRun = false;

      saveState(state);
    }

    toast(
      'Tour skipped. You can explore NEXUS at any time.'
    );
  }

  function replayTour() {
    const state = getState();

    if (!state?.loggedIn) {
      return;
    }

    state.tourSeen = false;
    state.tourStep = 0;

    saveState(state);

    activeTourStep = 0;

    openTour();
  }

  function maybeStartOnboarding() {
    const state = getState();

    if (!state?.loggedIn) {
      return;
    }

    if (
      !state.user?.verified &&
      state.firstRun
    ) {
      window.setTimeout(() => {
        openVerification();
      }, 500);

      return;
    }

    if (
      state.firstRun &&
      !state.tourSeen
    ) {
      window.setTimeout(() => {
        openTour();
      }, 600);
    }
  }

  function bindEvents() {
    $('verificationClose')?.addEventListener(
      'click',
      closeVerification
    );

    $('verificationForm')?.addEventListener(
      'submit',
      completeVerification
    );

    $('skipVerificationBtn')?.addEventListener(
      'click',
      skipVerification
    );

    $('tourNext')?.addEventListener(
      'click',
      nextStep
    );

    $('tourBack')?.addEventListener(
      'click',
      previousStep
    );

    $('tourSkip')?.addEventListener(
      'click',
      skipTour
    );

    document
      .querySelectorAll(
        '[data-open-verification]'
      )
      .forEach((button) => {
        button.addEventListener(
          'click',
          openVerification
        );
      });

    document
      .querySelectorAll(
        '[data-replay-tour]'
      )
      .forEach((button) => {
        button.addEventListener(
          'click',
          replayTour
        );
      });

    document.addEventListener(
      'keydown',
      (event) => {
        if (
          event.key !== 'Escape'
        ) {
          return;
        }

        const tour =
          $('tourModal');

        const verification =
          $('verificationModal');

        if (
          tour &&
          !tour.classList.contains(
            'hidden'
          )
        ) {
          skipTour();
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
    );

    window.addEventListener(
      'resize',
      () => {
        const modal =
          $('tourModal');

        if (
          modal &&
          !modal.classList.contains(
            'hidden'
          )
        ) {
          renderTourStep();
        }
      }
    );
  }

  function init() {
    bindEvents();

    window.setTimeout(
      maybeStartOnboarding,
      300
    );
  }

  window.NexusOnboarding = {
    init,
    openVerification,
    closeVerification,
    openTour,
    finishTour,
    skipTour,
    replayTour,
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
