// Me: HTML 

var https = require('https'),
    OAuth = require('oauth').OAuth,
    fs = require('fs'),
    moment = require('moment'),
    mongoose = require('mongoose');

module.exports = exports = new (require('events').EventEmitter);

// Flags
var clientRaw = null,
    twProfilePic = null,
    twScreeName = null,
    tweetMarkup = null,
    githubUserData = null,
    githubStarCount = null,
    githubProjectMarkup = null,
    client = null,
    isReady;

// The compiler. Endpoint. Compiles the client and emits it.
function compileClient() {
  // Gatekeep.
  if (!clientRaw || twProfilePic === null || tweetMarkup === null || githubUserData === null || githubStarCount === null || githubProjectMarkup === null) return;
  // Compile.
  client = clientRaw.fmt({
    twitter_screen_name: twScreeName,
    twitter_profile_pic_url: twProfilePic,
    tweets: tweetMarkup,
    github_starred_count: githubStarCount,
    github_project_markup: githubProjectMarkup
  });
  client = client.fmt(githubUserData);
  // Emit.
  exports.emit('didUpdate', client);
}

// -------------------------------
// Load the html.
//
var templatePath = '%@/bin/index-template.html'.fmt(__dirname);
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
// Twitter
//
// Pull user data. Pull tweets & compile them into HTML.

var twitterAuth = new OAuth('', '', process.env.TWITTER_APP_KEY, process.env.TWITTER_APP_SECRET, '1.0', '', 'HMAC-SHA1');

// Get the user data (screen name & profile pic).
twitterAuth.get(
  'https://api.twitter.com/1.1/users/show.json?user_id=%@'.fmt(process.env.TWITTER_USER_ID),
  process.env.TWITTER_TOKEN,
  process.env.TWITTER_SECRET,
  handleTwitterProfilePicResponse
);

function handleTwitterProfilePicResponse(error, response) {
  if (error) {
    twProfilePic = '';
    compileClient();
    return;
  }
  // Parse the response.
  response = JSON.parse(response);
  // Get the profile URL (secure version). Remove the sizing constraint on the file name.
  var profileUrl = response.profile_image_url_https;
  profileUrl = profileUrl.replace('_normal.', '.');
  // Save URL and attempt client compilation.
  twProfilePic = profileUrl;
  twScreeName = response.screen_name || '';
  compileClient();
}

// Get the latest tweets, now and once every five minutes.
function refreshTweets() {
  twitterAuth.get(
    'https://api.twitter.com/1.1/statuses/user_timeline.json?count=25&user_id=%@'.fmt(process.env.TWITTER_USER_ID),
    process.env.TWITTER_TOKEN,
    process.env.TWITTER_SECRET,
    handleTweetsResponse
  );
}
setInterval(refreshTweets, 300000);
refreshTweets();

var rawTweets = null;
function handleTweetsResponse(error, response) {
  if (error) {
    if (!rawTweets) rawTweets = '[]';
    compileTweets();
    return;
  }
  // Post and alert downstream if needed.
  if (rawTweets !== response) {
    rawTweets = response || '[]';
    compileTweets();
  }
}

var tweetTemplate = '' +
'<div id="me-tweet-%{tweet_id}" class="me-tweet %{me_retweet} %{me_tweet_first} %{touch}" data-tweet-id="%{tweet_id}">' +
  '<div class="me-tweet-wrapper %{me_retweet} %{touch}">' +
    '<a class="me-tweet-tweeter %{me_retweet}" href="https://twitter.com/%{tweet_user_handle}" target="_blank">' +
      '<div class="me-tweet-avatar %{me_retweet}" style="background-image: url(\'%{tweet_avatar_url}\')"></div>' +
      '<div class="me-tweet-name %{me_retweet}">%{tweet_user_name}</div>' +
      '<div class="me-tweet-handle %{me_retweet}">@%{tweet_user_handle}</div>' +
    '</a>' +
    '<div class="me-tweet-body %{me_retweet}">%{tweet_text}</div>' +
    '<div class="me-tweet-footer %{me_retweet} %{touch}">' +
      '<div class="me-tweet-timestamp">%{tweet_timestamp}</div>' +
      '<a href="https://twitter.com/intent/retweet?tweet_id=%{tweet_id}"><div class="me-tweet-retweet">Retweet</div></a>' +
      '<a href="https://twitter.com/intent/tweet?in_reply_to=%{tweet_id}"><div class="me-tweet-reply">Reply</div></a>' +
    '</div>' +
  '</div>' +
  '<div class="me-tweet-tap-button-bar %{touch}" data-tweet-id="%{tweet_id}">' +
    '<a class="me-tweet-tap-button me-tweet-avatar-touch" style="background-image: url(\'%{tweet_avatar_url}\')" href="https://twitter.com/%{tweet_user_handle}" target="_blank"></a>' +
    '<a class="me-tweet-tap-button me-tweet-retweet-touch" href="https://twitter.com/intent/retweet?tweet_id=%{tweet_id}"></a>' +
    '<a class="me-tweet-tap-button me-tweet-reply-touch" href="https://twitter.com/intent/tweet?in_reply_to=%{tweet_id}"></a>' +
    '<div class="me-tweet-tap-button me-tweet-cancel-touch" data-tweet-id="%{tweet_id}"></div>' +
    '<div class="me-tweet-tap-catcher %{touch}" data-tweet-id="%{tweet_id}"></div>' +
  '</div>' +
'</div>';

// TODO: Roll my own entities. I don't like how this does it.
/* twitter-entities.js
 * Copyright 2010, Wade Simmons
 * Licensed under the MIT license
 * http://wades.im/mons
 */
function linkify_entities(tweet) {

  if (!(tweet.entities)) return tweet.text;
  
  // This is very naive, should find a better way to parse this
  var index_map = {};
  
  var i, len;
  // urls
  len = tweet.entities.urls ? tweet.entities.urls.length : 0;
  for (i = 0; i < len; i++) {
    entry = tweet.entities.urls[i];
    index_map[entry.indices[0]] = [entry.indices[1], function(text) {return "<a target='_blank' href='"+entry.url+"'>"+text+"</a>"}]
  }
  // hashtags
  len = tweet.entities.hashtags ? tweet.entities.hashtags.length : 0;
  for (i = 0; i < len; i++) {
    entry = tweet.entities.hashtags[i];
    index_map[entry.indices[0]] = [entry.indices[1], function(text) {return "<a target='_blank' href='http://twitter.com/search?q="+escape("#"+entry.text)+"'>"+text+"</a>"}]
  }
  // user_mentions
  len = tweet.entities.user_mentions ? tweet.entities.user_mentions.length : 0;
  for (i = 0; i < len; i++) {
    entry = tweet.entities.user_mentions[i];
    index_map[entry.indices[0]] = [entry.indices[1], function(text) {return "<a target='_blank' title='"+entry.name+"' href='http://twitter.com/"+entry.screen_name+"'>"+text+"</a>"}]
  }
  
  var result = ""
  var last_i = 0
  
  // iterate through the string looking for matches in the index_map
  for (i=0; i < tweet.text.length; ++i) {
    var ind = index_map[i]
    if (ind) {
      var end = ind[0]
      var func = ind[1]
      if (i > last_i) {
        result += tweet.text.substring(last_i, i);
      }
      result += func(tweet.text.substring(i, end));
      i = end - 1
      last_i = end
    }
  }
  
  if (i > last_i) {
    result += tweet.text.substring(last_i, i)
  }
  
  return result;
}
// end twitter-entities.js

function compileTweets() {
  // Parse tweets.
  var tweets = [];
  try {
    tweets = JSON.parse(rawTweets);
  } catch (e) {}

  // Compile.
  tweetMarkup = '';

  var first = true,
      tweet, isRetweet, avatarUrl, tweetText, data;
  while (tweets.length) {
    // Get tweet.
    tweet = tweets.shift();
    // Gatekeep.
    if (!tweet) continue;
    // Get retweet if retweet.
    if (tweet.retweeted_status) {
      isRetweet = true;
      tweet = tweet.retweeted_status;
    } else {
      isRetweet = false;
    }
    // Process text.
    tweetText = linkify_entities(tweet);
    tweetText = tweetText.replace(/\n/g, '<br/>');
    // Switch up avatar URL for less tiny, ugly version.
    if (isRetweet) {
      avatarUrl = tweet.user.profile_image_url_https;
      avatarUrl = avatarUrl.replace('_normal.', '_bigger.');
    } else {
      avatarUrl = tweet.user.profile_image_url_https;
      avatarUrl = avatarUrl.replace('_normal.', '.');
    }
    // Assemble data.
    data = {
      me_tweet_first: first ? 'me-tweet-first' : '',
      me_retweet: isRetweet ? 'me-retweet' : '',
      tweet_id: tweet.id_str,
      tweet_user_handle: tweet.user.screen_name,
      tweet_user_name: tweet.user.name,
      tweet_avatar_url: avatarUrl,
      tweet_timestamp: '',
      tweet_text: tweetText
    };
    // Set flag.
    first = false;

    // Format & append.
    tweetMarkup += tweetTemplate.fmt(data);
  }

  // Move on with our lives.
  compileClient();
}


// -------------------------------
// Github
//
// Pull user data. Pull activity. Compile repo list into HTML.

// User data
var errorGithubUserData = {
  github_user_name: '(api error)',
  github_gravatar_id: '',
  github_repo_count: '(api error)',
  github_followers: '(api error)',
  github_following: '(api error)'
};
var githubApiHeaders = {
  'User-Agent': '[Bussiness Card](https://www.github.com/dcporter/business-card)'
};
https.get({
  hostname: 'api.github.com',
  path: '/users/%@'.fmt(process.env.GITHUB_USER_NAME),
  headers: githubApiHeaders
}, function(response) {
  var output = '';
  response.on('data', function(chunk) { output += chunk; });
  response.on('end', function() {
    try {
      var data = JSON.parse(output);
      githubUserData = {
        github_user_name: process.env.GITHUB_USER_NAME,
        github_gravatar_id: data.gravatar_id,
        github_repo_count: data.public_repos,
        github_followers: data.followers,
        github_following: data.following
      };
    } catch(e) {
      githubUserData = errorGithubUserData;
    }
    compileClient();
  });
}).on('error', function(err) {
  githubUserData = errorGithubUserData;
  compileClient();
});

// Starred list
https.get({
  hostname: 'api.github.com',
  path: '/users/%@/starred'.fmt(process.env.GITHUB_USER_NAME),
  headers: githubApiHeaders
}, function(response) {
  var output = '';
  response.on('data', function(chunk) { output += chunk; });
  response.on('end', function() {
    try {
      var data = JSON.parse(output);
      githubStarCount = data.length;
    } catch(e) {
      githubStarCount = '(api error)';
    }
    compileClient();
  });
}).on('error', function(err) {
  githubStarCount = '(api error)';
  compileClient();
});

var githubActivityRaw = [],
    githubActivityPages = 4;
function refreshOnePageOfGithubActivity(page) {
  var i = page - 1;
  https.get({
    hostname: 'api.github.com',
    path: '/users/%@/events/public?page=%@'.fmt(process.env.GITHUB_USER_NAME, page),
    headers: githubApiHeaders
  }, function(response) {
    var output = '';
    response.on('data', function(chunk) { output += chunk; });
    response.on('end', function() {
      if (githubActivityRaw[i] !== output) {
        githubActivityRaw[i] = output;
        compileGithubActivity();
      }
    });
  }).on('error', function(err) {
    // If we don't already have a valid activity value then we have to create one and move on with our lives.
    if (!githubActivityRaw[i]) {
      githubActivityRaw[i] = '[]';
      compileGithubActivity();      
    }
  });
}
function refreshGithubActivity() {
  for (var i = 1; i <= githubActivityPages; i++) {
    refreshOnePageOfGithubActivity(i);
  }
}
setInterval(refreshGithubActivity, 3000000);
refreshGithubActivity();


// GitHub projects & activity.
var repos = null,
    Repo = mongoose.model('Repo', mongoose.Schema({
      title: String,
      name: String,
      cssSlug: String,
      description: String,
      isMajor: Boolean
    }));

// Fetch repos from the database now and every hour or so.
function fetchRepos() {
  Repo.find().sort('index').exec(function(err, response) {
    // In case of error, populate repos with an empty array (if necessary) and go on our way.
    if (err) {
      if (!repos) {
        repos = [];
        compileGithubActivity();
      }
      return;
    }
    repos = response;
    compileGithubActivity();
  });
}
setInterval(fetchRepos, 5800000);
fetchRepos();

// (HACK: Real quick, let's tweak moment's time english to prevent "...in the last a month" bug.)
(function() {
  var english = moment.langData('en').relativeTime;
  english.m = 'minute';
  english.h = 'hour';
  english.d = 'day';
  english.M = 'month';
  english.y = 'year';
})();

function compileGithubActivity() {
  // Gatekeep.
  if (repos === null) return;
  for (var i = 0; i < githubActivityPages; i++) {
    if (!githubActivityRaw[i]) return;
  }

  // Parse github activity.
  var githubActivity = [];
  for (var i = 0; i < githubActivityPages; i++) {
    try {
      githubActivity = githubActivity.concat(JSON.parse(githubActivityRaw[i]));
    } catch (e) {}
  }

  // Clear github activity logs.
  var i, len = repos.length;
  for (i = 0; i < len; i++) {
    repos[i].activity = { raw: [], pushes: 0, commits: 0, comments: 0, issuesOpened: 0, issuesClosed: 0, issuesReopened: 0 };
  }

  // Run through the github activity and load it into the project objects.
  var item, repo, oldestDateStr;
  while (githubActivity.length) {
    // Init loop.
    repo = null;
    item = githubActivity.shift();

    if (!item) continue;

    // Match the repo to the item by item.repo.name
    for (i = 0; i < len; i++) {
      if (repos[i].name === item.repo.name) {
        repo = repos[i];
        break;
      }
    }
    if (!repo) continue;

    repo.activity.raw.push(item);

    // Grab this as the oldest date. Since they arrive in chrono order, this'll be overwritten if it's wrong.
    oldestDateStr = item.created_at;

    // Mark this item as the repo's oldest. Ibid.
    repo.oldestActivity = item;

    // Pick a category. (If it's not one we've set up english for, skip it.)
    switch (item.type) {
      case 'PushEvent':
        repo.activity.pushes++;
        repo.activity.commits += item.payload.size;
        break;
      case 'IssueCommentEvent':
        repo.activity.comments++;
        break;
      case 'IssuesEvent':
        if (item.action === 'opened') repo.activity.issuesOpened++;
        if (item.action === 'closed') repo.activity.issuesClosed++;
        if (item.action === 'reopened') repo.activity.issuesReopened++;
        break;
      default: continue;
    }
  }

  var oldestDate = moment(oldestDateStr);

  // For each repo, create some activity english and process it.
  // TODO: Get issues in there. First decide if I care how many issues I closed this week.
  var englishes, englishCount, oldestDate, activityHTML;
  for (i = 0; i < len; i++) {
    repo = repos[i];

    // Reset.
    englishes = [];

    // Pushes & commits.
    if (repo.activity.pushes) {
      var english = '';
      // Pushes.
      if (repo.activity.pushes === 1) english = 'made <a target="_blank" href="https://github.com/%@/commits/">one push '.fmt(repo.name);
      else english = 'made <a target="_blank" href="https://github.com/%@/commits/">%@ pushes '.fmt(repo.name, repo.activity.pushes);
      // Commits.
      if (repo.activity.commits === 1) english += 'with one commit</a>';
      else english += 'with %@ commits</a>'.fmt(repo.activity.commits);

      englishes.push(english);
    }

    // Comments.
    if (repo.activity.comments) {
      if (repo.activity.comments === 1) englishes.push('posted <a target="_blank" href="https://github.com/%@/issues">one comment to discussions</a>'.fmt(repo.name));
      else englishes.push('posted <a target="_blank" href="https://github.com/%@/issues">%@ comments to discussions</a>'.fmt(repo.name, repo.activity.comments));
    }
    
    // Handle the no-activity case.
    if (!englishes.length) {
      repo.activityHTML = '';
      continue;
    }

    // Capitalize the first one.
    englishes[0] = englishes[0].substr(0, 1).toUpperCase() + englishes[0].substr(1);
    // For now there are only two possible items, so we'll take the easy way out.
    // If there are two, add "and" between them.
    if (englishes.length > 1) englishes[0] += ' and';

    // Finally add the time-and-period suffix.
    englishes.push('in the last %@.'.fmt(oldestDate.fromNow(true)));

    // Slot it into the object.
    repo.activityHTML = englishes.join(' ');

  }

  compileGithubProjects();

}

var githubProjectTemplate = '<hr class="%{first}">' +
'<div id="me-github-project-%{slug}" class="me-github-project me-github-project-%{stature}">' +
  '<%{stature_tag} id="me-github-project-header-%{slug}" class="me-github-project-header me-github-project-header-%{stature}"><a target="_blank" href="https://github.com/%{name}">%{title}</a></%{stature_tag}>' +
  '<div id="me-github-project-description-%{slug}" class="me-github-project-description">%{description}</div>' +
  '<div id="me-github-project-activity-%{slug}" class="me-github-project-activity">%{activity}</div>' +
'</div>';

function compileGithubProjects() {
  githubProjectMarkup = '';

  var i, len = repos.length, repo;
  for (i = 0; i < len; i++) {
    repo = repos[i];
    githubProjectMarkup += githubProjectTemplate.fmt({
      first: i === 0 ? 'first' : '',
      stature: repo.isMajor ? 'major' : 'minor',
      stature_tag: repo.isMajor ? 'h2' : 'h3',
      slug: repo.cssSlug,
      name: repo.name,
      title: repo.title,
      description: repo.description,
      activity: repo.activityHTML
    });
  }

  compileClient();

}



// This thing.
exports.on('newListener', function(event, listener) {
  if (event === 'didUpdate' && client !== null) {
    process.nextTick(function() { listener(client); });
  }
});