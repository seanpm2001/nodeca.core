"use strict";


/*global N*/


// 3rd-party
var async = require('async');


////////////////////////////////////////////////////////////////////////////////


exports.commandName       = "migrate";
exports.parserParameters  = {
  addHelp:      true,
  help:         'run migrations',
  description:  'Without args show new migrations. With ' +
                ' `--all` run all migrations.'
};

module.exports.commandLineArguments = [
  {
    args: ['--all'],
    options: {
      help:   'run all migrations',
      action: 'storeTrue'
    }
  }
];

module.exports.run = function (args, callback) {
  async.series([
    require('../lib/system/init/redis'),
    require('../lib/system/init/mongoose'),
    require('../lib/system/init/models'),
  ], function (err) {
    if (err) {
      callback(err);
      return;
    }

    var Migration       = N.models.core.Migration;
    var checkMigrations = require('../lib/system/migrator').checkMigrations;

    // fetch used migrations from db
    Migration.getLastState(function (err, currentMigrations) {
      var outstandingMigrations;

      if (err) {
        callback(err);
        return;
      }

      outstandingMigrations = checkMigrations(currentMigrations);

      if (0 === outstandingMigrations.length) {
        console.log(args.all  ? 'Already up-to-date.'
                              : 'You have no outstanding migrations');
        process.exit(0);
      }

      function formatMigrationTitle(migration) {
        return migration.appName + ':' + migration.step;
      }

      if (!args.all) {
        console.log('You have ' + outstandingMigrations.length +
                    ' outstanding migration(s):\n');

        outstandingMigrations.forEach(function (migration) {
          console.log('  ' + formatMigrationTitle(migration));
        });

        console.log('\nRun `migrate` command with `--all` to apply them.');
        process.exit(0);
      }

      console.log('Applying ' + outstandingMigrations.length +
                  ' outstanding migration(s):\n');

      async.forEachSeries(outstandingMigrations, function (migration, next) {
        migration.up(function (err) {
          if (err) {
            next(err);
            return;
          }

          process.stdout.write('  ' + formatMigrationTitle(migration) + ' ... ');

          // All ok. Write step to db
          Migration.markPassed(migration.appName, migration.step, function (err) {
            console.log(err ? 'FAILED' : 'OK');
            next(err);
          });
        });
      }, function (err) {
        if (err) {
          callback(err);
          return;
        }

        process.exit(0);
      });
    });
  });
};
