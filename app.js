// Set up global namespace.
global.DCP = {
  services: {}
};

// Load modules.
var http = require('http'),
    fs = require('fs'),
    mongoose = require('mongoose'),
    fileServer = new (require('node-static').Server)('.', { cache: 31000000 }),
    crypto = require('crypto');

require('./utils');

/*
Get local copies of environmental variables, if needed.
*/
if (!process.env.ENVIRONMENT) {
  require('../env.js');
}

/*
Kick off Mongo using prefab AppFog code ... modified to use no variables and be completely unreadable.
mongoose.connect(url);
                (url) = function(obj) {};
                                (obj) = function() { prod || localhost }
*/
mongoose.connect((function(obj){
  obj.hostname = (obj.hostname || 'localhost');
  obj.port = (obj.port || 27017);
  obj.db = (obj.db || 'test');
  if(obj.username && obj.password){
    return "mongodb://" + obj.username + ":" + obj.password + "@" + obj.hostname + ":" + obj.port + "/" + obj.db;
  } else {
    return "mongodb://" + obj.hostname + ":" + obj.port + "/" + obj.db;
  }
})((function() {
  // prod || localhost
  if (process.env.VCAP_SERVICES){
    return JSON.parse(process.env.VCAP_SERVICES)['mongodb-1.8'][0]['credentials'];
  } else {
    return {
      "hostname":"localhost",
      "port":27017,
      "username":"",
      "password":"",
      "name":"",
      "db":"db"
    };
  }
})()));
global.DCP.services.db = mongoose.connection;
global.DCP.services.db.once('open', function() { console.log('Mongo available...'); });


// Add my font mime to fileServer, because it doesn't have it already for some reason.
// (woff mime is even the "add something that's not there yet" example in the docs.)
require('node-static').mime.addContentType('woff', 'application/x-font-woff');

/*
  Our server. Handles requests for:
    - /: The home page.
    - /style.css: The base stylesheet.
    - /{app-id}: The home page, preloaded with app-id's client.
    - /{app-id}/{query}: The home page, preloaded with app-id's client and query's data.
    - /app/{app-id}: A request for an app's client code.
    - /data/{app-id}/{query}: A data query, to be handled by app-id's data method.
    - /resources/{resource}: A static file request.

  TODO: Split these handlers up into separate, less monolithic functions.
  TODO: Use regexes?
*/
var server = http.createServer(function (req, response) {

  // Get request data & url details.
  var url = req.url,
      urlArray = url.split('/');
  urlArray.shift();

  // The first URL slug determines behavior.
  var baseUrl = urlArray.shift();

  // resources - these are real files at the requested
  // location; the URL can be mapped on through.
  if (baseUrl === 'resources') {
    fileServer.serve(req, response);
    return;
  }

  // The stylesheet - another real file, already loaded and hashed.
  if (baseUrl.substr(0, 9) === "style.css") {
    if (!style) {
      response.writeHead(501);
      response.end();
      return;
    }
    response.writeHead(200, { 'Content-Type': 'text/css', 'Cache-Control': 'max-age=31000000, public' });
    response.write(style || '', 'utf-8');
    response.end();
    return;
  } 

  var appId, app, endpoint;

  // app - This is a request to load an app that hasn't loaded yet. We need to return the app's client code, html or stylesheet.
  if (baseUrl === 'app') {
    appId = urlArray.shift();
    appId = appId ? appId.split('?')[0] : appId;
    app = apps[appId];
    if (app) {
      endpoint = urlArray.shift() || '';
      // client.js
      if (endpoint.substr(0, 9) === 'client.js') {
        response.writeHead(200, { 'Content-Type': 'application/javascript', 'Cache-Control': 'max-age=31000000, public' });
        response.write(app.client || '', 'utf-8');
        response.end();
        return;
      }
      // style.css
      else if (endpoint.substr(0, 9) === 'style.css') {
        response.writeHead(200, { 'Content-Type': 'text/css', 'Cache-Control': 'max-age=31000000, public' });
        response.write(app.style || '', 'utf-8');
        response.end();
        return;
      }
      // index.html
      else if (endpoint.substr(0, 10) === 'index.html') {
        response.writeHead(200, { 'Content-Type': 'text/css', 'Cache-Control': 'max-age=31000000, public' });
        response.write(app.html || '', 'utf-8');
        response.end();
        return;
      }
      // data
      else if (endpoint.substr(0, 4) === 'data') {
        // Quick hack to get data request back together from heavily-shifted urlArray.
        var dataRequest = endpoint.substr(4, endpoint.length - 4);
        dataRequest += urlArray.join('/');
        app.data(dataRequest, function(error, data) {
          if (error) {
            response.writeHead(503);
            response.end();
          } else {
            response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=31000000, public' });
            response.write(JSON.stringify(data), 'utf-8');
            response.end();
          }
        });
        return;
      }
      // static resources
      else if (endpoint === 'resources') {
        fileServer.serve(req, response);
        return;
      }
    }
    // If we haven't returned yet, our request won't be handled.
    response.writeHead(404);
    response.end();
    return;
  }

  // The springboard, or the springboard preloaded with an app
  var cachedPage = cachedPages[baseUrl];
  if (cachedPage) {
    // If there's no data string, compile and serve the page now.
    if (urlArray.length === 0) {
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.write(cachedPage.fmt({ app_data: 'null' }), 'utf-8');
      response.end();
    }

    // Otherwise, request the data and include it in the response.
    else {
      app = apps[baseUrl];
      app.data(urlArray.join('/'), function(error, data) {
        if (error) {
          // TODO: Serve the app with the knowledge of a server error baked in, rather than killing the whole
          // page. (Same idea as the in-app 404s.)
          response.writeHead(503);
          response.end();
        } else {
          response.writeHead(200, { 'Content-Type': 'text/html' });
          response.write(cachedPage.fmt({ app_data: JSON.stringify(data) }), 'utf-8');
          response.end();
        }
      });      
    }
    return;
  }

  // Otherwise, redirect to home page.
  // TODO: 404. Serve page with 404 knowledge built in, and have the app display it.
  response.writeHead(302, {
    Location: '/'
  });
  response.end();

});


// ---------------------------------------------
// Launches the server when everybody's ready.
//
var serverLaunched; // TODO: Get rid of this awful flag
var launchServer = function() {
  if (serverLaunched) return;
  server.listen(process.env.VMC_APP_PORT || 1337, null);
  serverLaunched = true;
  console.log('Listening...');
};

// ---------------------------------------------
// Loads the app index (and all the apps).
// ON READY: compileBasePage
var apps = require('./app/index.js'),
    appsAreReady = false;

apps.onReady(function() {
  appsAreReady = true;
  compileBasePage();
});

apps.on('clientDidUpdate', function(app) {
  console.log('JS changed in ' + app.id);
  compileBasePage();
});
apps.on('styleDidUpdate', function(app) {
  console.log('Style changed in ' + app.id);
  compileBasePage();
});
apps.on('htmlDidUpdate', function(app) {
  console.log('HTML changed in ' + app.id);
  compileBasePage();
})

// ---------------------------------------------
// Style & style hash
//
var style = null,
    styleHash = null;
fs.watch('./style.css', function(event, filename) {
  if (event === 'change') loadStylesheet();
});
function loadStylesheet() {
  fs.readFile('./style.css', 'utf-8', function(error, content) {
    if (error) { throw error; }

    style = content;

    var hasher = crypto.createHash('md5');
    hasher.update(content, 'utf-8');
    styleHash = hasher.digest('hex');

    compileBasePage();
  });
}
// Run that mother.
loadStylesheet();

// ---------------------------------------------
// Base Page
// 
// Load + set up file system observer for reload.
// ON LOAD: compileBasePage

var basePageRaw = null,
    basePage = null;
// The watcher. Any time the base page changes, reload and recompile it.
fs.watch('./base.html', function(event, filename) {
  if (event === 'change') loadBasePage();
});
// The loader. Triggers a recompile.
function loadBasePage() {
  fs.readFile('./base.html', 'utf-8', function(error, content) {
    if (error) { throw error; }

    basePageRaw = content;
    compileBasePage();
  });
};
// Run that mother.
loadBasePage();


// ---------------------------------------------
// Compile and cache one page per app.
// ON COMPLETE: launchServer

var cachedPages = {};
var compileBasePage = function() {
  // Checks flags.
  if (!appsAreReady) return;
  if (basePageRaw === null) return;
  if (styleHash === null) return;

  // Build springboard app divs.
  var springboard = '',
      springboardTemplate = '<a href="/%{id}" class="springboard-icon-wrapper springboard-icon-%{id} icon-index-%{icon_index} initial internal unprocessed"><div class="springboard-icon-label springboard-icon-%{id}" data-app="%{id}">%{title}</div><div class="springboard-icon springboard-icon-%{id}" data-app="%{id}"></div></a>',
      list = apps.index,
      manifest = [],
      len = list.length,
      i, app, j, key, keyLength,
      appObj;
  for (i = 0; i < len; i++) {
    app = list[i];
    // Populate the springboard.
    springboard += springboardTemplate.fmt(app).fmt({ icon_index: i + 1 });
    // Populate the manifest.
    appObj = {};
    keysLength = app.manifestKeys.length;
    for (j = 0; j < keysLength; j++) {
      key = app.manifestKeys[j];
      appObj[key] = app[key];
    }
    manifest.push(appObj);
  }

  // Build parsed base page.
  basePage = basePageRaw;
  basePage = basePage.fmt({
    springboard: springboard,
    app_manifest: JSON.stringify(manifest),
    utils_fmt: String.prototype.fmt.toString(),
    style_hash: styleHash
  });

  cachedPages[''] = basePage.fmt({ app_id: ' ', app_code: ' ', app_style: ' ' }); // TODO: Fix fmt so it treats empty strings correctly.
  len = apps.index.length;
  for (i = 0; i < len; i++) {
    app = apps.index[i];
    // Compile the app's page.
    cachedPages[app.id] = basePage.fmt({
      app_id: app.id,
      app_code: app.client || ' ',
      app_style: app.style || ' ',
      app_html: app.html ? encodeURI(app.html) : ''
    });
  }

  // Start server if needed.
  launchServer();
};
