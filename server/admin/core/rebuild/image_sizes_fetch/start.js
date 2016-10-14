// Start image meta fetch
//

'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, function* image_sizes_fetch_start() {
    yield N.queue.image_sizes_fetch().run();
  });
};
