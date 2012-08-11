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
 *      nodeca.client.common.init();
 **/
module.exports = function () {
  $(function () {
    // Bootstrap.Collapse calls e.preventDefault() only when there's no
    // data-target attribute. We don't want URL to be changed, so we are
    // forcing prevention of default behavior.
    $('body').on('click.collapse.data-api', '[data-toggle=collapse]', function (e) {
      e.preventDefault();
    });

    //
    // Observe quicksearch focus to tweak icon style
    //

    $('.navbar-search .search-query')
      .focus(function (){ $(this).next('div').addClass('focused'); })
      .blur(function (){ $(this).next('div').removeClass('focused'); });
  });


  // **WARNING**
  //
  // jQuery.each correctly iterate through own proprties of a function.
  // Underscore, treats all objects with `length` proprerty as an array,
  // thus it can't be used here.
  //
  $.each(nodeca.client.common.init, function (idx, func) {
    if (_.isFunction(func)) {
      func();
    }
  });


  nodeca.client.common.floatbar.init();
  nodeca.client.common.action_links.init();


  // history intercepts clicks on all `a` elements,
  // so we initialize it as later as possible to have
  // "lowest" priority of handlers
  nodeca.client.common.history.init();
};
