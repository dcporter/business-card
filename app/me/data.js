var events = require('events');

module.exports = exports = new events.EventEmitter();

exports.handle = function(urlObj, callback) {
  callback(null, { data: 'Hello World!' });
}

var isReady = true;

exports.onReady = function(listener) {
  // If we're already ready, fire the listener.
  if (isReady) process.nextTick(listener);
  // Otherwise, set it up.
  else this.once('ready', listener);
};


// TODO: Pull my tweets on a semiregular basis. Return the current list on demand.
