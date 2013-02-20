/**
 *  class Settings
 *
 *  Standalone settings manager used to manage stores.
 **/


'use strict';


// 3rd-party
var _     = require('lodash');
var async = require('async');


// internal
var Store = require('./store');


////////////////////////////////////////////////////////////////////////////////


/**
 *  new Settings()
 *
 *  Creates new instance of settings manager.
 **/
function Settings() {
  // internal map of `name` -> `store`
  this.__stores__ = {};

  // internal map of `key` -> `stores`:
  // {
  //    'forum_show':   [ usergroup_store, forum_usergroup_store ],
  //    'is_moderator': [ forum_store ]
  // }
  this.__keys__ = {};
}


/**
 *  Settings#addStore(name, store) -> Void
 *  - name (String): Store name
 *  - store (Settings.Store): Instance of settings store
 **/
Settings.prototype.addStore = function addStore(name, store) {
  if (!(store instanceof Store)) {
    throw "Store must be a subclass of Settings.Store";
  }

  if (!!this.__stores__[name]) {
    throw "Duplicate store name: " + name;
  }

  // set store name
  store.name = name;

  // register keys of the stores
  store.keys.forEach(function (key) {
    if (!this.__keys__[key]) {
      this.__keys__[key] = [];
    }

    this.__keys__[key].push(store);
  }, this);

  // register store
  this.__stores__[name] = store;
};


/**
 *  Settings#createStore(schema) -> Settings.Store
 *  - schema (String): Store schema
 **/
Settings.prototype.createStore = function createStore(schema) {
  return new Store(schema);
};


/**
 *  Settings#getStore(name) -> Settings.Store|Null
 *  - name (String): Store name
 **/
Settings.prototype.getStore = function getStore(name) {
  return this.__stores__[name] || null;
};


/**
 *  Settings#getStoresForKey(key) -> Array
 *  - key (String): Setting key
 *
 *  Returns list of stores that knows about `key`.
 **/
Settings.prototype.getStoresForKey = function getStoresForKey(key) {
  return !this.__keys__[key] ? [] : this.__keys__[key].slice();
};


/**
 *  Settings#get(keys, params[, options], callback(err, values)) -> Void
 *  - keys (String|Array): Setting key(s)
 *  - params (Object): Params used to get value of a key
 *  - options (Object): Extra options for fine tuning, see below.
 *  - callback (Function): Executed once, everything is done.
 *
 *  Returns "aggregated" value of a `key` from all stores
 *  associated with it. In comparison to [[Settings.Store#get]], each value here
 *  is a simple (scalar) value, e.g. `false`, and not an object with flags.
 *
 *  ##### Options
 *
 *  - *skipCache* (Boolean): Skip cache and get value from database. Default: false
 *  - *cache* (Object): Cache data, that can be used instead of hitting database.
 *    Ignored if `skipCache` is true.
 **/
Settings.prototype.get = function get(keys, params, options, callback) {
  var self        = this;
  var results     = {};
  var store_keys  = {}; // store -> keys to fetch
  var single      = !_.isArray(keys);
  var err;

  if (!callback) {
    callback = options;
    options  = {};
  }

  // prepare list of stores and (their known keys) to fetch
  (single ? [keys] : keys).forEach(function (key) {
    var stores = self.getStoresForKey(key);

    if (!stores.length) {
      err = 'Unknown settings key: ' + key;
    }

    stores.forEach(function (store) {
      if (!store_keys[store.name]) {
        store_keys[store.name] = [];
      }

      store_keys[store.name].push(key);
    });
  });

  if (err) {
    callback(err);
    return;
  }

  async.forEach(Object.keys(store_keys), function (name, next) {
    self.getStore(name).get(store_keys[name], params, options, function (err, data) {
      if (err) {
        next(err);
        return;
      }

      _.each(data, function (val, key) {
        if (!results[key]) {
          results[key] = [];
        }

        results[key].push(val);
      });

      next();
    });
  }, function (err) {
    var errors = [];

    if (err) {
      callback(err);
      return;
    }

    // merge "raw" key values from multiple stores into final "single" result
    //
    //  { forum_show: [ { value: true }, { value: false } ], ...  }
    //      -> { forum_show: true, ... }
    _.each(results, function (values, key) {
      results[key] = self.mergeValues(values).value;

      if (null === results[key]) {
        errors.push(key);
      }
    });


    if (errors.length) {
      callback('Failed get values for settings: ' + errors.join(', '));
      return;
    }

    callback(null, single ? results[keys] : results);
  });
};


/**
 *  Settings#set(storeName, values, params, callback) -> Void
 *
 *  Syntax sugar for:
 *
 *      settings.getStore(storeName).set(values, params, callback);
 *
 *  If `storeName` is not known, it will return coresponding error into
 *  `callback`.
 **/
Settings.prototype.set = function set(storeName, values, params, callback) {
  var store = this.getStore(storeName);

  if (!store) {
    callback("Unknown store: " + String(storeName));
    return;
  }

  store.set(values, params, callback);
};


/**
 *  Settings#mergeValues(values) -> Object
 *  - values (Array): List of values
 *
 *  Returns Object with properties:
 *  - `value` (Mixed): represents value
 *  - `forced` (Boolean): whenever value must be forced
 **/
Settings.prototype.mergeValues = function mergeValues(values) {
  var i;

  // if forced value exists, it will have priority over regular one
  // if multiple forced values exists, then 0 will take precedence over 1 (we
  // prefer to drop permissions)

  var forced_mode   = false;
  var value_forced  = true;
  var value_regular = false;
  var has_value     = false;

  for (i = values.length - 1; i >= 0; i--) {
    if (values[i]) {
      has_value = true;

      if (!values[i].force) {
        value_regular = value_regular || values[i].value;
      } else {
        forced_mode  = true;
        value_forced = value_forced && values[i].value;
      }
    }
  }

  if (!has_value) {
    return null;
  }

  return {
    value: forced_mode ? value_forced : value_regular,
    force: forced_mode
  };
};


// MODULE EXPORTS //////////////////////////////////////////////////////////////


module.exports = Settings;