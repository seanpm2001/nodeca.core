/**
 *  N.io
 *
 *  This module provides realtime communication methods for Nlib based
 *  applications.
 **/


'use strict';

/*global N*/


var _ = require('lodash');
var $ = require('jquery');


// last xhr to allow interrupt it
var last_xhr = null;


// exported IO object
N.io = {};


// IO status/error codes used by RPC and HTTP servers
N.io.ECOMMUNICATION      = 1;
N.io.EWRONGVER           = 2;
N.io.OK                  = 200;
N.io.REDIRECT            = 302;
N.io.NOT_MODIFIED        = 304;
N.io.BAD_REQUEST         = 400;
N.io.NOT_AUTHORIZED      = 401;
N.io.NOT_FOUND           = 404;
N.io.APP_ERROR           = 500;
N.io.INVALID_CSRF_TOKEN  = 450;


// error constructor
function error(code, message) {
  var err = new Error(message);
  err.code = code;
  return err;
}


/**
 *  N.io.rpc(name, params, options, callback) -> Void
 *  N.io.rpc(name, params[, callback]) -> Void
 *  N.io.rpc(name, callback) -> Void
 **/
N.io.rpc = function rpc(name, params, options, callback) {
  var xhr, payload;

  payload = {
    version:  N.runtime.version,
    method:   name,
    csrf:     N.runtime.csrf
  };

  // Scenario: rpc(name, callback);
  if (_.isFunction(params)) {
    callback = params;
    params   = options  = {};
  }

  // Scenario: rpc(name, params[, callback]);
  if (_.isFunction(options)) {
    callback = options;
    options = {};
  }

  // fill in defaults
  options   = options || {_retryOnCsrfError: true};
  callback  = callback || $.noop;

  //
  // Interrupt previous rpc request
  //

  if (last_xhr) {
    (last_xhr.reject || $.noop)();
    last_xhr = null;
  }

  // fill in payload params
  payload.params = params;

  //
  // Send request
  //

  N.logger.debug('RPC request', payload);
  N.emit('io.request');

  xhr = last_xhr = $.post('/io/rpc', payload);

  //
  // Listen for a response
  //

  xhr.success(function (data) {
    data = data || {};

    N.logger.debug('RPC reply data', data);

    if (data.version !== N.runtime.version) {
      data.error = error(N.io.EWRONGVER, 'Client version does not match server.');
      delete data.response;
    }

    // if invalid CSRF token error and retry is allowed
    if (data.error && N.io.INVALID_CSRF_TOKEN === data.error.code && options._retryOnCsrfError) {
      // renew CSRF token
      N.runtime.csrf = error.data.token;

      // only one attempt to retry is allowed
      options._retryOnCsrfError = false;

      // try again
      N.io.rpc(name, params, options, callback);
      return;
    }

    if (data.error) {
      N.emit('io.error', data.error);
    }

    N.emit('io.complete');

    // run actual callback
    callback(data.error, data.response);
  });

  //
  // Listen for an error
  //

  xhr.fail(function (jqXHR, status) {
    var err;

    // for possible status values see: http://api.jquery.com/jQuery.ajax/

    if ('abort' === status) {
      return;
    }

    N.logger.error('Failed RPC call: ' + status, jqXHR);

    // any non-abort error - is communication problem
    err = error(N.io.ECOMMUNICATION, 'Communication error');

    N.emit('io.error', err);
    N.emit('io.complete');

    callback(err);
  });
};
