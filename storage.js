'use strict';

/*
 * NEXUS Storage Module
 * --------------------
 * Central browser storage for the NEXUS application.
 *
 * Keeps one shared state object for:
 * - Authentication
 * - User profile
 * - Verification status
 * - Balance
 * - Trading cycles
 * - Trade history
 * - Transactions
 * - Community posts
 * - Notifications
 * - Settings
 * - Onboarding state
 *
 * Browser-only prototype storage.
 */

(() => {
  const STORAGE_KEY =
    'nexusSimulatorState';

  const VERSION_KEY =
    'nexusSimulatorStorageVersion';

  const CURRENT_VERSION = 1;

  const DEFAULT_STATE = {
    loggedIn: false,

    firstRun: true,

    user: {
      name: 'Trader Account',
      email: 'demo@nexus.local',
      verified: false,
      inviteCode: '',
      verificationCountry: '',
    },

    balance: 0,

    selectedPlan: 'daily',

    activeTrade: null,

    tradeHistory: [],

    transactions: [],

    communityPosts: [],

    notifications: 0,

    tourSeen: false,

    tourStep: 0,

    settings: {
      notifications: true,
      dark: true,
    },
  };

  function clone(value) {
    return JSON.parse(
      JSON.stringify(value)
    );
  }

  function isAvailable() {
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
    } catch {
      return false;
    }
  }

  function normalizeState(
    incoming = {}
  ) {
    const source =
      incoming &&
      typeof incoming === 'object'
        ? incoming
        : {};

    return {
      ...clone(DEFAULT_STATE),

      ...source,

      user: {
        ...clone(
          DEFAULT_STATE.user
        ),

        ...(source.user || {}),
      },

      settings: {
        ...clone(
          DEFAULT_STATE.settings
        ),

        ...(source.settings || {}),
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
          : [],
    };
  }

  function get() {
    if (!isAvailable()) {
      return clone(
        DEFAULT_STATE
      );
    }

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

      return normalizeState(
        parsed
      );
    } catch (error) {
      console.warn(
        'NEXUS Storage: invalid saved state. Resetting state.',
        error
      );

      return clone(
        DEFAULT_STATE
      );
    }
  }

  function set(state) {
    if (!isAvailable()) {
      return false;
    }

    try {
      const normalized =
        normalizeState(
          state
        );

      localStorage.setItem(
        STORAGE_KEY,

        JSON.stringify(
          normalized
        )
      );

      localStorage.setItem(
        VERSION_KEY,

        String(
          CURRENT_VERSION
        )
      );

      dispatch(
        'nexus:storage-updated',
        {
          state:
            normalized,
        }
      );

      return true;
    } catch (error) {
      console.warn(
        'NEXUS Storage: unable to save state.',
        error
      );

      return false;
    }
  }

  function update(
    updater
  ) {
    if (
      typeof updater !==
      'function'
    ) {
      return {
        success: false,

        state: get(),

        message:
          'Storage updater must be a function.',
      };
    }

    const current =
      get();

    let nextState;

    try {
      nextState =
        updater(
          clone(current)
        );
    } catch (error) {
      console.error(
        'NEXUS Storage: update failed.',
        error
      );

      return {
        success: false,

        state: current,

        message:
          'Unable to update application state.',
      };
    }

    if (
      !nextState ||
      typeof nextState !==
        'object'
    ) {
      nextState =
        current;
    }

    const success =
      set(
        nextState
      );

    return {
      success,

      state:
        get(),
    };
  }

  function getValue(
    path,
    fallback = null
  ) {
    const state =
      get();

    if (
      typeof path !==
        'string' ||
      !path.trim()
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
        value === null ||
        value === undefined ||
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

  function setValue(
    path,
    value
  ) {
    if (
      typeof path !==
        'string' ||
      !path.trim()
    ) {
      return false;
    }

    const parts =
      path.split(
        '.'
      );

    if (
      parts.some(
        (part) =>
          !part.trim()
      )
    ) {
      return false;
    }

    const result =
      update(
        (state) => {
          let target =
            state;

          for (
            let index = 0;
            index <
            parts.length - 1;
            index += 1
          ) {
            const part =
              parts[index];

            if (
              !target[part] ||
              typeof target[part] !==
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

  function removeValue(
    path
  ) {
    if (
      typeof path !==
        'string' ||
      !path.trim()
    ) {
      return false;
    }

    const parts =
      path.split(
        '.'
      );

    const result =
      update(
        (state) => {
          let target =
            state;

          for (
            let index = 0;
            index <
            parts.length - 1;
            index += 1
          ) {
            const part =
              parts[index];

            if (
              !target[part] ||
              typeof target[part] !==
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

  function pushValue(
    path,
    item,
    maxItems = null
  ) {
    const result =
      update(
        (state) => {
          const parts =
            path.split(
              '.'
            );

          let target =
            state;

          for (
            let index = 0;
            index <
            parts.length;
            index += 1
          ) {
            const part =
              parts[index];

            const isLast =
              index ===
              parts.length - 1;

            if (isLast) {
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
                maxItems > 0
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
              typeof target[part] !==
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
      update(
        (state) => {
          const parts =
            path.split(
              '.'
            );

          let parent =
            state;

          for (
            let index = 0;
            index <
            parts.length - 1;
            index += 1
          ) {
            const part =
              parts[index];

            if (
              !parent[part] ||
              typeof parent[part] !==
                'object'
            ) {
              return state;
            }

            parent =
              parent[part];
          }

          const key =
            parts[
              parts.length - 1
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
                item?.id !== id
            );

          return state;
        }
      );

    return result.success;
  }

  function reset() {
    if (!isAvailable()) {
      return false;
    }

    try {
      localStorage.removeItem(
        STORAGE_KEY
      );

      localStorage.setItem(
        VERSION_KEY,
        String(
          CURRENT_VERSION
        )
      );

      dispatch(
        'nexus:storage-reset',
        {}
      );

      return true;
    } catch (error) {
      console.warn(
        'NEXUS Storage: reset failed.',
        error
      );

      return false;
    }
  }

  function clearNexusData() {
    if (!isAvailable()) {
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
        'NEXUS Storage: clear failed.',
        error
      );

      return false;
    }
  }

  function exportState() {
    return JSON.stringify(
      get(),
      null,
      2
    );
  }

  function importState(
    data
  ) {
    let parsed;

    try {
      parsed =
        typeof data ===
        'string'
          ? JSON.parse(data)
          : data;
    } catch {
      return {
        success: false,

        message:
          'Invalid state data.',
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
          'State data must be an object.',
      };
    }

    const normalized =
      normalizeState(
        parsed
      );

    const success =
      set(
        normalized
      );

    return {
      success,

      state:
        get(),
    };
  }

  function getVersion() {
    if (!isAvailable()) {
      return CURRENT_VERSION;
    }

    return (
      Number(
        localStorage.getItem(
          VERSION_KEY
        )
      ) ||
      CURRENT_VERSION
    );
  }

  function migrate() {
    if (!isAvailable()) {
      return;
    }

    const version =
      getVersion();

    if (
      version >=
      CURRENT_VERSION
    ) {
      return;
    }

    /*
     * Version 1 migration:
     * normalize any existing saved state.
     */
    set(
      get()
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
        'NEXUS Storage event skipped.',
        error
      );
    }
  }

  function init() {
    if (
      !isAvailable()
    ) {
      console.warn(
        'NEXUS Storage: localStorage is unavailable. State will not persist.'
      );

      return;
    }

    migrate();
  }

  window.NexusStorage = {
    key:
      STORAGE_KEY,

    version:
      CURRENT_VERSION,

    available:
      isAvailable(),

    defaults:
      clone(
        DEFAULT_STATE
      ),

    get,

    set,

    update,

    getValue,

    setValue,

    removeValue,

    pushValue,

    removeById,

    reset,

    clearNexusData,

    exportState,

    importState,

    getVersion,
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
