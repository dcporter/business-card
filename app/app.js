
var events = require('events'),
    fs = require('fs'),
    url = require('url'),
    crypto = require('crypto');

function App(id) {
  // --------------------------------------------
  // ~_~
  //
  // Constructor protector ~_~
  if (!(this instanceof App)) return new App(id);
  // Scope protector ~_~
  var self = this;

  // --------------------------------------------
  // Properties
  //
  self.id = id;
  self.isReady = false;
  self.isError = false;
  self.errors = []; /* TODO: A server-side error state should be reflected on the client side. */
  self.client = null;
  self.style = null;
  self.html = null;
  self.clientHash = null;
  self.styleHash = null;
  self.htmlHash = null;

  // --------------------------------------------
  // Ready-Watcher!
  //
  // Flags.
  var clientIsLoaded = false,
      styleIsLoaded = false,
      htmlIsLoaded = false,
      dataIsInitialized = false;
  // Would be great to have this in the prototype, but prototype methods can't reach privileged variables.
  function checkIsReady() {
    if (self.isReady) return true;
    if (clientIsLoaded && styleIsLoaded && htmlIsLoaded && dataIsInitialized) {
      self.isReady = true;
      self.emit('ready', self);
      return true;
    }
    return false;
  }

  // --------------------------------------------
  // Client
  //
  // The client either comes from a module at client.js which exports an EventEmitter with a "didUpdate" event
  // which emits the client text as the event's first argument, or a static javascript file at client-static.js. The
  // client.js module is loaded preferentially to the client-static.js file. If neither is available, then,
  // you screwed up.

  function updateClient(error, client) {
    if (error) { 
      self.errors.push({ type: 'client', error: error, msg: 'Error loading client code.' });
      self.isError = true;
      console.log(error);
    } else {
      self.client = client;
      var hash = crypto.createHash('md5');
      hash.update(client, 'utf-8');
      self.clientHash = hash.digest('hex');
    }
    clientIsLoaded = true;
    if (self.isReady) self.emit('clientDidUpdate', self);
    else checkIsReady();
  }

  // Try to require the module.
  var clientFactory;
  try {
    clientFactory = require('%@/%@/client.js'.fmt(__dirname, id));
  } catch (e) { }

  // If the module was successfully required, set up observers.
  if (clientFactory) {
    // Handles client change.
    function clientFactoryHandler(client) {
      updateClient(null, client);
    }
    // Handles error.
    function clientFactoryError(error) {
      updateClient(error);
    }
    // Sets up listeners.
    clientFactory.on('didUpdate', clientFactoryHandler);
    clientFactory.on('error', clientFactoryError);
  }

  // If the module failed to load, load client-static.js instead.
  else {
    try {
      // The watcher. Any time the client changes, reload it and let folks know.
      fs.watch('%@/%@/client-static.js'.fmt(__dirname, id), function(event, filename) {
        if (event === 'change') loadClientStatic();
      });
      // The loader.
      function loadClientStatic() {
        fs.readFile('%@/%@/client-static.js'.fmt(__dirname, id), 'utf-8', updateClient);
      };
      // Load that mother.
      loadClientStatic();
    }
    catch (e) {
      // TODO: standardize app error handling.
      console.log('ERROR: both client.js and client-static.js failed to load for app "%@".'.fmt(self.id));
      throw e;
    }
  }

  // --------------------------------------------
  // style.css
  //
  // The stylesheet either comes from a module at style.js which exports an EventEmitter with a "clientDidChange"
  // event which emits the client text as the event's first argument, or a static css file at style.css. The
  // style.js module is loaded preferentially to the style.css file. If neither is available, then, you screwed
  // up.

  function updateStyle(error, content) {
    if (error) { 
      self.errors.push({ type: 'style', error: error, msg: 'Error loading stylesheet.' });
      self.isError = true;
      console.log(error);
    } else {
      self.style = content;
      var hash = crypto.createHash('md5');
      hash.update(content, 'utf-8');
      self.styleHash = hash.digest('hex');
    }
    styleIsLoaded = true;
    if (self.isReady) self.emit('styleDidUpdate', self);
    else checkIsReady();
  }

  // Try to load the module.
  var styleFactory;
  try {
    styleFactory = require('%@/%@/style.js'.fmt(__dirname, id));
  } catch (e) { }

  // If it successfully loaded, use it.
  if (styleFactory) {
    // Handles client change.
    function styleFactoryHandler(style) {
      updateStyle(null, style);
    }
    // Handles error.
    function styleFactoryError(error) {
      updateStyle(error);
    }
    // Sets up listeners.
    styleFactory.on('didUpdate', clientFactoryHandler);
    styleFactory.on('error', clientFactoryError);
  }

  // Otherwise, load the static file.
  else {
    try {
      // The watcher. Any time the style changes, reload it and let folks know.
      fs.watch('%@/%@/style.css'.fmt(__dirname, id), function(event, filename) {
        if (event === 'change') loadStyleStatic();
      });
      // The loader.
      var loadStyleStatic = function() {
        fs.readFile('%@/%@/style.css'.fmt(__dirname, id), 'utf-8', updateStyle);
      };
      // Load that mother.
      loadStyleStatic();
    }
    catch (e) {
      // TODO: standardize app error handling.
      console.log('ERROR: both style.js and style.css failed to load for app "%@".'.fmt(self.id));
      throw e;
    }
  }

  // --------------------------------------------
  // HTML
  //
  // The client either comes from a module at html.js which exports an EventEmitter with a "clientDidChange" event
  // which emits the client text as the event's first argument, or a static html file at index.html. The html.js
  // module is loaded preferentially to the static index.html file. If neither is available, then, you screwed up.

  function updateHTML(error, html) {
    if (error) { 
      self.errors.push({ type: 'html', error: error, msg: 'Error loading app html.' });
      self.isError = true;
      console.log(error);
    } else {
      self.html = html;
      var hash = crypto.createHash('md5');
      hash.update(html, 'utf-8');
      self.htmlHash = hash.digest('hex');
    }
    htmlIsLoaded = true;
    if (self.isReady) self.emit('htmlDidUpdate', self);
    else checkIsReady();
  }

  var htmlFactory;
  // Try to require the module.
  try {
    htmlFactory = require('%@/%@/html.js'.fmt(__dirname, id));
  } catch (e) { }

  // If the module was successfully required, set up observers.
  if (htmlFactory) {
    // Handles client change.
    function htmlFactoryHandler(html) {
      updateHTML(null, html);
    }
    // Handles error.
    function htmlFactoryError(error) {
      updateHTML(error);
    }
    // Sets up listeners.
    htmlFactory.on('didUpdate', htmlFactoryHandler);
    htmlFactory.on('error', htmlFactoryError);
  }

  // If the module failed to load, attempt to load index.html instead.
  else {
    try {
      // The watcher. Any time the client changes, reload it and let folks know.
      fs.watch('%@/%@/index.html'.fmt(__dirname, id), function(event, filename) {
        if (event === 'change') loadHTMLStatic();
      });
      // The loader.
      function loadHTMLStatic() {
        fs.readFile('%@/%@/index.html'.fmt(__dirname, id), 'utf-8', updateHTML);
      };
      // Load that mother.
      loadHTMLStatic();
    }
    catch (e) {
      // TODO: standardize app error handling.
      console.log('ERROR: both html.js and index.html failed to load for app "%@".'.fmt(self.id));
      throw e;
    }
  }
 
  // --------------------------------------------
  // data.js
  //
  var dataHandler = require('%@/%@/data.js'.fmt(__dirname, self.id));
  dataHandler.onReady(function(error) {
    // Handle error if present.
    if (error) {
      self.errors.push({ type: 'data', error: error, msg: 'Error initializing app data.' });
      self.isError = true;
    }
    // Mark initialized and continue.
    dataIsInitialized = true;
    checkIsReady();
  });
  self.data = function(queryUrl, callback) {
    // Handle data not yet ready or errored.
    if (!dataHandler) {
      callback(new Error('Data handler for "%@" is not (yet) loaded. Check isLoaded or error list.'.fmt(this.id)));
      return;
    }
    // Parse Url.
    var urlObj = url.parse(queryUrl, true);
    // Pass in to data handler.
    dataHandler.handle(queryUrl, callback);
  }
  // TODO: See about hot-swapping in the event of a change to the data program.
  // Totally doable, just clear the module cache, reload the data module into a temporary variable, and swap on 'ready'.
  // Possible problem: if we update client.js and data.js, they may reload out of sync, with bad requests or responses
  // in the mean time. Maybe better to just recreate the app object at a higher level and hot-swap it on 'ready'.


  // --------------------------------------------
  // config.js
  //
  var config, key;
  try {
    config = require('%@/%@/config.js'.fmt(__dirname, self.id));
  } catch (e) {}
  if (config) {
    for (key in config) {
      // Let's not accidentally override anything. (TODO: consider implications both ways)
      if (!self[key]) self[key] = config[key];
    }
  }

  // --------------------------------------------
  // Handle new listeners
  //
  // This is a sort of mini-Promise, where if you attach a listener for an event that's already happened, it fires
  // the listener immediately.
  self.on('newListener', function(event, listener) {
    // For each of the events, if it's already been called, trigger the new listener.
    if (self.isReady) {
      if (event === 'clientDidChange' || event === 'styleDidUpdate' || event === 'htmlDidChange' || event === 'ready') {
        process.nextTick(function() { listener(self); });
      }
    }
  });
}

App.prototype = new events.EventEmitter();
App.prototype.constructor = App;

App.prototype.manifestKeys = ['id', 'title', 'clientHash', 'styleHash', 'htmlHash'];

// Export that mother.
module.exports = exports = App;