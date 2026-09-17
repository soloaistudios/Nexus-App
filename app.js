'use strict';

/*
 * NEXUS Application Shell
 * -----------------------
 * Fail-safe application controller for the current NEXUS index.html.
 */

(() => {
  const APP_SCREEN_ID = 'appScreen';
  const AUTH_SCREEN_ID = 'authScreen';
  const DRAWER_ID = 'sideDrawer';
  const VERIFICATION_ID = 'verificationModal';

  const DEFAULT_ROUTE = 'home';

  const $ = (id) => document.getElementById(id);

  function getState() {
    try {
      if (window.NexusStorage?.get) {
        return NexusStorage.get();
      }
    } catch (error) {
      console.warn(
        'NEXUS app: storage adapter read failed; using local fallback.',
        error
      );
    }

    try {
      const raw = localStorage.getItem('nexusSimulatorState');
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.warn(
        'NEXUS app: unable to read application state.',
        error
      );
      return null;
    }
  }

  function saveState(state) {
    try {
      if (window.NexusStorage?.set) {
        return NexusStorage.set(state);
      }
    } catch (error) {
      console.warn(
        'NEXUS app: storage adapter write failed; using local fallback.',
        error
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
        'NEXUS app: unable to save application state.',
        error
      );
      return false;
    }
  }

  function toast(message) {
    const wrapper = $('toastWrap');

    if (!wrapper) {
      console.info(`NEXUS: ${message}`);
      return;
    }

    const element = document.createElement('div');
    element.className = 'toast';
    element.textContent = message;

    wrapper.appendChild(element);

    window.setTimeout(() => {
      element.remove();
    }, 3000);
  }

  function showAuthScreen() {
    const authScreen = $(AUTH_SCREEN_ID);
    const appScreen = $(APP_SCREEN_ID);

    authScreen?.classList.remove('hidden');
    appScreen?.classList.add('hidden');

    authScreen?.setAttribute('aria-hidden', 'false');
    appScreen?.setAttribute('aria-hidden', 'true');
  }

  function showAppScreen() {
    const authScreen = $(AUTH_SCREEN_ID);
    const appScreen = $(APP_SCREEN_ID);

    authScreen?.classList.add('hidden');
    appScreen?.classList.remove('hidden');

    authScreen?.setAttribute('aria-hidden', 'true');
    appScreen?.setAttribute('aria-hidden', 'false');
  }

  function enterApp(isNewAccount = false) {
    const state = getState();

    if (!state) {
      showAuthScreen();
      return;
    }

    state.loggedIn = true;

    if (isNewAccount) {
      state.firstRun = true;
      state.tourSeen = false;
      state.tourStep = 0;
    }

    saveState(state);
    showAppScreen();

    setActivePage(
      isNewAccount
        ? DEFAULT_ROUTE
        : getCurrentPage()
    );

    refreshUI();

    dispatch('nexus:auth-updated', {
      loggedIn: true,
      firstRun: Boolean(isNewAccount),
    });

    if (
      isNewAccount &&
      window.NexusOnboarding?.openVerification
    ) {
      window.setTimeout(() => {
        NexusOnboarding.openVerification();
      }, 400);
    }
  }

  function getCurrentPage() {
    const active = document.querySelector(
      '[data-page].active'
    );

    if (active?.dataset.page) {
      return active.dataset.page;
    }

    const visible = document.querySelector(
      '[data-page]:not(.hidden)'
    );

    return visible?.dataset.page || DEFAULT_ROUTE;
  }

  function setActivePage(pageName) {
    const validPages = new Set(
      Array.from(
        document.querySelectorAll('[data-page]')
      ).map((page) => page.dataset.page)
    );

    const page = validPages.has(pageName)
      ? pageName
      : DEFAULT_ROUTE;

    document.querySelectorAll('[data-page]').forEach((section) => {
      const active = section.dataset.page === page;

      section.classList.toggle(
        'hidden',
        !active
      );

      section.classList.toggle(
        'active',
        active
      );

      section.setAttribute(
        'aria-hidden',
        String(!active)
      );
    });

    document.querySelectorAll('[data-route]').forEach((button) => {
      const active =
        button.dataset.route === page;

      button.classList.toggle(
        'active',
        active
      );

      if (active) {
        button.setAttribute(
          'aria-current',
          'page'
        );
      } else {
        button.removeAttribute(
          'aria-current'
        );
      }
    });

    closeDrawer();

    dispatch('nexus:view-changed', {
      page,
    });
  }

  function navigate(pageName) {
    const state = getState();

    if (!state?.loggedIn) {
      showAuthScreen();
      return;
    }

    setActivePage(pageName);
    refreshUI();
  }

  function bindNavigation() {
    document.querySelectorAll('[data-route]').forEach((button) => {
      if (button.dataset.appBound === 'true') {
        return;
      }

      button.dataset.appBound = 'true';

      button.addEventListener('click', (event) => {
        event.preventDefault();
        navigate(button.dataset.route);
      });
    });
  }

  function openDrawer() {
    const drawer = $(DRAWER_ID);

    if (!drawer) {
      return;
    }

    drawer.classList.add('open');
    document.body.classList.add('drawer-open');

    const focusTarget = drawer.querySelector(
      '.drawer-panel button'
    );

    window.setTimeout(() => {
      focusTarget?.focus();
    }, 50);
  }

  function closeDrawer() {
    const drawer = $(DRAWER_ID);

    drawer?.classList.remove('open');
    document.body.classList.remove('drawer-open');
  }

  function bindDrawer() {
    $('drawerOpen')?.addEventListener(
      'click',
      openDrawer
    );

    $('drawerClose')?.addEventListener(
      'click',
      closeDrawer
    );

    $(DRAWER_ID)
      ?.querySelector('.drawer-backdrop')
      ?.addEventListener(
        'click',
        closeDrawer
      );
  }

  function getModalPanel(name) {
    const value = String(name ?? '');

    const escaped =
      typeof window.CSS?.escape === 'function'
        ? window.CSS.escape(value)
        : value.replace(
            /(["\\])/g,
            '\\$1'
          );

    return document.querySelector(
      `[data-modal-panel="${escaped}"]`
    );
  }

  function openModal(name) {
    const panel = getModalPanel(name);

    if (!panel) {
      return false;
    }

    panel.classList.remove('hidden');
    panel.setAttribute(
      'aria-hidden',
      'false'
    );

    document.body.classList.add(
      'modal-open'
    );

    const focusTarget = panel.querySelector(
      'input, select, textarea, button'
    );

    window.setTimeout(() => {
      focusTarget?.focus();
    }, 40);

    return true;
  }

  function closeModal(name) {
    const panel = getModalPanel(name);

    if (!panel) {
      return;
    }

    panel.classList.add('hidden');
    panel.setAttribute(
      'aria-hidden',
      'true'
    );

    if (
      !document.querySelector(
        '[data-modal-panel]:not(.hidden)'
      )
    ) {
      document.body.classList.remove(
        'modal-open'
      );
    }
  }

  function closeAllModals() {
    document
      .querySelectorAll(
        '[data-modal-panel]:not(.hidden)'
      )
      .forEach((panel) => {
        panel.classList.add('hidden');
        panel.setAttribute(
          'aria-hidden',
          'true'
        );
      });

    document.body.classList.remove(
      'modal-open'
    );
  }

  function bindModals() {
    document
      .querySelectorAll('[data-modal]')
      .forEach((button) => {
        if (button.dataset.appBound === 'true') {
          return;
        }

        button.dataset.appBound = 'true';

        button.addEventListener(
          'click',
          (event) => {
            event.preventDefault();
            openModal(
              button.dataset.modal
            );
          }
        );
      });

    document
      .querySelectorAll('[data-close-modal]')
      .forEach((button) => {
        if (button.dataset.appBound === 'true') {
          return;
        }

        button.dataset.appBound = 'true';

        button.addEventListener(
          'click',
          (event) => {
            event.preventDefault();
            closeModal(
              button.dataset.closeModal
            );
          }
        );
      });

    document
      .querySelectorAll('[data-modal-panel]')
      .forEach((panel) => {
        if (panel.dataset.appBound === 'true') {
          return;
        }

        panel.dataset.appBound = 'true';

        panel.addEventListener(
          'click',
          (event) => {
            if (event.target === panel) {
              const name =
                panel.dataset.modalPanel;

              closeModal(name);
            }
          }
        );
      });
  }

  function bindQuickActions() {
    document
      .querySelectorAll(
        '[data-action="deposit"]'
      )
      .forEach((button) => {
        button.addEventListener(
          'click',
          () => {
            openModal('deposit');
          }
        );
      });

    document
      .querySelectorAll(
        '[data-action="withdraw"]'
      )
      .forEach((button) => {
        button.addEventListener(
          'click',
          () => {
            openModal('withdraw');
          }
        );
      });

    document
      .querySelectorAll(
        '[data-action="trade"]'
      )
      .forEach((button) => {
        button.addEventListener(
          'click',
          () => {
            navigate('trade');
          }
        );
      });
  }

  function bindCopyButtons() {
    document
      .querySelectorAll(
        '[data-copy-target]'
      )
      .forEach((button) => {
        if (button.dataset.appBound === 'true') {
          return;
        }

        button.dataset.appBound = 'true';

        button.addEventListener(
          'click',
          async () => {
            const targetId =
              button.dataset.copyTarget;

            const target = $(targetId);

            if (!target) {
              toast(
                'Address or code could not be found.'
              );
              return;
            }

            const text = (
              target.value ||
              target.textContent ||
              ''
            ).trim();

            if (!text) {
              toast('Nothing to copy.');
              return;
            }

            try {
              if (
                navigator.clipboard &&
                typeof navigator.clipboard.writeText === 'function'
              ) {
                await navigator.clipboard.writeText(
                  text
                );

                toast(
                  'Copied to clipboard.'
                );
              } else {
                toast(
                  'Copy is unavailable in this browser.'
                );
              }
            } catch {
              toast(
                'Copy is unavailable in this browser.'
              );
            }
          }
        );
      });
  }

  function bindDepositForm() {
    document
      .querySelectorAll(
        '[data-deposit-form]'
      )
      .forEach((form) => {
        if (form.dataset.appBound === 'true') {
          return;
        }

        form.dataset.appBound = 'true';

        form.addEventListener(
          'submit',
          (event) => {
            event.preventDefault();

            const input =
              form.querySelector(
                'input[type="number"]'
              );

            const amount =
              Number(input?.value);

            let result = null;

            try {
              if (
                window.NexusSimulation?.simulateDeposit
              ) {
                result =
                  NexusSimulation.simulateDeposit(
                    amount
                  );
              }
            } catch (error) {
              console.warn(
                'NEXUS deposit simulation failed.',
                error
              );
            }

            if (!result) {
              const state =
                getState();

              if (!state?.loggedIn) {
                result = {
                  success: false,
                  message:
                    'Sign in before making a deposit.',
                };
              } else if (
                !Number.isFinite(amount) ||
                amount <= 0
              ) {
                result = {
                  success: false,
                  message:
                    'Enter a valid deposit amount.',
                };
              } else {
                const value =
                  Number(
                    amount.toFixed(2)
                  );

                state.balance =
                  Number(
                    (
                      (Number(
                        state.balance
                      ) || 0) +
                      value
                    ).toFixed(2)
                  );

                state.availableBalance =
                  Number(
                    (
                      (Number(
                        state.availableBalance
                      ) || 0) +
                      value
                    ).toFixed(2)
                  );

                state.transactions =
                  Array.isArray(
                    state.transactions
                  )
                    ? state.transactions
                    : [];

                state.transactions.unshift({
                  id: `TX-${Date.now()}`,
                  type: 'deposit',
                  amount: value,
                  status: 'completed',
                  timestamp: Date.now(),
                  description:
                    'Deposit credited',
                });

                saveState(state);

                result = {
                  success: true,
                  balance:
                    state.balance,
                };
              }
            }

            if (!result?.success) {
              toast(
                result?.message ||
                  'Deposit could not be completed.'
              );
              return;
            }

            if (input) {
              input.value = '';
            }

            closeModal('deposit');

            toast(
              'Deposit recorded successfully.'
            );

            refreshUI();
          }
        );
      });
  }

  function bindWithdrawalForm() {
    document
      .querySelectorAll(
        '[data-withdraw-form]'
      )
      .forEach((form) => {
        if (form.dataset.appBound === 'true') {
          return;
        }

        form.dataset.appBound = 'true';

        form.addEventListener(
          'submit',
          (event) => {
            event.preventDefault();

            const addressInput =
              form.querySelector(
                'input[name="address"]'
              );

            const amountInput =
              form.querySelector(
                'input[name="amount"]'
              );

            const amount =
              Number(
                amountInput?.value
              );

            const address =
              addressInput
                ?.value
                .trim() || '';

            let result = null;

            try {
              if (
                window.NexusSimulation?.simulateWithdrawal
              ) {
                result =
                  NexusSimulation.simulateWithdrawal(
                    amount,
                    address
                  );
              }
            } catch (error) {
              console.warn(
                'NEXUS withdrawal simulation failed.',
                error
              );
            }

            if (!result) {
              const state =
                getState();

              const balance =
                Number(
                  state?.balance
                ) || 0;

              if (!state?.loggedIn) {
                result = {
                  success: false,
                  message:
                    'Sign in before making a withdrawal.',
                };
              } else if (
                !Number.isFinite(
                  amount
                ) ||
                amount <= 0
              ) {
                result = {
                  success: false,
                  message:
                    'Enter a valid withdrawal amount.',
                };
              } else if (!address) {
                result = {
                  success: false,
                  message:
                    'Enter a withdrawal address.',
                };
              } else if (
                amount > balance
              ) {
                result = {
                  success: false,
                  message:
                    'Withdrawal exceeds the available balance.',
                };
              } else {
                const value =
                  Number(
                    amount.toFixed(2)
                  );

                state.balance =
                  Number(
                    (
                      balance -
                      value
                    ).toFixed(2)
                  );

                if (
                  state.availableBalance !==
                  undefined
                ) {
                  state.availableBalance =
                    Number(
                      Math.max(
                        0,
                        (
                          Number(
                            state.availableBalance
                          ) || 0
                        ) -
                          value
                      ).toFixed(2)
                    );
                }

                state.transactions =
                  Array.isArray(
                    state.transactions
                  )
                    ? state.transactions
                    : [];

                state.transactions.unshift({
                  id: `TX-${Date.now()}`,
                  type: 'withdrawal',
                  amount: value,
                  address,
                  status: 'completed',
                  timestamp: Date.now(),
                  description:
                    'Withdrawal processed',
                });

                saveState(state);

                result = {
                  success: true,
                  balance:
                    state.balance,
                };
              }
            }

            if (!result?.success) {
              toast(
                result?.message ||
                  'Withdrawal could not be completed.'
              );
              return;
            }

            if (addressInput) {
              addressInput.value = '';
            }

            if (amountInput) {
              amountInput.value = '';
            }

            closeModal('withdraw');

            toast(
              'Withdrawal recorded successfully.'
            );

            refreshUI();
          }
        );
      });
  }

  function bindPlanControls() {
    document
      .querySelectorAll(
        '[data-plan-card]'
      )
      .forEach((card) => {
        if (card.dataset.appBound === 'true') {
          return;
        }

        card.dataset.appBound = 'true';

        card.addEventListener(
          'click',
          () => {
            const planId =
              card.dataset.planCard;

            const state =
              getState();

            if (
              !state ||
              !planId
            ) {
              return;
            }

            state.selectedPlan =
              planId;

            saveState(state);
            refreshPlanUI();
          }
        );
      });

    document
      .querySelectorAll(
        '[data-plan-select]'
      )
      .forEach((select) => {
        if (select.dataset.appBound === 'true') {
          return;
        }

        select.dataset.appBound =
          'true';

        select.addEventListener(
          'change',
          () => {
            const state =
              getState();

            if (!state) {
              return;
            }

            state.selectedPlan =
              select.value;

            saveState(state);
            refreshPlanUI();
          }
        );
      });
  }

  function refreshPlanUI() {
    const state =
      getState();

    const trading =
      window.NexusTrading ||
      {};

    const plans =
      trading.PLANS ||
      trading.plans ||
      {};

    if (!state) {
      return;
    }

    const selectedPlan =
      plans[state.selectedPlan] ||
      plans.daily ||
      null;

    document
      .querySelectorAll(
        '[data-plan-card]'
      )
      .forEach((card) => {
        const active =
          card.dataset.planCard ===
          state.selectedPlan;

        card.classList.toggle(
          'selected',
          active
        );

        card.setAttribute(
          'aria-selected',
          String(active)
        );
      });

    document
      .querySelectorAll(
        '[data-plan-select]'
      )
      .forEach((select) => {
        if (state.selectedPlan) {
          select.value =
            state.selectedPlan;
        }
      });

    if (!selectedPlan) {
      return;
    }

    const roi =
      Number(
        selectedPlan.targetRoi ??
          selectedPlan.roi ??
          0
      );

    document
      .querySelectorAll(
        '[data-plan-roi-preview]'
      )
      .forEach((node) => {
        node.textContent =
          `${(
            roi * 100
          ).toFixed(0)}%`;
      });

    document
      .querySelectorAll(
        '[data-plan-duration-preview]'
      )
      .forEach((node) => {
        const labels = {
          daily: '24 hours',
          weekly: '7 days',
          monthly: '30 days',
          yearly: '365 days',
        };

        node.textContent =
          labels[state.selectedPlan] ||
          selectedPlan.durationLabel ||
          (
            Number(
              selectedPlan.days
            ) === 1
              ? '1 day'
              : `${
                  Number(
                    selectedPlan.days
                  ) || 0
                } days`
          );
      });
  }

  function bindVerification() {
    const modal =
      $(VERIFICATION_ID);

    const form =
      modal?.querySelector(
        'form'
      );

    $('verificationClose')
      ?.addEventListener(
        'click',
        () => {
          window.NexusOnboarding
            ?.closeVerification
            ?.();
        }
      );

    $('skipVerificationBtn')
      ?.addEventListener(
        'click',
        () => {
          window.NexusOnboarding
            ?.skipVerification
            ?.();
        }
      );

    if (
      !form ||
      form.dataset.appBound === 'true'
    ) {
      return;
    }

    form.dataset.appBound =
      'true';

    form.addEventListener(
      'submit',
      (event) => {
        event.preventDefault();

        const state =
          getState();

        if (!state?.loggedIn) {
          return;
        }

        const name =
          $(
            'verificationName'
          )
            ?.value
            .trim() || '';

        const country =
          $(
            'verificationCountry'
          )
            ?.value
            .trim() || '';

        const accepted =
          $(
            'verificationTerms'
          )
            ?.checked ||
          false;

        if (!name) {
          toast(
            'Enter your full name.'
          );
          return;
        }

        if (!country) {
          toast(
            'Select your country.'
          );
          return;
        }

        if (!accepted) {
          toast(
            'Accept the verification notice to continue.'
          );
          return;
        }

        state.user = {
          ...state.user,
          name,
          verificationCountry:
            country,
          verified: true,
        };

        state.firstRun =
          true;

        state.tourSeen =
          false;

        state.tourStep =
          0;

        saveState(state);

        hideVerification();
        refreshUI();

        toast(
          'Profile verification completed.'
        );

        window.setTimeout(
          () => {
            window.NexusOnboarding
              ?.openTour
              ?.();
          },
          350
        );
      }
    );
  }

  function showVerification() {
    const modal =
      $(VERIFICATION_ID);

    if (!modal) {
      return;
    }

    modal.classList.remove(
      'hidden'
    );

    modal.setAttribute(
      'aria-hidden',
      'false'
    );

    document.body.classList.add(
      'modal-open'
    );

    const state =
      getState();

    const nameInput =
      $('verificationName');

    if (
      nameInput &&
      !nameInput.value
    ) {
      nameInput.value =
        state?.user?.name ||
        '';
    }

    window.setTimeout(
      () => {
        nameInput?.focus();
      },
      50
    );
  }

  function hideVerification() {
    const modal =
      $(VERIFICATION_ID);

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

    document.body.classList.remove(
      'modal-open'
    );
  }

  function bindEditProfile() {
    document
      .querySelectorAll(
        '[data-open-edit-profile]'
      )
      .forEach((button) => {
        if (
          button.dataset.appBound ===
          'true'
        ) {
          return;
        }

        button.dataset.appBound =
          'true';

        button.addEventListener(
          'click',
          () => {
            openModal(
              'editProfile'
            );

            const state =
              getState();

            const input =
              document.querySelector(
                '[data-edit-profile-form] input'
              );

            if (input) {
              input.value =
                state?.user?.name ||
                'Trader Account';
            }
          }
        );
      });

    document
      .querySelectorAll(
        '[data-edit-profile-form]'
      )
      .forEach((form) => {
        if (
          form.dataset.appBound ===
          'true'
        ) {
          return;
        }

        form.dataset.appBound =
          'true';

        form.addEventListener(
          'submit',
          (event) => {
            event.preventDefault();

            const state =
              getState();

            const input =
              form.querySelector(
                'input'
              );

            const name =
              input?.value.trim() ||
              '';

            if (!state) {
              return;
            }

            if (name.length < 2) {
              toast(
                'Enter a valid display name.'
              );
              return;
            }

            state.user = {
              ...state.user,
              name,
            };

            saveState(state);

            closeModal(
              'editProfile'
            );

            refreshUI();

            toast(
              'Profile updated successfully.'
            );

            dispatch(
              'nexus:profile-updated',
              {
                user:
                  state.user,
              }
            );
          }
        );
      });
  }

  function bindVerificationLaunchers() {
    document
      .querySelectorAll(
        '[data-open-verification]'
      )
      .forEach((button) => {
        if (
          button.dataset.appBound ===
          'true'
        ) {
          return;
        }

        button.dataset.appBound =
          'true';

        button.addEventListener(
          'click',
          () => {
            closeDrawer();
            showVerification();
          }
        );
      });
  }

  function bindReplayTour() {
    document
      .querySelectorAll(
        '[data-replay-tour]'
      )
      .forEach((button) => {
        if (
          button.dataset.appBound ===
          'true'
        ) {
          return;
        }

        button.dataset.appBound =
          'true';

        button.addEventListener(
          'click',
          () => {
            closeDrawer();

            window.NexusOnboarding
              ?.replayTour
              ?.();
          }
        );
      });
  }

  function bindGlobalSignOut() {
    document
      .querySelectorAll(
        '[data-sign-out]'
      )
      .forEach((button) => {
        if (
          button.dataset.appBound ===
          'true'
        ) {
          return;
        }

        button.dataset.appBound =
          'true';

        button.addEventListener(
          'click',
          () => {
            const state =
              getState();

            if (!state) {
              showAuthScreen();
              return;
            }

            state.loggedIn =
              false;

            saveState(state);

            closeDrawer();
            closeAllModals();
            showAuthScreen();
            refreshUI();

            dispatch(
              'nexus:auth-signed-out',
              {}
            );
          }
        );
      });
  }

  function refreshBalanceUI() {
    const state =
      getState();

    if (!state) {
      return;
    }

    const balance =
      Number(
        state.balance
      ) || 0;

    document
      .querySelectorAll(
        '[data-balance]'
      )
      .forEach((node) => {
        node.textContent =
          formatMoney(balance);
      });

    document
      .querySelectorAll(
        '[data-available]'
      )
      .forEach((node) => {
        node.textContent =
          formatMoney(
            Number(
              state.availableBalance
            ) ||
              balance
          );
      });
  }

  function refreshUserUI() {
    const state =
      getState();

    if (!state) {
      return;
    }

    const user =
      state.user || {};

    const name =
      user.name ||
      'Trader Account';

    const verified =
      Boolean(
        user.verified
      );

    document
      .querySelectorAll(
        '[data-header-name]'
      )
      .forEach((node) => {
        node.textContent =
          getInitials(name);
      });

    document
      .querySelectorAll(
        '[data-header-status]'
      )
      .forEach((node) => {
        node.textContent =
          verified
            ? 'Verified'
            : 'Not verified';
      });
  }

  function refreshUI() {
    try {
      refreshBalanceUI();
    } catch (error) {
      console.warn(
        'NEXUS balance refresh skipped.',
        error
      );
    }

    try {
      refreshUserUI();
    } catch (error) {
      console.warn(
        'NEXUS user refresh skipped.',
        error
      );
    }

    try {
      refreshPlanUI();
    } catch (error) {
      console.warn(
        'NEXUS plan refresh skipped.',
        error
      );
    }

    try {
      window.NexusTrading
        ?.render
        ?.();
    } catch (error) {
      console.warn(
        'NEXUS trading render skipped.',
        error
      );
    }

    try {
      window.NexusSimulation
        ?.render
        ?.();
    } catch (error) {
      console.warn(
        'NEXUS simulation render skipped.',
        error
      );
    }

    try {
      window.NexusCommunity
        ?.render
        ?.();
    } catch (error) {
      console.warn(
        'NEXUS community render skipped.',
        error
      );
    }

    try {
      window.NexusProfile
        ?.render
        ?.();
    } catch (error) {
      console.warn(
        'NEXUS profile render skipped.',
        error
      );
    }
  }

  function formatMoney(value) {
    const amount =
      Number(value) || 0;

    try {
      return new Intl.NumberFormat(
        'en-US',
        {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }
      ).format(amount);
    } catch {
      return `$${amount.toFixed(2)}`;
    }
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
      parts.length === 1
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

  function bindKeyboard() {
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
        closeAllModals();
        hideVerification();

        if (
          window.NexusOnboarding &&
          $('tourModal') &&
          !$(
            'tourModal'
          ).classList.contains(
            'hidden'
          )
        ) {
          window.NexusOnboarding
            ?.skipTour
            ?.();
        }
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
    const safely = (
      label,
      fn
    ) => {
      try {
        fn();
      } catch (error) {
        console.error(
          `NEXUS app: ${label} failed.`,
          error
        );
      }
    };

    /*
     * Every subsystem is isolated.
     * One broken companion file must not
     * blank the entire application.
     */

    safely(
      'navigation binding',
      bindNavigation
    );

    safely(
      'drawer binding',
      bindDrawer
    );

    safely(
      'modal binding',
      bindModals
    );

    safely(
      'quick-action binding',
      bindQuickActions
    );

    safely(
      'copy binding',
      bindCopyButtons
    );

    safely(
      'deposit binding',
      bindDepositForm
    );

    safely(
      'withdrawal binding',
      bindWithdrawalForm
    );

    safely(
      'plan binding',
      bindPlanControls
    );

    safely(
      'verification binding',
      bindVerification
    );

    safely(
      'verification launcher binding',
      bindVerificationLaunchers
    );

    safely(
      'tour binding',
      bindReplayTour
    );

    safely(
      'profile binding',
      bindEditProfile
    );

    safely(
      'sign-out binding',
      bindGlobalSignOut
    );

    safely(
      'keyboard binding',
      bindKeyboard
    );

    let state = null;

    safely(
      'state read',
      () => {
        state =
          getState();
      }
    );

    /*
     * Establish a visible root BEFORE
     * optional rendering modules execute.
     */

    if (
      state?.loggedIn &&
      $(APP_SCREEN_ID)
    ) {
      showAppScreen();

      safely(
        'default route',
        () => {
          setActivePage(
            DEFAULT_ROUTE
          );
        }
      );
    } else if (
      $(AUTH_SCREEN_ID)
    ) {
      showAuthScreen();
    }

    safely(
      'UI refresh',
      refreshUI
    );

    /*
     * Final fail-open guard.
     * Never leave both root screens hidden.
     */

    const auth =
      $(AUTH_SCREEN_ID);

    const app =
      $(APP_SCREEN_ID);

    if (
      auth &&
      app &&
      auth.classList.contains(
        'hidden'
      ) &&
      app.classList.contains(
        'hidden'
      )
    ) {
      let loggedIn = false;

      try {
        loggedIn =
          Boolean(
            getState()?.loggedIn
          );
      } catch {}

      if (loggedIn) {
        showAppScreen();
      } else {
        showAuthScreen();
      }
    }
  }

  window.NexusAppVersion =
    '2026.09.17.2';

  window.NexusApp = {
    init,
    getState,
    saveState,
    enterApp,
    showAuth:
      showAuthScreen,
    showApp:
      showAppScreen,
    navigate,
    setActivePage,
    openDrawer,
    closeDrawer,
    openModal,
    closeModal,
    closeAllModals,
    showVerification,
    hideVerification,
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
