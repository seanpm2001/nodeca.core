// Send abuse report via email
//
// Params:
//
// - report - N.models.core.AbuseReport
// - recipients - { user_id: user_info }
// - locals - rendering data
// - email_templates - { body, subject } - i18n path
//
//
'use strict';


const _      = require('lodash');
const render = require('nodeca.core/lib/system/render/common');


module.exports = function (N) {

  // Send abuse report via email
  //
  N.wire.on('internal:common.abuse_report.deliver', function* send_via_email(params) {
    if (!params.email_templates) {
      N.logger.warn(`Abuse report (${params.report.type}): email templates not specified`);
      return;
    }

    // Fetch users emails
    let auth_links = yield N.models.users.AuthLink
                              .find()
                              .where('user_id').in(Object.keys(params.recipients))
                              .where('type').equals('plain')
                              .select('user_id email')
                              .lean(true);

    yield _.map(params.recipients, user_info => {
      let to = (_.find(auth_links, link => String(link.user_id) === String(user_info.user_id)) || {}).email;

      if (!to) return; // continue

      let locale = user_info.locale || N.config.locales[0];
      let helpers = {};

      helpers.t = (phrase, params) => N.i18n.t(locale, phrase, params);
      helpers.t.exists = phrase => N.i18n.hasPhrase(locale, phrase);
      helpers.link_to = (name, params) => N.router.linkTo(name, params) || '#';

      let subject = render(N, params.email_templates.subject, params.locals, helpers);
      let body = render(N, params.email_templates.body, params.locals, helpers);

      return N.mailer.send({ to, subject, html: body })
        .catch(err => {
          // don't return an error here
          N.logger.error('Cannot send email to %s: %s', to, err.message || err);
        });
    });
  });
};
