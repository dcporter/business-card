module.exports = exports = new (require('events').EventEmitter);

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