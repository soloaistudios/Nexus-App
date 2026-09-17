'use strict';

/*
 * NEXUS Application Shell
 * -----------------------
 * Written for the current NEXUS index.html structure.
 *
 * Handles:
 * - Authentication visibility
 * - Main page routing
 * - Hamburger drawer
 * - Modal controls
 * - Quick actions
 * - Deposit / withdrawal forms
 * - Verification handoff
 * - Guided-tour handoff
 * - Profile editing
 * - Copy buttons
 * - Global UI refresh
 */

(() => {
  const APP_SCREEN_ID = 'appScreen';
  const AUTH_SCREEN_ID = 'authScreen';
  const DRAWER_ID = 'sideDrawer';
  const VERIFICATION_ID = 'verificationModal';

  const DEFAULT_ROUTE = 'home';

  const $ = (id) => document.getElementById(id);

  function getState() {
    if (window.NexusStorage?.get) {
      return NexusStorage.get();
    }

    try {
      const raw = localStorage.getItem(
        'nexusSimulatorState'
      );

      return raw
        ? JSON.parse(raw)
        : null;
    } catch (error) {
      console.warn(
        'NEXUS app: unable to read application state.',
        error
      );

      return null;
    }
  }

  function saveState(state) {
    if (window.NexusStorage?.set) {
      return NexusStorage.set(state);
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

  function showAuthScreen() {
    const authScreen =
      $(AUTH_SCREEN_ID);

    const appScreen =
      $(APP_SCREEN_ID);

    authScreen?.classList.remove(
      'hidden'
    );

    appScreen?.classList.add(
      'hidden'
    );

    authScreen?.setAttribute(
      'aria-hidden',
      'false'
    );

    appScreen?.setAttribute(
      'aria-hidden',
      'true'
    );
  }

  function showAppScreen() {
    const authScreen =
      $(AUTH_SCREEN_ID);

    const appScreen =
      $(APP_SCREEN_ID);

    authScreen?.classList.add(
      'hidden'
    );

    appScreen?.classList.remove(
      'hidden'
    );

    authScreen?.setAttribute(
      'aria-hidden',
      'true'
    );

    appScreen?.setAttribute(
      'aria-hidden',
      'false'
    );
  }

  function enterApp(
    isNewAccount = false
  ) {
    const state =
      getState();

    if (!state) {
      showAuthScreen();
      return;
    }

    state.loggedIn =
      true;

    if (isNewAccount) {
      state.firstRun =
        true;

      state.tourSeen =
        false;

      state.tourStep =
        0;
    }

    saveState(
      state
    );

    showAppScreen();

    setActivePage(
      DEFAULT_ROUTE
    );

    refreshUI();

    dispatch(
      'nexus:auth-updated',
      {
        loggedIn:
          true,

        firstRun:
          Boolean(
            isNewAccount
          ),
      }
    );

    if (
      isNewAccount &&
      window.NexusOnboarding
        ?.openVerification
    ) {
      window.setTimeout(
        () => {
          NexusOnboarding.openVerification();
        },
        400
      );
    }
  }

  function getCurrentPage() {
    const active =
      document.querySelector(
        '[data-page].active'
      );

    if (
      active?.dataset.page
    ) {
      return active.dataset.page;
    }

    const visible =
      document.querySelector(
        '[data-page]:not(.hidden)'
      );

    return (
      visible?.dataset.page ||
      DEFAULT_ROUTE
    );
  }

  function setActivePage(
    pageName
  ) {
    const pages =
      Array.from(
        document.querySelectorAll(
          '[data-page]'
        )
      );

    const validPages =
      new Set(
        pages.map(
          (page) =>
            page.dataset.page
        )
      );

    const page =
      validPages.has(
        pageName
      )
        ? pageName
        : DEFAULT_ROUTE;

    pages.forEach(
      (section) => {
        const active =
          section.dataset.page ===
          page;

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
      }
    );

    document
      .querySelectorAll(
        '[data-route]'
      )
      .forEach(
        (button) => {
          const active =
            button.dataset.route ===
            page;

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
        }
      );

    closeDrawer();

    dispatch(
      'nexus:view-changed',
      {
        page,
      }
    );
  }

  function navigate(
    pageName
  ) {
    const state =
      getState();

    if (!state?.loggedIn) {
      showAuthScreen();
      return;
    }

    setActivePage(
      pageName
    );

    refreshUI();
  }

  function bindNavigation() {
    document
      .querySelectorAll(
        '[data-route]'
      )
      .forEach(
        (button) => {
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
            (event) => {
              event.preventDefault();

              navigate(
                button.dataset.route
              );
            }
          );
        }
      );
  }

  function openDrawer() {
    const drawer =
      $(DRAWER_ID);

    if (!drawer) {
      return;
    }

    drawer.classList.add(
      'open'
    );

    document.body.classList.add(
      'drawer-open'
    );

    const focusTarget =
      drawer.querySelector(
        'button, a, input'
      );

    window.setTimeout(
      () => {
        focusTarget?.focus();
      },
      50
    );
  }

  function closeDrawer() {
    const drawer =
      $(DRAWER_ID);

    drawer?.classList.remove(
      'open'
    );

    document.body.classList.remove(
      'drawer-open'
    );
  }

  function bindDrawer() {
    $('drawerOpen')
      ?.addEventListener(
        'click',
        openDrawer
      );

    $('drawerClose')
      ?.addEventListener(
        'click',
        closeDrawer
      );

    const backdrop =
      $(DRAWER_ID)
        ?.querySelector(
          '.drawer-backdrop'
        );

    backdrop?.addEventListener(
      'click',
      closeDrawer
    );
  }

  function getModalPanel(
    name
  ) {
    const panels =
      document.querySelectorAll(
        '[data-modal-panel]'
      );

    return Array.from(
      panels
    ).find(
      (panel) =>
        panel.dataset.modalPanel ===
        name
    );
  }

  function openModal(
    name
  ) {
    const panel =
      getModalPanel(name);

    if (!panel) {
      return false;
    }

    panel.classList.remove(
      'hidden'
    );

    panel.setAttribute(
      'aria-hidden',
      'false'
    );

    document.body.classList.add(
      'modal-open'
    );

    const focusTarget =
      panel.querySelector(
        'input, select, textarea, button'
      );

    window.setTimeout(
      () => {
        focusTarget?.focus();
      },
      40
    );

    return true;
  }

  function closeModal(
    name
  ) {
    const panel =
      getModalPanel(name);

    if (!panel) {
      return;
    }

    panel.classList.add(
      'hidden'
    );

    panel.setAttribute(
      'aria-hidden',
      'true'
    );

    const remaining =
      document.querySelector(
        '[data-modal-panel]:not(.hidden)'
      );

    if (!remaining) {
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
      .forEach(
        (panel) => {
          panel.classList.add(
            'hidden'
          );

          panel.setAttribute(
            'aria-hidden',
            'true'
          );
        }
      );

    document.body.classList.remove(
      'modal-open'
    );
  }

  function bindModals() {
    document
      .querySelectorAll(
        '[data-modal]'
      )
      .forEach(
        (button) => {
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
            (event) => {
              event.preventDefault();

              openModal(
                button.dataset.modal
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
            button.dataset.appBound ===
            'true'
          ) {
            return;
          }

          button.dataset.appBound =
            'true';

          button.addEventListener(
            'click',
            (event) => {
              event.preventDefault();

              closeModal(
                button.dataset.closeModal
              );
            }
          );
        }
      );

    document
      .querySelectorAll(
        '[data-modal-panel]'
      )
      .forEach(
        (panel) => {
          if (
            panel.dataset.appBound ===
            'true'
          ) {
            return;
          }

          panel.dataset.appBound =
            'true';

          panel.addEventListener(
            'click',
            (event) => {
              if (
                event.target ===
                panel
              ) {
                closeModal(
                  panel.dataset.modalPanel
                );
              }
            }
          );
        }
      );
  }

  function bindQuickActions() {
    document
      .querySelectorAll(
        '[data-action="deposit"]'
      )
      .forEach(
        (button) => {
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
                'deposit'
              );
            }
          );
        }
      );

    document
      .querySelectorAll(
        '[data-action="withdraw"]'
      )
      .forEach(
        (button) => {
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
                'withdraw'
              );
            }
          );
        }
      );

    document
      .querySelectorAll(
        '[data-action="trade"]'
      )
      .forEach(
        (button) => {
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
              navigate(
                'trade'
              );
            }
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
            button.dataset.appBound ===
            'true'
          ) {
            return;
          }

          button.dataset.appBound =
            'true';

          button.addEventListener(
            'click',
            async () => {
              const target =
                $(
                  button.dataset.copyTarget
                );

              if (!target) {
                toast(
                  'Address or code could not be found.'
                );

                return;
              }

              const text =
                (
                  target.value ||
                  target.textContent ||
                  ''
                ).trim();

              if (!text) {
                toast(
                  'Nothing to copy.'
                );

                return;
              }

              try {
                await navigator.clipboard.writeText(
                  text
                );

                toast(
                  'Copied to clipboard.'
                );
              } catch {
                toast(
                  'Copy is unavailable in this browser.'
                );
              }
            }
          );
        }
      );
  }

  function bindDepositForm() {
    document
      .querySelectorAll(
        '[data-deposit-form]'
      )
      .forEach(
        (form) => {
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

              const input =
                form.querySelector(
                  'input[type="number"]'
                );

              const amount =
                Number(
                  input?.value
                );

              if (
                window.NexusSimulation
                  ?.simulateDeposit
              ) {
                const result =
                  NexusSimulation.simulateDeposit(
                    amount
                  );

                if (
                  !result?.success
                ) {
                  toast(
                    result?.message ||
                      'Deposit could not be completed.'
                  );

                  return;
                }
              } else {
                const state =
                  getState();

                if (
                  !state?.loggedIn
                ) {
                  toast(
                    'Sign in before making a deposit.'
                  );

                  return;
                }

                if (
                  !Number.isFinite(
                    amount
                  ) ||
                  amount <= 0
                ) {
                  toast(
                    'Enter a valid deposit amount.'
                  );

                  return;
                }

                const value =
                  Number(
                    amount.toFixed(
                      2
                    )
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
                    ).toFixed(
                      2
                    )
                  );

                if (
                  !Array.isArray(
                    state.transactions
                  )
                ) {
                  state.transactions =
                    [];
                }

                state.transactions.unshift(
                  {
                    id:
                      `TX-${Date.now()}`,

                    type:
                      'deposit',

                    amount:
                      value,

                    status:
                      'completed',

                    timestamp:
                      Date.now(),

                    description:
                      'Deposit credited',
                  }
                );

                saveState(
                  state
                );
              }

              if (input) {
                input.value =
                  '';
              }

              closeModal(
                'deposit'
              );

              toast(
                'Deposit recorded successfully.'
              );

              refreshUI();
            }
          );
        }
      );
  }

  function bindWithdrawalForm() {
    document
      .querySelectorAll(
        '[data-withdraw-form]'
      )
      .forEach(
        (form) => {
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
                (
                  addressInput?.value ||
                  ''
                ).trim();

              if (
                window.NexusSimulation
                  ?.simulateWithdrawal
              ) {
                const result =
                  NexusSimulation.simulateWithdrawal(
                    amount,
                    address
                  );

                if (
                  !result?.success
                ) {
                  toast(
                    result?.message ||
                      'Withdrawal could not be completed.'
                  );

                  return;
                }
              } else {
                const state =
                  getState();

                const balance =
                  Number(
                    state?.balance
                  ) || 0;

                if (
                  !state?.loggedIn
                ) {
                  toast(
                    'Sign in before making a withdrawal.'
                  );

                  return;
                }

                if (
                  !Number.isFinite(
                    amount
                  ) ||
                  amount <= 0
                ) {
                  toast(
                    'Enter a valid withdrawal amount.'
                  );

                  return;
                }

                if (!address) {
                  toast(
                    'Enter a withdrawal address.'
                  );

                  return;
                }

                if (
                  amount >
                  balance
                ) {
                  toast(
                    'Withdrawal exceeds the available balance.'
                  );

                  return;
                }

                const value =
                  Number(
                    amount.toFixed(
                      2
                    )
                  );

                state.balance =
                  Number(
                    (
                      balance -
                      value
                    ).toFixed(
                      2
                    )
                  );

                if (
                  !Array.isArray(
                    state.transactions
                  )
                ) {
                  state.transactions =
                    [];
                }

                state.transactions.unshift(
                  {
                    id:
                      `TX-${Date.now()}`,

                    type:
                      'withdrawal',

                    amount:
                      value,

                    address,

                    status:
                      'completed',

                    timestamp:
                      Date.now(),

                    description:
                      'Withdrawal processed',
                  }
                );

                saveState(
                  state
                );
              }

              if (addressInput) {
                addressInput.value =
                  '';
              }

              if (amountInput) {
                amountInput.value =
                  '';
              }

              closeModal(
                'withdraw'
              );

              toast(
                'Withdrawal recorded successfully.'
              );

              refreshUI();
            }
          );
        }
      );
  }

  function bindPlanControls() {
    document
      .querySelectorAll(
        '[data-plan-card]'
      )
      .forEach(
        (card) => {
          if (
            card.dataset.appBound ===
            'true'
          ) {
            return;
          }

          card.dataset.appBound =
            'true';

          card.addEventListener(
            'click',
            () => {
              const planId =
                card.dataset.planCard;

              if (!planId) {
                return;
              }

              const state =
                getState();

              if (!state) {
                return;
              }

              state.selectedPlan =
                planId;

              saveState(
                state
              );

              refreshPlanUI();
            }
          );
        }
      );

    document
      .querySelectorAll(
        '[data-plan-select]'
      )
      .forEach(
        (select) => {
          if (
            select.dataset.appBound ===
            'true'
          ) {
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

              saveState(
                state
              );

              refreshPlanUI();
            }
          );
        }
      );
  }

  function refreshPlanUI() {
    const state =
      getState();

    const plans =
      window.NexusTrading
        ?.plans || {};

    if (!state) {
      return;
    }

    const selectedPlan =
      plans[
        state.selectedPlan
      ] ||
      plans.daily ||
      null;

    document
      .querySelectorAll(
        '[data-plan-card]'
      )
      .forEach(
        (card) => {
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
        }
      );

    document
      .querySelectorAll(
        '[data-plan-select]'
      )
      .forEach(
        (select) => {
          select.value =
            state.selectedPlan;
        }
      );

    if (!selectedPlan) {
      return;
    }

    document
      .querySelectorAll(
        '[data-plan-roi-preview]'
      )
      .forEach(
        (node) => {
          node.textContent =
            `${(
              selectedPlan.targetRoi *
              100
            ).toFixed(0)}%`;
        }
      );

    document
      .querySelectorAll(
        '[data-plan-duration-preview]'
      )
      .forEach(
        (node) => {
          node.textContent =
            selectedPlan.durationLabel ||
            '—';
        }
      );
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

        if (!state?.loggedIn) {
          return;
        }

        const name =
          $('verificationName')
            ?.value
            .trim() ||
          '';

        const country =
          $('verificationCountry')
            ?.value
            .trim() ||
          '';

        const accepted =
          $('verificationTerms')
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

          verified:
            true,
        };

        state.firstRun =
          true;

        state.tourSeen =
          false;

        state.tourStep =
          0;

        saveState(
          state
        );

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

  function bindVerificationLaunchers() {
    document
      .querySelectorAll(
        '[data-open-verification]'
      )
      .forEach(
        (button) => {
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
        }
      );
  }

  function bindReplayTour() {
    document
      .querySelectorAll(
        '[data-replay-tour]'
      )
      .forEach(
        (button) => {
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
        }
      );
  }

  function bindEditProfile() {
    document
      .querySelectorAll(
        '[data-open-edit-profile]'
      )
      .forEach(
        (button) => {
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
        }
      );

    document
      .querySelectorAll(
        '[data-edit-profile-form]'
      )
      .forEach(
        (form) => {
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
                input?.value
                  .trim() ||
                '';

              if (!state) {
                return;
              }

              if (
                name.length <
                2
              ) {
                toast(
                  'Enter a valid display name.'
                );

                return;
              }

              state.user = {
                ...state.user,

                name,
              };

              saveState(
                state
              );

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
        }
      );
  }

  function bindSignOut() {
    document
      .querySelectorAll(
        '[data-sign-out]'
      )
      .forEach(
        (button) => {
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

              saveState(
                state
              );

              closeDrawer();

              closeAllModals();

              showAuthScreen();

              toast(
                'Signed out.'
              );

              dispatch(
                'nexus:auth-signed-out',
                {}
              );
            }
          );
        }
      );
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
      .forEach(
        (node) => {
          node.textContent =
            formatMoney(
              balance
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
            formatMoney(
              balance
            );
        }
      );

    document
      .querySelectorAll(
        '[data-simulated-balance]'
      )
      .forEach(
        (node) => {
          node.textContent =
            formatMoney(
              balance
            );
        }
      );
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
      .forEach(
        (node) => {
          node.textContent =
            getInitials(
              name
            );
        }
      );

    document
      .querySelectorAll(
        '[data-user-name]'
      )
      .forEach(
        (node) => {
          node.textContent =
            name;
        }
      );

    document
      .querySelectorAll(
        '[data-user-email]'
      )
      .forEach(
        (node) => {
          node.textContent =
            user.email ||
            '—';
        }
      );

    document
      .querySelectorAll(
        '[data-user-avatar]'
      )
      .forEach(
        (node) => {
          node.textContent =
            getInitials(
              name
            );
        }
      );

    document
      .querySelectorAll(
        '[data-header-status]'
      )
      .forEach(
        (node) => {
          node.textContent =
            verified
              ? 'Verified'
              : 'Not verified';
        }
      );

    document
      .querySelectorAll(
        '[data-verification-status]'
      )
      .forEach(
        (node) => {
          node.textContent =
            verified
              ? 'Verified'
              : 'Not verified';

          node.classList.toggle(
            'verified',
            verified
          );

          node.classList.toggle(
            'unverified',
            !verified
          );
        }
      );
  }

  function getInitials(
    name
  ) {
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

  function formatMoney(
    value
  ) {
    const amount =
      Number(value) ||
      0;

    try {
      return new Intl.NumberFormat(
        'en-US',
        {
          style:
            'currency',

          currency:
            'USD',

          minimumFractionDigits:
            2,

          maximumFractionDigits:
            2,
        }
      ).format(
        amount
      );
    } catch {
      return `$${amount.toFixed(
        2
      )}`;
    }
  }

  function refreshUI() {
    refreshBalanceUI();

    refreshUserUI();

    refreshPlanUI();

    window.NexusTrading
      ?.render
      ?.();

    window.NexusSimulation
      ?.render
      ?.();

    window.NexusCommunity
      ?.render
      ?.();

    window.NexusProfile
      ?.render
      ?.();
  }

  function bindGlobalEvents() {
    window.addEventListener(
      'nexus:balance-updated',
      refreshBalanceUI
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
      refreshUI
    );

    window.addEventListener(
      'nexus:storage-updated',
      refreshUI
    );
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

        const tourModal =
          $('tourModal');

        if (
          tourModal &&
          !tourModal.classList.contains(
            'hidden'
          )
        ) {
          window.NexusOnboarding
            ?.skipTour
            ?.();
        }

        hideVerification();
      }
    );
  }

  function initializeAuthState() {
    const state =
      getState();

    if (
      state?.loggedIn
    ) {
      showAppScreen();

      setActivePage(
        DEFAULT_ROUTE
      );

      return;
    }

    showAuthScreen();
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
    bindNavigation();
    bindDrawer();
    bindModals();
    bindQuickActions();
    bindCopyButtons();
    bindDepositForm();
    bindWithdrawalForm();
    bindPlanControls();
    bindVerification();
    bindVerificationLaunchers();
    bindReplayTour();
    bindEditProfile();
    bindSignOut();
    bindGlobalEvents();
    bindKeyboard();
    initializeAuthState();
    refreshUI();
  }

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
