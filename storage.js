'use strict';

/*
 * NEXUS Storage Module
 * --------------------
 * Centralized localStorage manager for the
 * simulation-only application.
 *
 * Stores:
 * - User/session state
 * - Simulated balance
 * - Active trade
 * - Trade history
 * - Transactions
 * - Community posts
 * - Settings
 * - Onboarding state
 *
 * No server database.
 * No real credentials.
 * No real financial transactions.
 */

(function () {
  const STORAGE_KEY =
    'nexusSimulatorState';

  const VERSION_KEY =
    'nexusSimulatorStorageVersion';

  const STORAGE_VERSION =
    1;

  const DEFAULT_STATE = {
    loggedIn: false,

    user: {
      name: 'Trader Account',
      email: 'demo@nexus.local',
      verified: false,
      inviteCode: ''
    },

    balance: 0,

    selectedPlan:
      'daily',

    activeTrade:
      null,

    tradeHistory:
      [],

    transactions:
      [],

    communityPosts:
      [],

    notifications:
      2,

    tourSeen:
      false,

    tourStep:
      0,

    settings: {
      notifications:
        true,

      dark:
        true
    }
  };

  function clone(value) {
    try {
      return JSON.parse(
        JSON.stringify(value)
      );
    } catch (error) {
      console.warn(
        'NEXUS storage: clone failed.',
        error
      );

      return null;
    }
  }

  function mergeState(
    base,
    incoming
  ) {
    const source =
      incoming &&
      typeof incoming ===
        'object'
        ? incoming
        : {};

    return {
      ...clone(base),

      ...source,

      user: {
        ...clone(base.user),
        ...(source.user || {})
      },

      settings: {
        ...clone(base.settings),
        ...(source.settings || {})
      },

      tradeHistory:
        Array.isArray(
          source.tradeHistory
        )
          ? source.tradeHistory
          : [],

      transactions:
        Array.isArray(
          source.transactions
        )
          ? source.transactions
          : [],

      communityPosts:
        Array.isArray(
          source.communityPosts
        )
          ? source.communityPosts
          : []
    };
  }

  function isStorageAvailable() {
    try {
      const testKey =
        '__nexus_storage_test__';

      localStorage.setItem(
        testKey,
        '1'
      );

      localStorage.removeItem(
        testKey
      );

      return true;
    } catch (error) {
      return false;
    }
  }

  function getRaw() {
    if (
      !isStorageAvailable()
    ) {
      return null;
    }

    try {
      return localStorage.getItem(
        STORAGE_KEY
      );
    } catch (error) {
      console.warn(
        'NEXUS storage: read failed.',
        error
      );

      return null;
    }
  }

  function getState() {
    const raw =
      getRaw();

    if (!raw) {
      return clone(
        DEFAULT_STATE
      );
    }

    try {
      const parsed =
        JSON.parse(raw);

      return mergeState(
        DEFAULT_STATE,
        parsed
      );
    } catch (error) {
      console.warn(
        'NEXUS storage: corrupted state detected. Resetting to defaults.',
        error
      );

      return clone(
        DEFAULT_STATE
      );
    }
  }

  function setState(
    nextState
  ) {
    if (
      !isStorageAvailable()
    ) {
      return false;
    }

    try {
      const safeState =
        mergeState(
          DEFAULT_STATE,
          nextState
        );

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          safeState
        )
      );

      localStorage.setItem(
        VERSION_KEY,
        String(
          STORAGE_VERSION
        )
      );

      dispatch(
        'nexus:storage-updated',
        {
          state:
            safeState
        }
      );

      return true;
    } catch (error) {
      console.warn(
        'NEXUS storage: write failed.',
        error
      );

      return false;
    }
  }

  function updateState(
    updater
  ) {
    if (
      typeof updater !==
      'function'
    ) {
      return {
        success: false,
        state:
          getState(),
        message:
          'Storage updater must be a function.'
      };
    }

    const current =
      getState();

    let next;

    try {
      next =
        updater(
          clone(current)
        );
    } catch (error) {
      console.error(
        'NEXUS storage: state update failed.',
        error
      );

      return {
        success: false,
        state:
          current,
        message:
          'Unable to update simulation state.'
      };
    }

    /*
     * Allow updater functions to mutate
     * and return the state, or return a
     * completely new state object.
     */
    const finalState =
      next &&
      typeof next ===
        'object'
        ? next
        : current;

    const success =
      setState(
        finalState
      );

    return {
      success,
      state:
        getState()
    };
  }

  function resetState() {
    if (
      !isStorageAvailable()
    ) {
      return false;
    }

    try {
      localStorage.removeItem(
        STORAGE_KEY
      );

      localStorage.setItem(
        VERSION_KEY,
        String(
          STORAGE_VERSION
        )
      );

      dispatch(
        'nexus:storage-reset',
        {}
      );

      return true;
    } catch (error) {
      console.warn(
        'NEXUS storage: reset failed.',
        error
      );

      return false;
    }
  }

  function clearEverything() {
    if (
      !isStorageAvailable()
    ) {
      return false;
    }

    try {
      Object.keys(
        localStorage
      )
        .filter(
          (key) =>
            key.startsWith(
              'nexus'
            )
        )
        .forEach(
          (key) => {
            localStorage.removeItem(
              key
            );
          }
        );

      dispatch(
        'nexus:storage-cleared',
        {}
      );

      return true;
    } catch (error) {
      console.warn(
        'NEXUS storage: full clear failed.',
        error
      );

      return false;
    }
  }

  function get(
    path,
    fallback = null
  ) {
    const state =
      getState();

    if (
      !path ||
      typeof path !==
        'string'
    ) {
      return fallback;
    }

    const parts =
      path.split(
        '.'
      );

    let value =
      state;

    for (
      const part of parts
    ) {
      if (
        value ===
          null ||
        value ===
          undefined ||
        !Object.prototype.hasOwnProperty.call(
          value,
          part
        )
      ) {
        return fallback;
      }

      value =
        value[part];
    }

    return value;
  }

  function set(
    path,
    value
  ) {
    if (
      !path ||
      typeof path !==
        'string'
    ) {
      return false;
    }

    const parts =
      path.split(
        '.'
      );

    if (
      parts.some(
        (part) => !part
      )
    ) {
      return false;
    }

    const result =
      updateState(
        (state) => {
          let target =
            state;

          for (
            let i = 0;
            i <
            parts.length -
              1;
            i += 1
          ) {
            const part =
              parts[i];

            if (
              !target[part] ||
              typeof target[
                part
              ] !==
                'object'
            ) {
              target[part] =
                {};
            }

            target =
              target[part];
          }

          target[
            parts[
              parts.length - 1
            ]
          ] = value;

          return state;
        }
      );

    return result.success;
  }

  function remove(
    path
  ) {
    if (
      !path ||
      typeof path !==
        'string'
    ) {
      return false;
    }

    const parts =
      path.split(
        '.'
      );

    if (
      parts.length ===
      0
    ) {
      return false;
    }

    const result =
      updateState(
        (state) => {
          let target =
            state;

          for (
            let i = 0;
            i <
            parts.length -
              1;
            i += 1
          ) {
            const part =
              parts[i];

            if (
              !target[part] ||
              typeof target[
                part
              ] !==
                'object'
            ) {
              return state;
            }

            target =
              target[part];
          }

          delete target[
            parts[
              parts.length - 1
            ]
          ];

          return state;
        }
      );

    return result.success;
  }

  function push(
    path,
    item,
    maxItems = null
  ) {
    const result =
      updateState(
        (state) => {
          const parts =
            path.split(
              '.'
            );

          let target =
            state;

          for (
            let i = 0;
            i <
            parts.length;
            i += 1
          ) {
            const part =
              parts[i];

            if (
              i ===
              parts.length -
                1
            ) {
              if (
                !Array.isArray(
                  target[part]
                )
              ) {
                target[part] =
                  [];
              }

              target[
                part
              ].push(
                clone(item)
              );

              if (
                Number.isInteger(
                  maxItems
                ) &&
                maxItems >
                  0 &&
                target[
                  part
                ].length >
                  maxItems
              ) {
                target[
                  part
                ] =
                  target[
                    part
                  ].slice(
                    0,
                    maxItems
                  );
              }

              break;
            }

            if (
              !target[part] ||
              typeof target[
                part
              ] !==
                'object'
            ) {
              target[part] =
                {};
            }

            target =
              target[part];
          }

          return state;
        }
      );

    return result.success;
  }

  function removeById(
    path,
    id
  ) {
    const result =
      updateState(
        (state) => {
          const parts =
            path.split(
              '.'
            );

          let parent =
            state;

          for (
            let i = 0;
            i <
            parts.length -
              1;
            i += 1
          ) {
            if (
              !parent[
                parts[i]
              ]
            ) {
              return state;
            }

            parent =
              parent[
                parts[i]
              ];
          }

          const key =
            parts[
              parts.length -
                1
            ];

          if (
            !Array.isArray(
              parent[key]
            )
          ) {
            return state;
          }

          parent[key] =
            parent[key].filter(
              (item) =>
                item?.id !==
                id
            );

          return state;
        }
      );

    return result.success;
  }

  function exportState() {
    const state =
      getState();

    return JSON.stringify(
      state,
      null,
      2
    );
  }

  function importState(
    data
  ) {
    let parsed;

    try {
      if (
        typeof data ===
        'string'
      ) {
        parsed =
          JSON.parse(
            data
          );
      } else {
        parsed =
          data;
      }
    } catch (error) {
      return {
        success: false,
        message:
          'Invalid simulation data.'
      };
    }

    if (
      !parsed ||
      typeof parsed !==
        'object'
    ) {
      return {
        success: false,
        message:
          'Simulation data must be an object.'
      };
    }

    const safeState =
      mergeState(
        DEFAULT_STATE,
        parsed
      );

    const success =
      setState(
        safeState
      );

    return {
      success,
      state:
        safeState,
      message:
        success
          ? 'Simulation state imported.'
          : 'Simulation state could not be imported.'
    };
  }

  function getVersion() {
    return STORAGE_VERSION;
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
        'NEXUS storage event skipped.',
        error
      );
    }
  }

  function runMigration() {
    const storedVersion =
      Number(
        localStorage.getItem(
          VERSION_KEY
        )
      ) || 0;

    if (
      storedVersion ===
      STORAGE_VERSION
    ) {
      return;
    }

    /*
     * Future migrations can be added here.
     * For version 1, normalize whatever
     * state already exists.
     */
    const normalized =
      getState();

    setState(
      normalized
    );
  }

  function init() {
    if (
      !isStorageAvailable()
    ) {
      console.warn(
        'NEXUS storage: localStorage is unavailable. The simulator will not persist data.'
      );

      return;
    }

    runMigration();
  }

  window.NexusStorage =
    Object.freeze({
      key:
        STORAGE_KEY,

      version:
        STORAGE_VERSION,

      defaults:
        clone(
          DEFAULT_STATE
        ),

      available:
        isStorageAvailable(),

      getState,

      setState,

      updateState,

      resetState,

      clearEverything,

      get,

      set,

      remove,

      push,

      removeById,

      exportState,

      importState,

      getVersion
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
