'use strict';


const async      = require('async');
const _          = require('lodash');
const browserify = require('browserify');
// const babelify   = require('babelify');


module.exports = function (sandbox, callback) {

  async.each(_.keys(sandbox.config.packages), (pkg_name, cb) => {
    let pkg = sandbox.config.packages[pkg_name];

    if (!_.keys(pkg.vendor).length) {
      cb();
      return;
    }

    let b = browserify();

    _.forEach(pkg.vendor, (path, name) => {
      b.require(path, { expose: name });
    });

    // b.transform(babelify, { presets: [ 'es2015' ] });

    b.bundle((err, out) => {
      if (err) {
        cb(err);
        return;
      }

      let asset = sandbox.bundler.createClass('file', {
        logicalPath: 'public/package-component-vendor-' + pkg_name + '.js',
        plugins: [ 'macros' ],
        virtual: true
      });

      asset.source = String(out);

      sandbox.component_client[pkg_name].js.push(asset);

      cb();
    });
  }, callback);
};