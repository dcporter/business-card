// Me: JS 

var https = require('https'),
    OAuth = require('oauth').OAuth,
    fs = require('fs');

module.exports = exports = new (require('events').EventEmitter);

// Flags
var clientRaw = null,
    instagramFeed = null,
    instagramUsername = null,
    client = null;

// The compiler. Endpoint. Compiles the client and emits it.
function compileClient() {
  // Gatekeep.
  if (!clientRaw || instagramFeed === null) return;
  // Compile.
  client = clientRaw.fmt({
    instagram_feed: instagramFeed,
    instagram_username: instagramUsername
  });
  // Emit.
  exports.emit('didUpdate', client);
}

// -------------------------------
// Load the js.
//
var templatePath = '%@/bin/client-template.js'.fmt(__dirname);
function loadTemplate() {
  fs.readFile(templatePath, 'utf-8', function(error, content) {
    if (error) {
      exports.emit('error', error);
      return;
    }
    clientRaw = content;
    compileClient();
  });
}
// Watch the file.
fs.watch(templatePath, function(event, filename) {
  if (event === 'change') loadTemplate();
});
// Load the template.
loadTemplate();


// -------------------------------
// Instagram
//
// Pull instagram feed now, and every hour-and-a-bit following.
var errorInstagramFeed = '[]';
function refreshInstagramFeed() {
  https.get({
    hostname: 'api.instagram.com',
    path: '/v1/users/%@/media/recent/?access_token=%@'.fmt(process.env.INSTAGRAM_USER_ID, process.env.INSTAGRAM_TOKEN)
  }, function(response) {
    var output = '';
    response.on('data', function(chunk) { output += chunk; });
    response.on('end', function() {
      try {
        // Parse the data.
        var result = JSON.parse(output).data;
        // Loop through the items and pull out a minimal set of data for the client to deal with.
        var i, len = result.length, item, feedData = [], feedJSON;
        for (i = 0; i < len; i++) {
          item = result[i];
          feedData.push({
            standard_resolution_url: item.images.standard_resolution.url,
            low_resolution_url: item.images.low_resolution.url,
            caption: item.caption
          });
          instagramUsername = item.user.username; // Easier to grab this from each one then to handle the no-items case.
        }
        // If anything's changed, trigger a recompile.
        feedJSON = JSON.stringify(feedData);
        if (feedJSON !== instagramFeed) {
          instagramFeed = feedJSON;
          compileClient();
        }
      } catch(e) {
        if (!instagramFeed) {
          instagramFeed = errorInstagramFeed;
          compileClient();
        }
      }
    });
  }).on('error', function(err) {
    if (!instagramFeed) {
      instagramFeed = errorInstagramFeed;
      compileClient();
    }
  });
};
setInterval(refreshInstagramFeed, 6010000);
refreshInstagramFeed();


// This thing.
exports.on('newListener', function(event, listener) {
  if (event === 'didUpdate' && client !== null) {
    process.nextTick(function() { listener(client); });
  }
});