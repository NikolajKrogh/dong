var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/is-plain-obj/index.js
var require_is_plain_obj = __commonJS({
  "node_modules/is-plain-obj/index.js"(exports2, module2) {
    "use strict";
    module2.exports = (value) => {
      if (Object.prototype.toString.call(value) !== "[object Object]") {
        return false;
      }
      const prototype = Object.getPrototypeOf(value);
      return prototype === null || prototype === Object.prototype;
    };
  }
});

// node_modules/merge-options/index.js
var require_merge_options = __commonJS({
  "node_modules/merge-options/index.js"(exports2, module2) {
    "use strict";
    var isOptionObject = require_is_plain_obj();
    var { hasOwnProperty } = Object.prototype;
    var { propertyIsEnumerable } = Object;
    var defineProperty = /* @__PURE__ */ __name((object, name, value) => Object.defineProperty(object, name, {
      value,
      writable: true,
      enumerable: true,
      configurable: true
    }), "defineProperty");
    var globalThis = exports2;
    var defaultMergeOptions = {
      concatArrays: false,
      ignoreUndefined: false
    };
    var getEnumerableOwnPropertyKeys = /* @__PURE__ */ __name((value) => {
      const keys = [];
      for (const key in value) {
        if (hasOwnProperty.call(value, key)) {
          keys.push(key);
        }
      }
      if (Object.getOwnPropertySymbols) {
        const symbols = Object.getOwnPropertySymbols(value);
        for (const symbol of symbols) {
          if (propertyIsEnumerable.call(value, symbol)) {
            keys.push(symbol);
          }
        }
      }
      return keys;
    }, "getEnumerableOwnPropertyKeys");
    function clone(value) {
      if (Array.isArray(value)) {
        return cloneArray(value);
      }
      if (isOptionObject(value)) {
        return cloneOptionObject(value);
      }
      return value;
    }
    __name(clone, "clone");
    function cloneArray(array) {
      const result = array.slice(0, 0);
      getEnumerableOwnPropertyKeys(array).forEach((key) => {
        defineProperty(result, key, clone(array[key]));
      });
      return result;
    }
    __name(cloneArray, "cloneArray");
    function cloneOptionObject(object) {
      const result = Object.getPrototypeOf(object) === null ? /* @__PURE__ */ Object.create(null) : {};
      getEnumerableOwnPropertyKeys(object).forEach((key) => {
        defineProperty(result, key, clone(object[key]));
      });
      return result;
    }
    __name(cloneOptionObject, "cloneOptionObject");
    var mergeKeys = /* @__PURE__ */ __name((merged, source, keys, config2) => {
      keys.forEach((key) => {
        if (typeof source[key] === "undefined" && config2.ignoreUndefined) {
          return;
        }
        if (key in merged && merged[key] !== Object.getPrototypeOf(merged)) {
          defineProperty(merged, key, merge(merged[key], source[key], config2));
        } else {
          defineProperty(merged, key, clone(source[key]));
        }
      });
      return merged;
    }, "mergeKeys");
    var concatArrays = /* @__PURE__ */ __name((merged, source, config2) => {
      let result = merged.slice(0, 0);
      let resultIndex = 0;
      [merged, source].forEach((array) => {
        const indices = [];
        for (let k = 0; k < array.length; k++) {
          if (!hasOwnProperty.call(array, k)) {
            continue;
          }
          indices.push(String(k));
          if (array === merged) {
            defineProperty(result, resultIndex++, array[k]);
          } else {
            defineProperty(result, resultIndex++, clone(array[k]));
          }
        }
        result = mergeKeys(result, array, getEnumerableOwnPropertyKeys(array).filter((key) => !indices.includes(key)), config2);
      });
      return result;
    }, "concatArrays");
    function merge(merged, source, config2) {
      if (config2.concatArrays && Array.isArray(merged) && Array.isArray(source)) {
        return concatArrays(merged, source, config2);
      }
      if (!isOptionObject(source) || !isOptionObject(merged)) {
        return clone(source);
      }
      return mergeKeys(merged, source, getEnumerableOwnPropertyKeys(source), config2);
    }
    __name(merge, "merge");
    module2.exports = function(...options) {
      const config2 = merge(clone(defaultMergeOptions), this !== globalThis && this || {}, defaultMergeOptions);
      let merged = { _: {} };
      for (const option of options) {
        if (option === void 0) {
          continue;
        }
        if (!isOptionObject(option)) {
          throw new TypeError("`" + option + "` is not an Option Object");
        }
        merged = merge(merged, { _: option }, config2);
      }
      return merged._;
    };
  }
});

// node_modules/@react-native-async-storage/async-storage/lib/commonjs/AsyncStorage.js
var require_AsyncStorage = __commonJS({
  "node_modules/@react-native-async-storage/async-storage/lib/commonjs/AsyncStorage.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.default = void 0;
    var _mergeOptions = _interopRequireDefault(require_merge_options());
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    __name(_interopRequireDefault, "_interopRequireDefault");
    var merge = _mergeOptions.default.bind({
      concatArrays: true,
      ignoreUndefined: true
    });
    function mergeLocalStorageItem(key, value) {
      const oldValue = window.localStorage.getItem(key);
      if (oldValue) {
        const oldObject = JSON.parse(oldValue);
        const newObject = JSON.parse(value);
        const nextValue = JSON.stringify(merge(oldObject, newObject));
        window.localStorage.setItem(key, nextValue);
      } else {
        window.localStorage.setItem(key, value);
      }
    }
    __name(mergeLocalStorageItem, "mergeLocalStorageItem");
    function createPromise(getValue, callback) {
      return new Promise((resolve, reject) => {
        try {
          const value = getValue();
          callback === null || callback === void 0 ? void 0 : callback(null, value);
          resolve(value);
        } catch (err) {
          callback === null || callback === void 0 ? void 0 : callback(err);
          reject(err);
        }
      });
    }
    __name(createPromise, "createPromise");
    function createPromiseAll(promises, callback, processResult) {
      return Promise.all(promises).then((result) => {
        const value = (processResult === null || processResult === void 0 ? void 0 : processResult(result)) ?? null;
        callback === null || callback === void 0 ? void 0 : callback(null, value);
        return Promise.resolve(value);
      }, (errors) => {
        callback === null || callback === void 0 ? void 0 : callback(errors);
        return Promise.reject(errors);
      });
    }
    __name(createPromiseAll, "createPromiseAll");
    var AsyncStorage2 = {
      /**
       * Fetches `key` value.
       */
      getItem: /* @__PURE__ */ __name((key, callback) => {
        return createPromise(() => window.localStorage.getItem(key), callback);
      }, "getItem"),
      /**
       * Sets `value` for `key`.
       */
      setItem: /* @__PURE__ */ __name((key, value, callback) => {
        return createPromise(() => window.localStorage.setItem(key, value), callback);
      }, "setItem"),
      /**
       * Removes a `key`
       */
      removeItem: /* @__PURE__ */ __name((key, callback) => {
        return createPromise(() => window.localStorage.removeItem(key), callback);
      }, "removeItem"),
      /**
       * Merges existing value with input value, assuming they are stringified JSON.
       */
      mergeItem: /* @__PURE__ */ __name((key, value, callback) => {
        return createPromise(() => mergeLocalStorageItem(key, value), callback);
      }, "mergeItem"),
      /**
       * Erases *all* AsyncStorage for the domain.
       */
      clear: /* @__PURE__ */ __name((callback) => {
        return createPromise(() => window.localStorage.clear(), callback);
      }, "clear"),
      /**
       * Gets *all* keys known to the app, for all callers, libraries, etc.
       */
      getAllKeys: /* @__PURE__ */ __name((callback) => {
        return createPromise(() => {
          const numberOfKeys = window.localStorage.length;
          const keys = [];
          for (let i = 0; i < numberOfKeys; i += 1) {
            const key = window.localStorage.key(i) || "";
            keys.push(key);
          }
          return keys;
        }, callback);
      }, "getAllKeys"),
      /**
       * (stub) Flushes any pending requests using a single batch call to get the data.
       */
      flushGetRequests: /* @__PURE__ */ __name(() => void 0, "flushGetRequests"),
      /**
       * multiGet resolves to an array of key-value pair arrays that matches the
       * input format of multiSet.
       *
       *   multiGet(['k1', 'k2']) -> [['k1', 'val1'], ['k2', 'val2']]
       */
      multiGet: /* @__PURE__ */ __name((keys, callback) => {
        const promises = keys.map((key) => AsyncStorage2.getItem(key));
        const processResult = /* @__PURE__ */ __name((result) => result.map((value, i) => [keys[i], value]), "processResult");
        return createPromiseAll(promises, callback, processResult);
      }, "multiGet"),
      /**
       * Takes an array of key-value array pairs.
       *   multiSet([['k1', 'val1'], ['k2', 'val2']])
       */
      multiSet: /* @__PURE__ */ __name((keyValuePairs, callback) => {
        const promises = keyValuePairs.map((item) => AsyncStorage2.setItem(item[0], item[1]));
        return createPromiseAll(promises, callback);
      }, "multiSet"),
      /**
       * Delete all the keys in the `keys` array.
       */
      multiRemove: /* @__PURE__ */ __name((keys, callback) => {
        const promises = keys.map((key) => AsyncStorage2.removeItem(key));
        return createPromiseAll(promises, callback);
      }, "multiRemove"),
      /**
       * Takes an array of key-value array pairs and merges them with existing
       * values, assuming they are stringified JSON.
       *
       *   multiMerge([['k1', 'val1'], ['k2', 'val2']])
       */
      multiMerge: /* @__PURE__ */ __name((keyValuePairs, callback) => {
        const promises = keyValuePairs.map((item) => AsyncStorage2.mergeItem(item[0], item[1]));
        return createPromiseAll(promises, callback);
      }, "multiMerge")
    };
    var _default = AsyncStorage2;
    exports2.default = _default;
  }
});

// node_modules/@react-native-async-storage/async-storage/lib/commonjs/hooks.js
var require_hooks = __commonJS({
  "node_modules/@react-native-async-storage/async-storage/lib/commonjs/hooks.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.useAsyncStorage = useAsyncStorage;
    var _AsyncStorage = _interopRequireDefault(require_AsyncStorage());
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    __name(_interopRequireDefault, "_interopRequireDefault");
    function useAsyncStorage(key) {
      return {
        getItem: /* @__PURE__ */ __name((...args) => _AsyncStorage.default.getItem(key, ...args), "getItem"),
        setItem: /* @__PURE__ */ __name((...args) => _AsyncStorage.default.setItem(key, ...args), "setItem"),
        mergeItem: /* @__PURE__ */ __name((...args) => _AsyncStorage.default.mergeItem(key, ...args), "mergeItem"),
        removeItem: /* @__PURE__ */ __name((...args) => _AsyncStorage.default.removeItem(key, ...args), "removeItem")
      };
    }
    __name(useAsyncStorage, "useAsyncStorage");
  }
});

// node_modules/@react-native-async-storage/async-storage/lib/commonjs/index.js
var require_commonjs = __commonJS({
  "node_modules/@react-native-async-storage/async-storage/lib/commonjs/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.default = void 0;
    Object.defineProperty(exports2, "useAsyncStorage", {
      enumerable: true,
      get: /* @__PURE__ */ __name(function() {
        return _hooks.useAsyncStorage;
      }, "get")
    });
    var _AsyncStorage = _interopRequireDefault(require_AsyncStorage());
    var _hooks = require_hooks();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    __name(_interopRequireDefault, "_interopRequireDefault");
    var _default = _AsyncStorage.default;
    exports2.default = _default;
  }
});

// tamagui.config.ts
var tamagui_config_exports = {};
__export(tamagui_config_exports, {
  default: () => tamagui_config_default
});
module.exports = __toCommonJS(tamagui_config_exports);

// node_modules/tamagui/dist/esm/createTamagui.mjs
var import_core = require("@tamagui/core");
var createTamagui = process.env.NODE_ENV !== "development" ? import_core.createTamagui : (conf) => {
  const sizeTokenKeys = ["$true"], hasKeys = /* @__PURE__ */ __name((expectedKeys, obj) => expectedKeys.every((k) => typeof obj[k] < "u"), "hasKeys"), tamaguiConfig = (0, import_core.createTamagui)(conf);
  for (const name of ["size", "space"]) {
    const tokenSet = tamaguiConfig.tokensParsed[name];
    if (!tokenSet) throw new Error(`Expected tokens for "${name}" in ${Object.keys(tamaguiConfig.tokensParsed).join(", ")}`);
    if (!hasKeys(sizeTokenKeys, tokenSet)) throw new Error(`
createTamagui() missing expected tokens.${name}:

Received: ${Object.keys(tokenSet).join(", ")}

Expected: ${sizeTokenKeys.join(", ")}

Tamagui expects a "true" key that is the same value as your default size. This is so 
it can size things up or down from the defaults without assuming which keys you use.

Please define a "true" or "$true" key on your size and space tokens like so (example):

size: {
  sm: 2,
  md: 10,
  true: 10, // this means "md" is your default size
  lg: 20,
}

`);
  }
  const expected = Object.keys(tamaguiConfig.tokensParsed.size);
  for (const name of ["radius", "zIndex"]) {
    const tokenSet = tamaguiConfig.tokensParsed[name], received = Object.keys(tokenSet);
    if (!received.some((rk) => expected.includes(rk))) throw new Error(`
createTamagui() invalid tokens.${name}:

Received: ${received.join(", ")}

Expected a subset of: ${expected.join(", ")}

`);
  }
  return tamaguiConfig;
};

// node_modules/tamagui/dist/esm/index.mjs
var import_core2 = require("@tamagui/core");

// app/style/palette.ts
var colors = {
  // --- Primary ---
  primary: "#0275d8",
  primaryLight: "#e3f2fd",
  primaryLighter: "#f0f8ff",
  primaryDark: "#0056b3",
  primaryFocus: "#1976d2",
  primaryTransparentLight: "rgba(2, 117, 216, 0.08)",
  // --- Secondary & Grays ---
  secondary: "#6c757d",
  lightGray: "#f8f9fa",
  // Alias for backgroundLight
  mediumGray: "#e9ecef",
  // Alias for borderSubtle
  darkGray: "#adb5bd",
  // Alias for textDisabled
  neutralGray: "#ccc",
  // --- Status: Success ---
  success: "#28a745",
  successLight: "#e8f5e9",
  successText: "#fff",
  successDarkText: "#155724",
  successOwedText: "#388e3c",
  // --- Status: Danger/Error ---
  danger: "#dc3545",
  dangerLight: "#ffebee",
  dangerText: "#fff",
  dangerOwedText: "#d32f2f",
  error: "#dc3545",
  // Alias for danger
  // --- Status: Warning ---
  warning: "#ffc107",
  warningLight: "#fff8e1",
  warningText: "#212529",
  // --- Status: Info ---
  info: "#17a2b8",
  infoLight: "#e0f7fa",
  // --- Backgrounds ---
  background: "#f5f5f5",
  backgroundLight: "#f8f9fa",
  backgroundSubtle: "#f0f0f0",
  surface: "#fff",
  darkSurface: "#333",
  toastBackground: "#222222",
  backgroundModalOverlay: "rgba(0, 0, 0, 0.5)",
  // --- Text ---
  textPrimary: "#212529",
  textSecondary: "#333",
  textMuted: "#6c757d",
  textDisabled: "#adb5bd",
  textLight: "#fff",
  textPlaceholder: "#999",
  textLink: "#0275d8",
  // --- Borders ---
  border: "#ddd",
  borderLight: "#e0e0e0",
  borderLighter: "#eee",
  borderSubtle: "#e9ecef",
  // --- Component Specific ---
  awayTeam: "#fd7e14",
  liveIndicator: "#e74c3c",
  owedPositiveBorder: "#e57373",
  owedZeroBorder: "#81c784",
  playerItemOddBackground: "#fff8f0",
  countBadgeBorder: "#81d4fa",
  compactMatchItemSelectedBorder: "#b3d7ff",
  processingIndicatorBorder: "#b8daff",
  // --- Switch (from userPreferences) ---
  switchTrackOff: "#d1d1d1",
  switchTrackOn: "#a3c9f0",
  thumbOn: "#0275d8",
  thumbOff: "#f4f3f4",
  // --- History Specific (Medals) ---
  gold: "#ffc107",
  silver: "#adb5bd",
  bronze: "#cd7f32",
  // --- General ---
  white: "#fff",
  black: "#000"
};

// store/store.ts
var import_async_storage = __toESM(require_commonjs());

// node_modules/zustand/esm/vanilla.mjs
var createStoreImpl = /* @__PURE__ */ __name((createState) => {
  let state;
  const listeners = /* @__PURE__ */ new Set();
  const setState = /* @__PURE__ */ __name((partial, replace) => {
    const nextState = typeof partial === "function" ? partial(state) : partial;
    if (!Object.is(nextState, state)) {
      const previousState = state;
      state = (replace != null ? replace : typeof nextState !== "object" || nextState === null) ? nextState : Object.assign({}, state, nextState);
      listeners.forEach((listener) => listener(state, previousState));
    }
  }, "setState");
  const getState = /* @__PURE__ */ __name(() => state, "getState");
  const getInitialState = /* @__PURE__ */ __name(() => initialState, "getInitialState");
  const subscribe = /* @__PURE__ */ __name((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, "subscribe");
  const api = { setState, getState, getInitialState, subscribe };
  const initialState = state = createState(setState, getState, api);
  return api;
}, "createStoreImpl");
var createStore = /* @__PURE__ */ __name((createState) => createState ? createStoreImpl(createState) : createStoreImpl, "createStore");

// node_modules/zustand/esm/react.mjs
var import_react = __toESM(require("react"), 1);
var identity = /* @__PURE__ */ __name((arg) => arg, "identity");
function useStore(api, selector = identity) {
  const slice = import_react.default.useSyncExternalStore(
    api.subscribe,
    () => selector(api.getState()),
    () => selector(api.getInitialState())
  );
  import_react.default.useDebugValue(slice);
  return slice;
}
__name(useStore, "useStore");
var createImpl = /* @__PURE__ */ __name((createState) => {
  const api = createStore(createState);
  const useBoundStore = /* @__PURE__ */ __name((selector) => useStore(api, selector), "useBoundStore");
  Object.assign(useBoundStore, api);
  return useBoundStore;
}, "createImpl");
var create = /* @__PURE__ */ __name((createState) => createState ? createImpl(createState) : createImpl, "create");

// node_modules/zustand/esm/middleware.mjs
function createJSONStorage(getStorage, options) {
  let storage;
  try {
    storage = getStorage();
  } catch (e) {
    return;
  }
  const persistStorage = {
    getItem: /* @__PURE__ */ __name((name) => {
      var _a;
      const parse = /* @__PURE__ */ __name((str2) => {
        if (str2 === null) {
          return null;
        }
        return JSON.parse(str2, options == null ? void 0 : options.reviver);
      }, "parse");
      const str = (_a = storage.getItem(name)) != null ? _a : null;
      if (str instanceof Promise) {
        return str.then(parse);
      }
      return parse(str);
    }, "getItem"),
    setItem: /* @__PURE__ */ __name((name, newValue) => storage.setItem(
      name,
      JSON.stringify(newValue, options == null ? void 0 : options.replacer)
    ), "setItem"),
    removeItem: /* @__PURE__ */ __name((name) => storage.removeItem(name), "removeItem")
  };
  return persistStorage;
}
__name(createJSONStorage, "createJSONStorage");
var toThenable = /* @__PURE__ */ __name((fn) => (input) => {
  try {
    const result = fn(input);
    if (result instanceof Promise) {
      return result;
    }
    return {
      then(onFulfilled) {
        return toThenable(onFulfilled)(result);
      },
      catch(_onRejected) {
        return this;
      }
    };
  } catch (e) {
    return {
      then(_onFulfilled) {
        return this;
      },
      catch(onRejected) {
        return toThenable(onRejected)(e);
      }
    };
  }
}, "toThenable");
var persistImpl = /* @__PURE__ */ __name((config2, baseOptions) => (set, get, api) => {
  let options = {
    storage: createJSONStorage(() => localStorage),
    partialize: /* @__PURE__ */ __name((state) => state, "partialize"),
    version: 0,
    merge: /* @__PURE__ */ __name((persistedState, currentState) => ({
      ...currentState,
      ...persistedState
    }), "merge"),
    ...baseOptions
  };
  let hasHydrated = false;
  const hydrationListeners = /* @__PURE__ */ new Set();
  const finishHydrationListeners = /* @__PURE__ */ new Set();
  let storage = options.storage;
  if (!storage) {
    return config2(
      (...args) => {
        console.warn(
          `[zustand persist middleware] Unable to update item '${options.name}', the given storage is currently unavailable.`
        );
        set(...args);
      },
      get,
      api
    );
  }
  const setItem = /* @__PURE__ */ __name(() => {
    const state = options.partialize({ ...get() });
    return storage.setItem(options.name, {
      state,
      version: options.version
    });
  }, "setItem");
  const savedSetState = api.setState;
  api.setState = (state, replace) => {
    savedSetState(state, replace);
    void setItem();
  };
  const configResult = config2(
    (...args) => {
      set(...args);
      void setItem();
    },
    get,
    api
  );
  api.getInitialState = () => configResult;
  let stateFromStorage;
  const hydrate = /* @__PURE__ */ __name(() => {
    var _a, _b;
    if (!storage) return;
    hasHydrated = false;
    hydrationListeners.forEach((cb) => {
      var _a2;
      return cb((_a2 = get()) != null ? _a2 : configResult);
    });
    const postRehydrationCallback = ((_b = options.onRehydrateStorage) == null ? void 0 : _b.call(options, (_a = get()) != null ? _a : configResult)) || void 0;
    return toThenable(storage.getItem.bind(storage))(options.name).then((deserializedStorageValue) => {
      if (deserializedStorageValue) {
        if (typeof deserializedStorageValue.version === "number" && deserializedStorageValue.version !== options.version) {
          if (options.migrate) {
            const migration = options.migrate(
              deserializedStorageValue.state,
              deserializedStorageValue.version
            );
            if (migration instanceof Promise) {
              return migration.then((result) => [true, result]);
            }
            return [true, migration];
          }
          console.error(
            `State loaded from storage couldn't be migrated since no migrate function was provided`
          );
        } else {
          return [false, deserializedStorageValue.state];
        }
      }
      return [false, void 0];
    }).then((migrationResult) => {
      var _a2;
      const [migrated, migratedState] = migrationResult;
      stateFromStorage = options.merge(
        migratedState,
        (_a2 = get()) != null ? _a2 : configResult
      );
      set(stateFromStorage, true);
      if (migrated) {
        return setItem();
      }
    }).then(() => {
      postRehydrationCallback == null ? void 0 : postRehydrationCallback(stateFromStorage, void 0);
      stateFromStorage = get();
      hasHydrated = true;
      finishHydrationListeners.forEach((cb) => cb(stateFromStorage));
    }).catch((e) => {
      postRehydrationCallback == null ? void 0 : postRehydrationCallback(void 0, e);
    });
  }, "hydrate");
  api.persist = {
    setOptions: /* @__PURE__ */ __name((newOptions) => {
      options = {
        ...options,
        ...newOptions
      };
      if (newOptions.storage) {
        storage = newOptions.storage;
      }
    }, "setOptions"),
    clearStorage: /* @__PURE__ */ __name(() => {
      storage == null ? void 0 : storage.removeItem(options.name);
    }, "clearStorage"),
    getOptions: /* @__PURE__ */ __name(() => options, "getOptions"),
    rehydrate: /* @__PURE__ */ __name(() => hydrate(), "rehydrate"),
    hasHydrated: /* @__PURE__ */ __name(() => hasHydrated, "hasHydrated"),
    onHydrate: /* @__PURE__ */ __name((cb) => {
      hydrationListeners.add(cb);
      return () => {
        hydrationListeners.delete(cb);
      };
    }, "onHydrate"),
    onFinishHydration: /* @__PURE__ */ __name((cb) => {
      finishHydrationListeners.add(cb);
      return () => {
        finishHydrationListeners.delete(cb);
      };
    }, "onFinishHydration")
  };
  if (!options.skipHydration) {
    hydrate();
  }
  return stateFromStorage || configResult;
}, "persistImpl");
var persist = persistImpl;

// constants/leagues.ts
var LEAGUE_ENDPOINTS = [
  { code: "eng.1", name: "Premier League", category: "Europe" },
  { code: "eng.2", name: "Championship", category: "Europe" },
  { code: "ger.1", name: "Bundesliga", category: "Europe" },
  { code: "esp.1", name: "La Liga", category: "Europe" },
  { code: "ita.1", name: "Serie A", category: "Europe" },
  { code: "fra.1", name: "Ligue 1", category: "Europe" },
  { code: "den.1", name: "Superliga", category: "Europe" }
];

// store/store.ts
var cloneLeagueEndpoints = /* @__PURE__ */ __name((leagues) => leagues.map(
  (league) => league.category ? {
    code: league.code,
    name: league.name,
    category: league.category
  } : {
    code: league.code,
    name: league.name
  }
), "cloneLeagueEndpoints");
var createDefaultSelectedLeagues = /* @__PURE__ */ __name(() => [
  { name: "Premier League", code: "eng.1", category: "Europe" },
  { name: "Championship", code: "eng.2", category: "Europe" }
], "createDefaultSelectedLeagues");
var createDefaultSyncedPreferenceState = /* @__PURE__ */ __name(() => ({
  theme: "light",
  soundEnabled: true,
  commonMatchNotificationsEnabled: true,
  configuredLeagues: cloneLeagueEndpoints(LEAGUE_ENDPOINTS),
  defaultSelectedLeagues: createDefaultSelectedLeagues()
}), "createDefaultSyncedPreferenceState");
var serializeSyncedPreferenceState = /* @__PURE__ */ __name((state) => ({
  theme: state.theme,
  soundEnabled: state.soundEnabled,
  commonMatchNotificationsEnabled: state.commonMatchNotificationsEnabled,
  configuredLeagues: cloneLeagueEndpoints(state.configuredLeagues),
  defaultSelectedLeagues: cloneLeagueEndpoints(state.defaultSelectedLeagues)
}), "serializeSyncedPreferenceState");
var useGameStore = create()(
  persist(
    (set, get) => ({
      // --- Initial State ---
      players: [],
      matches: [],
      commonMatchId: null,
      playerAssignments: {},
      matchesPerPlayer: 1,
      hasVideoPlayed: false,
      ...createDefaultSyncedPreferenceState(),
      history: [],
      // --- Actions ---
      setPlayers: /* @__PURE__ */ __name((players) => set((state) => ({
        players: typeof players === "function" ? players(state.players) : players
      })), "setPlayers"),
      setMatches: /* @__PURE__ */ __name((matches) => set((state) => ({
        matches: typeof matches === "function" ? matches(state.matches) : matches
      })), "setMatches"),
      setCommonMatchId: /* @__PURE__ */ __name((commonMatchId) => set({ commonMatchId }), "setCommonMatchId"),
      setPlayerAssignments: /* @__PURE__ */ __name((playerAssignments) => set((state) => ({
        playerAssignments: typeof playerAssignments === "function" ? playerAssignments(state.playerAssignments) : playerAssignments
      })), "setPlayerAssignments"),
      setMatchesPerPlayer: /* @__PURE__ */ __name((count) => set({ matchesPerPlayer: count }), "setMatchesPerPlayer"),
      setHasVideoPlayed: /* @__PURE__ */ __name((value) => set({ hasVideoPlayed: value }), "setHasVideoPlayed"),
      setSoundEnabled: /* @__PURE__ */ __name((enabled) => set({ soundEnabled: enabled }), "setSoundEnabled"),
      setCommonMatchNotificationsEnabled: /* @__PURE__ */ __name((enabled) => set({ commonMatchNotificationsEnabled: enabled }), "setCommonMatchNotificationsEnabled"),
      setConfiguredLeagues: /* @__PURE__ */ __name((leagues) => set({ configuredLeagues: leagues }), "setConfiguredLeagues"),
      addLeague: /* @__PURE__ */ __name((league) => set((state) => ({
        configuredLeagues: [
          ...state.configuredLeagues.filter((l) => l.code !== league.code),
          league
        ]
      })), "addLeague"),
      removeLeague: /* @__PURE__ */ __name((code) => set((state) => ({
        configuredLeagues: state.configuredLeagues.filter(
          (l) => l.code !== code
        )
      })), "removeLeague"),
      resetLeaguesToDefaults: /* @__PURE__ */ __name(() => set(createDefaultSyncedPreferenceState()), "resetLeaguesToDefaults"),
      setDefaultSelectedLeagues: /* @__PURE__ */ __name((leagues) => set({ defaultSelectedLeagues: leagues }), "setDefaultSelectedLeagues"),
      setTheme: /* @__PURE__ */ __name((theme) => set({ theme }), "setTheme"),
      saveGameToHistory: /* @__PURE__ */ __name(() => set((state) => {
        const newGameSession = {
          id: Date.now().toString(),
          date: (/* @__PURE__ */ new Date()).toISOString(),
          players: state.players,
          matches: state.matches,
          commonMatchId: state.commonMatchId,
          playerAssignments: state.playerAssignments,
          matchesPerPlayer: state.matchesPerPlayer
        };
        return {
          history: [...state.history, newGameSession]
        };
      }), "saveGameToHistory"),
      resetState: /* @__PURE__ */ __name(() => set({
        players: [],
        matches: [],
        commonMatchId: null,
        playerAssignments: {},
        matchesPerPlayer: 1
        // Note: hasVideoPlayed and soundEnabled are intentionally not reset here
      }), "resetState")
    }),
    {
      // --- Persistence Configuration ---
      name: "dong-storage",
      // Name for the persisted storage item
      storage: createJSONStorage(() => import_async_storage.default),
      // Storage mechanism
      partialize: /* @__PURE__ */ __name((state) => ({
        // Selectively persist parts of the state
        players: state.players,
        matches: state.matches,
        commonMatchId: state.commonMatchId,
        playerAssignments: state.playerAssignments,
        matchesPerPlayer: state.matchesPerPlayer,
        history: state.history,
        ...serializeSyncedPreferenceState(state)
      }), "partialize")
    }
  )
);

// app/style/theme.ts
var darkColors = {
  ...colors,
  background: "#0e1116",
  backgroundLight: "#12161c",
  backgroundSubtle: "#161b22",
  surface: "#1b222c",
  darkSurface: "#0e1116",
  textPrimary: "#e6edf3",
  textSecondary: "#c9d1d9",
  textMuted: "#8b949e",
  textDisabled: "#6e7681",
  border: "#2d333b",
  borderLight: "#30363d",
  borderLighter: "#343a42",
  borderSubtle: "#2d333b",
  primaryLight: "#0b2947",
  primaryLighter: "#0a223a",
  primaryDark: "#58a6ff",
  primaryTransparentLight: "rgba(88, 166, 255, 0.12)",
  successLight: "#12361c",
  dangerLight: "#3b1519",
  warningLight: "#3b2e0d",
  infoLight: "#11343a",
  toastBackground: "#0d1117",
  playerItemOddBackground: "#151b23"
};

// app/style/tamaguiThemes.ts
var lightTheme = {
  background: colors.background,
  backgroundLight: colors.backgroundLight,
  backgroundSubtle: colors.backgroundSubtle,
  surface: colors.surface,
  darkSurface: colors.darkSurface,
  toastBackground: colors.toastBackground,
  backgroundModalOverlay: colors.backgroundModalOverlay,
  color: colors.textPrimary,
  colorSecondary: colors.textSecondary,
  colorMuted: colors.textMuted,
  colorDisabled: colors.textDisabled,
  colorLight: colors.textLight,
  colorPlaceholder: colors.textPlaceholder,
  colorLink: colors.textLink,
  borderColor: colors.border,
  borderColorLight: colors.borderLight,
  borderColorLighter: colors.borderLighter,
  borderColorSubtle: colors.borderSubtle,
  primary: colors.primary,
  primaryLight: colors.primaryLight,
  primaryLighter: colors.primaryLighter,
  primaryDark: colors.primaryDark,
  primaryFocus: colors.primaryFocus,
  primaryTransparentLight: colors.primaryTransparentLight,
  success: colors.success,
  successLight: colors.successLight,
  danger: colors.danger,
  dangerLight: colors.dangerLight,
  warning: colors.warning,
  warningLight: colors.warningLight,
  info: colors.info,
  infoLight: colors.infoLight
};
var darkTheme = {
  background: darkColors.background,
  backgroundLight: darkColors.backgroundLight,
  backgroundSubtle: darkColors.backgroundSubtle,
  surface: darkColors.surface,
  darkSurface: darkColors.darkSurface,
  toastBackground: darkColors.toastBackground,
  backgroundModalOverlay: colors.backgroundModalOverlay,
  color: darkColors.textPrimary,
  colorSecondary: darkColors.textSecondary,
  colorMuted: darkColors.textMuted,
  colorDisabled: darkColors.textDisabled,
  colorLight: colors.textLight,
  colorPlaceholder: colors.textPlaceholder,
  colorLink: colors.textLink,
  borderColor: darkColors.border,
  borderColorLight: darkColors.borderLight,
  borderColorLighter: darkColors.borderLighter,
  borderColorSubtle: darkColors.borderSubtle,
  primary: colors.primary,
  primaryLight: darkColors.primaryLight,
  primaryLighter: darkColors.primaryLighter,
  primaryDark: darkColors.primaryDark,
  primaryFocus: colors.primaryFocus,
  primaryTransparentLight: darkColors.primaryTransparentLight,
  success: colors.success,
  successLight: darkColors.successLight,
  danger: colors.danger,
  dangerLight: darkColors.dangerLight,
  warning: colors.warning,
  warningLight: darkColors.warningLight,
  info: colors.info,
  infoLight: darkColors.infoLight
};

// app/style/tamaguiTokens.ts
var tokens = (0, import_core2.createTokens)({
  color: {
    // Brand
    primary: "#0275d8",
    primaryLight: "#e3f2fd",
    primaryLighter: "#f0f8ff",
    primaryDark: "#0056b3",
    primaryFocus: "#1976d2",
    primaryTransparentLight: "rgba(2, 117, 216, 0.08)",
    // Grays
    secondary: "#6c757d",
    lightGray: "#f8f9fa",
    mediumGray: "#e9ecef",
    darkGray: "#adb5bd",
    neutralGray: "#ccc",
    // Status
    success: "#28a745",
    successLight: "#e8f5e9",
    danger: "#dc3545",
    dangerLight: "#ffebee",
    warning: "#ffc107",
    warningLight: "#fff8e1",
    info: "#17a2b8",
    infoLight: "#e0f7fa",
    // Surfaces
    background: "#f5f5f5",
    backgroundLight: "#f8f9fa",
    backgroundSubtle: "#f0f0f0",
    surface: "#fff",
    darkSurface: "#333",
    toastBackground: "#222222",
    backgroundModalOverlay: "rgba(0, 0, 0, 0.5)",
    // Text
    textPrimary: "#212529",
    textSecondary: "#333",
    textMuted: "#6c757d",
    textDisabled: "#adb5bd",
    textLight: "#fff",
    textPlaceholder: "#999",
    textLink: "#0275d8",
    // Borders
    border: "#ddd",
    borderLight: "#e0e0e0",
    borderLighter: "#eee",
    borderSubtle: "#e9ecef",
    // Component specific
    awayTeam: "#fd7e14",
    liveIndicator: "#e74c3c",
    gold: "#ffc107",
    silver: "#adb5bd",
    bronze: "#cd7f32",
    white: "#fff",
    black: "#000"
  },
  space: {
    0: 0,
    0.5: 2,
    1: 4,
    1.5: 6,
    2: 8,
    2.5: 10,
    3: 12,
    3.5: 14,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    true: 16
  },
  size: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    9: 36,
    10: 40,
    11: 44,
    12: 48,
    true: 16
  },
  radius: {
    0: 0,
    1: 4,
    2: 6,
    3: 8,
    4: 10,
    5: 12,
    6: 16,
    7: 18,
    8: 20,
    9: 30,
    true: 8
  },
  zIndex: {
    0: 0,
    1: 100,
    2: 200,
    3: 300,
    4: 400,
    5: 500
  }
});

// tamagui.config.ts
var config = createTamagui({
  tokens,
  themes: {
    light: lightTheme,
    dark: darkTheme
  },
  defaultTheme: "light"
});
var tamagui_config_default = config;
