'use strict';


/**
 *  client
 **/

/**
 *  client.common
 **/


/*global $, _, nodeca, window, document*/


/**
 *  client.common.init()
 *
 *  Assigns all necessary event listeners and handlers.
 *
 *
 *  ##### Example
 *
 *      $(nodeca.client.common.init);
 **/
module.exports = function () {
  var History = window.History; // History.js

  if (!History.enabled) {
    // do not do anything if History.js is not available
    return;
  }


  // ## WARNING ############################################################# //
  //                                                                          //
  // History.js works poorly with URLs containing hashes:                     //
  //                                                                          //
  //    https://github.com/balupton/history.js/issues/111                     //
  //    https://github.com/balupton/history.js/issues/173                     //
  //                                                                          //
  // So upon clicks on `/foo#bar` we treat URL and push it to the state as    //
  // `/foo` and saving `bar` in the state data, so we could scroll to desired //
  // element upon statechange                                                 //
  //                                                                          //
  // ######################################################################## //


  var rootUrl      = History.getRootUrl().replace(/\/$/, '');
  var virtualHost  = rootUrl.replace(/^[^:]+:/, '');
  var notification = {timout: null, noty: null};


  function notify_loading(show) {
    clearTimeout(notification.timeout);

    /*global noty*/
    if (show) {
      notification.timeout = setTimeout(function () {
        notification.noty = noty({
          text: 'Loading...',
          layout: 'topCenter',
          type: 'warning'
        });
      }, 500);
    } else if (notification.noty) {
      notification.noty.close();
      notification.noty = null;
    }
  }


  // Tries to find match data from the router
  //
  function find_match_data(url) {
    var parts   = String(url).split('#'),
        href    = String(parts[0]),
        anchor  = String(parts[1]),
        match   = nodeca.runtime.router.match(href);

    if (!match && !/^\/\//.test(url)) {
      // try full URL if it's host-relative:
      //
      //    `/foo/bar` -> `//example.com/foo/bar`
      match = nodeca.runtime.router.match(virtualHost + href);
    }

    return match ? [match, href, anchor] : null;
  }


  // Executes api3 method from given `data` (an array of `match`, `href` and
  // `anchor` as returned by find_match_data);
  //
  function exec_api3_call(data, callback) {
    var match = data[0], href = data[1], anchor = data[2];

    // schedule "loading..." notification
    notify_loading(true);

    nodeca.io.apiTree(match.meta, match.params, function (err, msg) {
      // TODO: Realtime must send this "HTTP_ONLY" error by itself
      if (err && "HTTP_ONLY" === String(err).replace(/[^a-z]/i, '_').toUpperCase()) {
        window.location = href;
        return;
      }

      // TODO: Properly handle `err` and (?) `msg.error`
      if (err) {
        nodeca.logger.error('Failed apiTree call', err);
        return;
      }

      setTimeout(function () {
      callback({
        view:   msg.view || match.meta,
        layout: msg.layout,
        locals: msg.data,
        title:  msg.data.head.title,
        route:  msg.data.head.route || match.meta,
        anchor: anchor
      }, null, href);
      }, 60000);
    });
  }


  // Bind @statechange handler
  //
  History.Adapter.bind(window, 'statechange', function (event) {
    var data = History.getState().data;

    $(window).scrollTop(0);

    if (!data || History.isEmptyObject(data)) {
      if (History.getStateByIndex(0).id === History.getState().id) {
        // First time got back to initial state - get necessary data
        var href  = History.getState().url.replace(rootUrl, ''),
            match = find_match_data(href);

        // if router was able to find apropriate data - make a call,
        // otherwise should never happen
        if (match) { exec_api3_call(match, History.replaceState); }
      }

      // skip handlling in any case if we don't have data
      return;
    }

    try {
      nodeca.client.common.render(data.view, data.layout, data.locals);
    } catch (err) {
      // FIXME: redirect on error? or at least propose user to click
      //        a link to reload to the requested page
      nodeca.logger.error('Failed render view <' + data.view +
                          '> with layout <' + data.layout + '>', err);
      return;
    } finally {
      // remove "loading..." notification
      notify_loading(false);
    }

    document.title = data.title;
    nodeca.client.common.navbar_menu.activate(data.route);

    if (data.anchor) {
      $.noop();
      // TODO: Scroll to desired element
    }
  });


  $(function () {
    $('body').on('click', 'a', function (event) {
      var match = find_match_data($(this).attr('href'));

      // Continue as normal for cmd clicks etc
      if (2 === event.which || event.metaKey) {
        return true;
      }

      if (match) {
        exec_api3_call(match, History.pushState);
        event.preventDefault();
        return false;
      }
    });
  });
};
