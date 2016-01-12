'use strict';


window.jQuery = window.$ = require('jquery');

// Polyfills
require('raf.js');
require('blueimp-canvas-to-blob');

if (!window.Promise) {
  window.Promise = require('promise-polyfill');
}

// Load kernel
require('kernel')(N);