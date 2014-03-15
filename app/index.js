// CONFIG: The list of app IDs.
var appIds = [
  "me",
  "blog",
  "projects",
  "sandbox",
  "about"
];

/*
  This module exports a list of app objects, and aggregates their 'ready' events into one.
*/


// Turn ourselves into an event emitter.
exports = module.exports = new (require('events').EventEmitter);


// Load the App class. This returns a function which creates and returns App objects (of the EventEmitter
// class). Consider whether the factory and App class definitions belong in this file instead.
var App = require('./app.js');


// Set up readiness tracking & alerting. The readyListener function is attached to each app's ready event; when all
// apps are ready, this fires its own ready event.
var readyList = [],
    isReady = false;
function readyListener(app) {
  if (!app) return; // TODO: Figure out who's firing this event without submitting itself as an argument.
  // If we're already ready, there's nothing useful left to do.
  if (isReady) return;
  // Loop through readyList looking for app ID.
  var i, len = readyList.length, found = false;
  for (i = 0; i < len; i++) {
    if (readyList[i] === app.id) {
      found = true;
      break;
    }
  }
  // If not found, add to list.
  if (!found) readyList.push(app.id);
  // Test!
  if (readyList.length === appIds.length) {
    isReady = true;
    exports.emit('ready');
  };
};
exports.onReady = function(listener) {
  // If we're already ready, fire the listener.
  if (isReady) process.nextTick(listener);
  // Otherwise, set it up.
  else this.once('ready', listener);
}


// Loop through the app index and populate the exports object with app objects. Hook up the index's ready event.
var i, appId, app, apps = exports.index = [], len = appIds.length;
for (i = 0; i < len; i++) {
  appId = appIds[i];
  app = new App(appId);
  apps.push(app);
  exports[appId] = app;
  app.on('ready', readyListener);
  app.on('clientDidUpdate', function(app) { exports.emit('clientDidUpdate', app) });
  app.on('styleDidUpdate', function(app) { exports.emit('styleDidUpdate', app) });
  app.on('htmlDidUpdate', function(app) { exports.emit('htmlDidUpdate', app) });
}
