// -------------------------------------------------
// Me: A highly overengineered business card.
//

/*
  Me is a business-card app which shows my contact information and headline skills at the top in
  a collapsible header; in the display area below, the user can switch between several view cards
  representing the author's various social network & professional presences.

  The header has three states: fully open, partially open, and collapsed. Its initial state is
  partially open. If the body display area is empty, then tapping the header toggles between
  full and partially open. Selecting a card to view collapses the header; tapping on the header
  when collapsed removes the card and re-expands the header. (Note that the difference between
  the three states will be more pronounced as horizontal space gets tightened.)
*/

// Scope variables - mostly static elements that I don't want to be $ing for every time they're needed.
var context, background, header, title, subHeader, iconWrapper, iconCount, iconWidth, pointer, cardSpacer, $cards, contextClasses = '';


// --------------------------------
// App Methods
//
app.launchClient = function(firstTime) {
  // If this is our first launch, hook up initial launch stuff.
  if (firstTime) {
    // Fill scoped variables.
    context = this.get('context');
    background = context.find('.me-background');
    header = context.find('.me-header');
    title = header.find('.me-wrapper-header-business-card');
    subHeader = context.find('.me-body');
    iconWrapper = subHeader.find('.me-wrapper-header-icons');
    iconCount = iconWrapper.children().length;
    pointer = subHeader.find('.me-active-icon-pointer');
    cardSpacer = context.find('#me-card-spacer'),
    $cards = cardSpacer.find('.me-card');

    // Now that we have a DOM, initialize the cards.
    initializeCards();

  }

  // Hook up window resize listener.
  window.addEventListener('resize', windowSizeDidChange);
  window.addEventListener('orientationchange', windowSizeDidChange);

  // Hook up springboard height observer.
  springboard.bindTo('headerPadding', DCP.springboard);

  // Let the cards know.
  var i, len = cardList.length;
  for (i = 0; i < len; i++) {
    if (cardList[i].onapplaunch) cardList[i].onapplaunch();
  }

  // Restore previous state.
  if (currentCard && currentCard !== cards.error) {
    window.history.replaceState(null, null, '/me/' + currentCard.id);
  }
  if (currentCard && currentCard.onlaunch) currentCard.onlaunch();

  // Launch.
  this.set('isReady', true);


  // Run the state handler to set up the initial card, if any.
  if (firstTime) this.onpopstate();

  // Trigger card height calculation.
  windowHeightDidChange();

};

app.onpopstate = function() {
  var card = app.pathname().split('/')[0];
  changeState(card);
};

app.quit = function() {
  // Tell the current card that we're quitting.
  if (currentCard && currentCard.onquit) {
    setTimeout(function() { currentCard.onquit(); }, 500);
  }

  // Let the cards know.
  var i, len = cardList.length;
  for (i = 0; i < len; i++) {
    if (cardList[i].onappquit) cardList[i].onappquit();
  }

  // Remove resize listeners.
  window.removeEventListener('resize', windowSizeDidChange);
  window.removeEventListener('orientationchange', windowSizeDidChange);
  springboard.unbind('headerPadding');

  // Indicate that we have re-registering to do.
  this.set('isReady', false);
};

// --------------------------------
// Window Resize Handler
//
function windowSizeDidChange() {
  windowHeightDidChange();
  if (currentCard && currentCard.onwindowsizechange) currentCard.onwindowsizechange();
}

// --------------------------------
// State
//

// See the "Cards" section for the card API.
var currentCard = null;

function currentCardId() {
  return app.pathname().split('/')[0];
}

// Go to a card (by ID), or return to the header.
function changeState(cardId) {

  // If we're going from no card to no card, quit.
  if (!currentCard && !cardId) return;

  // If we're going back to the currently-active card, let the card know, then quit.
  if (currentCard && currentCard.id === cardId) {
    if (currentCard.onpopstate) currentCard.onpopstate();
    return;
  }

  // Trigger onquit on currentCard if applicable.
  if (currentCard && currentCard.id !== cardId) {
    if (currentCard.onquit) {
      var quittingCard = currentCard;
      setTimeout(function() { quittingCard.onquit(); }, 250);
    }
  }

  // Set state variables.
  // If there's a cardId, we're going to go to it.
  if (cardId) currentCard = cards[cardId] || cards.error;
  // Otherwise, clear any currently-viewing cards.
  else currentCard = null;

  setState();

}

// Updates the UI to reflect the current state variables.
function setState() {
  var isError = currentCard === cards.error;

  // Handle URL and document title.
  var pathName = '/me' + (currentCard ? '/%@'.fmt(currentCard.id) : '');
  if (window.location.pathname !== pathName && !isError) {
    window.history.pushState(null, null, pathName);
  }
  document.title = 'dcporter.net : About Me' + (currentCard ? ' : %@'.fmt(currentCard.title) : '');

  // Fastpath - no card. Clear state, park pointer & quit.
  if (!currentCard) {
    background.removeClass(contextClasses);
    header.removeClass('collapsed');
    subHeader.removeClass('collapsed');
    $cards.removeClass('active inactive-left inactive-right');
    pointer.addClass('parked');
    return;
  }

  // Collapse header. (Give this CPU-bound op a head start - it looks less terrible to have a gap above the icons
  // than text below them.)
  header.addClass('collapsed');
  subHeader.addClass('collapsed');

  // Calculate anything we can calculate ahead of time.
  // Pointer position
  if (!iconWidth) iconWidth = iconWrapper.children().outerWidth(true);
  var iconIndex = currentCard.index,
      topIndex = iconCount - 1,
      offsetIndex = iconIndex - topIndex / 2,
      pointerOffset = offsetIndex * iconWidth,
      pointerOffsetCSS = '-webkit-transform: translateX(%{offset}px) translateZ(0); transform: translateX(%{offset}px) translateZ(0)'.fmt({ offset: pointerOffset });

  // Prep current card.
  if (!currentCard.isInitialized) {
    if (currentCard.initialize) currentCard.initialize();
    currentCard.isInitialized = true;
  }
  if (currentCard.onlaunch) currentCard.onlaunch();

  // Activate active card.
  if (currentCard.useMaxHeight) currentCard.$.css('max-height', cardHeight);
  else currentCard.$.css('height', cardHeight);
  currentCard.$.removeClass('inactive-left inactive-right').addClass('active');

  // Loop through and add correct inactive classes.
  var i, foundCardYet, len = $cards.length;
  for (i = 0; i < len; i++) {
    // Mark if we've found the card.
    if (currentCard.$[0] === $cards[i]) {
      foundCardYet = true;
    }
    // If it's not, and we haven't found the active card yet, send it off to the left.
    else if (!foundCardYet) {
      $($cards[i]).removeClass('active inactive-left').addClass('inactive-right');
    }
    // If we have, then send it off to the left.
    else {
      $($cards[i]).removeClass('active inactive-right').addClass('inactive-left');
    }
  }

  // Swap background.
  background.removeClass(contextClasses).addClass('active-card-%@'.fmt(currentCard.id));

  // Apply pointer offset.
  if (isError) pointer.addClass('parked');
  else pointer.removeClass('parked');
  pointer.attr('style', pointerOffsetCSS);
}


// --------------------------------
// Card height calculations
//
// Card height is calculated manually (rather than using top: x; bottom: x) to get accelerated animations. The height of
// the card is the height of the window minus the header height (a known value), minus the collapsed springboard height.
// We can observe the window height, and handle window size events.

var windowHeight = window.innerHeight,
    springboard = new MVCObject(),
    headerHeight = 98,
    headerHeightNarrow = 25,
    cardPadding,
    cardHeight;

// Set up the springboard object to get bound in to the public one on launch.
springboard.headerPadding = 0;
springboard.headerPadding_changed = function() { calculateCardHeight() };

// This matches the padding above and below the card here to the @media-queried
// CSS ones.
function calculateCardPadding() {
  if (windowHeight > 500) cardPadding = 20;
  else if (windowHeight > 410) cardPadding = 15;
  else cardPadding = 10;
}
calculateCardPadding();

// Window height handler. Marks the new height, and triggers downstream calculations. (If
// this gets much more complicated it should end up in an MVCObject.)
function windowHeightDidChange() {
  // Gatekeep.
  if (window.innerHeight === windowHeight) return;

  // Measure.
  windowHeight = window.innerHeight;

  // Card padding.
  calculateCardPadding();

  // Recalculate the height.
  calculateCardHeight();
}

// Calculate and apply the card height.
function calculateCardHeight() {
  // Based on window height, get the correct header offset.
  var currentHeaderHeight = windowHeight <= 350 ? headerHeightNarrow : headerHeight;
  // The card height is the height of the window, less the current header height, springboard height, and current card padding.
  cardHeight = windowHeight
             // - springboard.get('headerPadding') // hiding springboard
             - currentHeaderHeight
             - (2 * cardPadding);
  cardHeight = parseInt(cardHeight, 10);

  // Apply it to the active card, if any.
  if (currentCard) {
    if (currentCard.useMaxHeight) currentCard.$.css('max-height', cardHeight);
    else currentCard.$.css('height', cardHeight);
  }
}


// ----------------------------------
// Cards
//
/*
  Cards may expose the following event handlers:
  initialize - Called on each card when the Me app first launches, after the DOM has been created but before it's appended.
  onlaunch - Called when the card is activated.
  onquit - Called when the card is deactivated. Called on the active card when the Me app quits.
  onapplaunch - Called on each card each time the Me app is launched. Called after initialize the first time.
  onappquit - Called on each card when the Me app is quit.
  onpopstate - Called on the active card when the user navigates within that card.
  onwindowsizechange - Called on the active card when the window resizes.

  (Cards may not delay launch or otherwise control their destiny.)
 */
var cards = {},
    cardList = [];

// This method loads the card objects up with data from the DOM (which may not exist yet).
function initializeCards() {
  // Card IDs, indices and titles come from the card elements in the DOM.
  var card, $el, id, i,
      len = $cards.length,
      lateInitializers = []; // Used to hold cards that are gonna initialize in just a sec.

  for (i = 0; i < len; i++) {
    // Get the element.
    $el = $($cards[i]);
    id = $el.data('cardId');

    // Get the card object and load it up.
    card = cards[id];
    card.index = i;
    card.$ = $el;
    cardList.push(card);

    // While we're here, construct the context class list for the background color cross-fader.
    contextClasses += ' active-card-%@ '.fmt(id);

    // Initialize the card - immediately if it's active, or with a staggered delay if it's not.
    var delay = 5000,
        currentID = currentCardId();
    if (card.initialize) {
      if (currentID === card.id || card === cards.error) { // (We might be at the error card, since its ID won't match the pathname; initializing the error card is cheap so let's just do it now.)
        card.initialize();
        card.isInitialized = true;
      }
      else {
        lateInitializers.push(card);
        setTimeout(function() {
          var card = lateInitializers.shift();
          if (!card.isInitialized) {
            card.initialize();
            card.isInitialized = true;
          }
        }, delay);
        delay += 2000;
      }
    }
  }

}


// ----------------------------------
// Resume
//
cards.resume = (function() {
  var card = {
    id: 'resume',
    title: 'Resume'
  };

  var $wrapper,
      $scroller,
      $resume,
      $menu,
      lameMenuIsOpenStateFlag = false,
      isScrolling;

  card.initialize = function() {
    // Fill variables.
    $wrapper = card.$.find('#me-apparent-card-resume');
    $scroller = card.$.find('#me-resume-scroller');
    $resume = $wrapper.find('#me-resume');
    $menu = card.$.find('#me-resume-menu');
    // Hook up menu open/close events.
    var menuGripper = card.$.find('#me-resume-menu-button');
    if (!SC.browser.touch) {
      menuGripper.bind('click', toggleMenu);
    } else {
      menuGripper.hammer({prevent_default: true}).bind('tap', toggleMenu).bind('drag', dragProcessor);
      $resume.hammer({ prevent_default: false, drag_vertical: false }).bind('drag', dragProcessor);
    }
    // Hook up menu action events.
    if (!SC.browser.touch) {
      $menu.children().bind('click', menuAction);
    } else {
      $menu.children().hammer({ prevent_default: true }).bind('tap', menuAction);
    }
  }

  card.onpopstate = function() {
    toggleMenu();
  }

  card.onquit = function() {
    hideMenu();
  }

  // Menu control methods

  function showMenu() {
    // Gatekeep.
    if (lameMenuIsOpenStateFlag) return false;
    // Set flag.
    lameMenuIsOpenStateFlag = true;
    // Change state.
    $wrapper.addClass('shifted').bind('click', hideMenu);
    // Tell the browser.
    return false;
  }

  function hideMenu() {
    // Gatekeep.
    if (!lameMenuIsOpenStateFlag) return false;
    // Set the flag.
    lameMenuIsOpenStateFlag = false;
    // Change state.
    $wrapper.removeClass('shifted').unbind('click', hideMenu);
    // Tell the browser.
    return false;
  }

  function toggleMenu() {
    if (lameMenuIsOpenStateFlag) hideMenu();
    else showMenu();
    return false;
  }

  // Multitouch menu helpers. We have two goals here: first, prevent a drag from triggering a menu event if
  // the user has scrolled meaningfully; second, allow the user to swipe the menu open and close in the same
  // gesture.
  var didBind, isScrolling, extremeX;
  function dragEnd(evt) {
    didBind = false; isScrolling = false; extremeX = null;
    $resume.unbind('touchend', dragEnd);
  }
  function dragProcessor(evt) {
    // Gatekeep: No event or we are scrolling.
    if (!evt || isScrolling) return;

    // Update our extremes. If the menu is open, our origin is the farthest left
    // (smaller x) that events have gone; if the menu is open, our origin is the
    // farthest right (larger x). This flagged switch means that we can use the
    // same variable for both.
    if (lameMenuIsOpenStateFlag) {
      if (extremeX == null || extremeX > evt.position.x) extremeX = evt.position.x;
    } else {
      if (extremeX == null || extremeX < evt.position.x) extremeX = evt.position.x;
    }

    // Bind up our drag-end event. We actively bind and unbind the drag-end event
    // because I forget why.
    if (!didBind) {
      $resume.bind('touchend', dragEnd);
      didBind = true;
    }

    // If we're scrolling, set the flag (sigh) to prevent this method from doing
    // anything for the duration.
    if (Math.abs(evt.deltaY) > 20) {
      isScrolling = true;
      return;
    }

    // Calculate distance from extreme. (Note that since the extreme is
    // gated by the menu state, it's self-zeroing and can be calculated
    // without sign.)
    var distanceFromExtreme = Math.abs(extremeX - evt.position.x);

    // If we've crossed our threshold, make it rain! With menus!
    var threshold = 30;
    if (distanceFromExtreme >= threshold) {
      toggleMenu();
    }

    return false;
  }

  // The actual menu action.
  function menuAction(evt) {
    // Gatekeep;
    if (!evt || !evt.target) return;

    var target, $target, scrollTop;

    // Get target scrollTop.
    target = $(evt.target).data('target');
    if (!target) return;
    if (target === 'top') {
      scrollTop = 0;
    } else {
      $target = $resume.find('#' + target);
      if (!$target.length) return;
      scrollTop = $target.position().top + parseInt($resume.css('margin-top'));
    }

    // Calculate speed.
    var diff = Math.abs(scrollTop - $scroller.scrollTop()),
        speed = Math.max(Math.min(diff * 0.75, 750), 300);

    // Go.
    $scroller.animate({ scrollTop: scrollTop }, speed);

    // Wrap up. (Note that as of this writing originalEvent was a cached version whose methods did not work. I've left these here
    // in hopes that a future fix will fix this in the future.)
    evt.originalEvent.stopPropagation();
    evt.originalEvent.preventDefault();
    hideMenu();
    return false;
  }

  return card;
})();


// ----------------------------------
// Twitter
//
cards.twitter = (function() {
  var card = {
    id: 'twitter',
    title: 'Twitter'
  };

  card.initialize = function() {
    // Hook up touch events.
    if (SC.browser.touch) {
      card.$.find('.me-twitter-header').hammer({prevent_default: true}).bind('tap', scrollTotop);
      card.$.find('.me-tweet-tap-catcher').bind('click', showTweetButtonBar); // This one behaves badly with hammer, since it's scrolling too.
      card.$.find('.me-tweet-tap-button-bar').bind('click', hideTweetButtonBar);
      card.$.find('.me-tweet-cancel-touch').hammer({prevent_default: true}).bind('tap', hideTweetButtonBar);
    }

    // This code courtesy of the Twitter Follow Me button.
    !function(d,s,id){var js,fjs=d.getElementsByTagName(s)[0];if(!d.getElementById(id)){js=d.createElement(s);js.id=id;js.src="//platform.twitter.com/widgets.js";fjs.parentNode.insertBefore(js,fjs);}}(document,"script","twitter-wjs");
  }

  card.onpopstate = function() {
    scrollTotop();
  }

  card.onquit = function() {
    card.$.find('.me-tweet-tap-button-bar').removeClass('active animate');
  }

  function scrollTotop() {
    card.$.find('.me-tweets').animate({ scrollTop: 0 }, 250);
  }

  function showTweetButtonBar(evt) {
    // Gatekeep.
    if (!evt || !evt.target || !evt.target.getAttribute('data-tweet-id')) return;
    // Get the correct tweet.
    var tweetId = evt.target.getAttribute('data-tweet-id'),
        tweet = card.$.find('#me-tweet-%@'.fmt(tweetId));
    if (!tweet) return;
    // Set classes. (The separate "animate" class is used to dynamically include the webkit
    // transitions, whose presence is triggering an odd delay elsewhere in the app.)
    card.$.find('.me-tweet-tap-button-bar').removeClass('active animate');
    tweet.find('.me-tweet-tap-button-bar').addClass('active animate');
    setTimeout(function() { tweet.find('.me-tweet-tap-button-bar').removeClass('animate'); }, 500);
    // Prevent propagation.
    evt.stopPropagation();
    evt.preventDefault();
  }
  function hideTweetButtonBar(evt) {
    // Gatekeep.
    if (!evt || !evt.target || !evt.target.getAttribute('data-tweet-id')) return;
    // Get the correct tweet.
    var tweetId = evt.target.getAttribute('data-tweet-id'),
        tweet = card.$.find('#me-tweet-%@'.fmt(tweetId));
    if (!tweet) return;
    // Set class. (See above for notes on "animate".)
    tweet.find('.me-tweet-tap-button-bar').addClass('animate').removeClass('active');
    setTimeout(function() { tweet.find('.me-tweet-tap-button-bar').removeClass('animate'); }, 500);
    evt.stopPropagation();
    evt.preventDefault();
  }

  return card;
})();


// ----------------------------------
// GitHub
//
cards.github = (function() {
  var card = {
    id: 'github',
    title: 'GitHub',
    useMaxHeight: true
  };

  card.onpopstate = function() {
    card.$.animate({ scrollTop: 0 }, 250);
  }

  return card;
})();


// ----------------------------------
// LinkedIn
//
cards.linkedin = (function() {
  var card = {
    id: 'linkedin',
    title: 'LinkedIn'
  };

  // The widget needs to be recreated whenever the app is launched.
  var widgetCode = '<script type="IN/MemberProfile" data-id="http://www.linkedin.com/in/davecporter" data-format="inline" data-related="false" data-width="300"><\/script>';
  var wrapper;
  card.onapplaunch = function() {
    if (!wrapper) wrapper = card.$.find('#me-linkedin-wrapper');
    wrapper.html(widgetCode);
    if (window.IN) window.IN.init();
  };
  card.onappquit = function() {
    wrapper.html('');
  }

  return card;
})();


// ----------------------------------
// Instagram
//
cards.instagram = (function() {
  var card = {
    id: 'instagram',
    title: 'Instagram'
  };

  var images = [],
      isEmpty = true,
      $canvas,
      options,
      $tag,
      aspectRatio;

  card.initialize = function() {
    // Fast path: No images.
    if (!card.feed || !card.feed.length) {
      // TODO: Display error message.
      return;
    }

    $canvas = card.$.find('#me-instagram-canvas');
    $tag = card.$.find('#me-instagram-tag');

    // Mark the card active.
    isEmpty = false;

    // Populate the user.
    $tag.text(card.username);

    // Get a list of image URLs from the feed object.
    var i, len = card.feed.length;
    for (i = 0; i < len; i++) {
      images.push(card.feed[i].standard_resolution_url);
    }

    // Set up our kenburns options.
    options = {
      images: images,
      zoom: 1.4,
      display_time: 8000,
      background_color: '#013'
    }

    // If we're on android or iOS, hook up app-launch code.
    if (SC.browser.iOS || SC.browser.android) {
      $tag.hammer({prevent_default: true}).bind('tap', launchInstagram);
    }
  }

  card.onlaunch = function() {
    if (isEmpty) return;
    // Initialize aspect ratio (in a sec, once the DOM is all in place).
    setTimeout(checkAspectRatio, 1);
    // Initialize the slideshow if needed.
    if (!$canvas.kenburnsPlay) {
      // To randomize the starting pic, let's move a random number of images from the end to the beginning.
      var rand = parseInt(Math.random() * images.length);
      images = images.splice(rand, images.length - rand).concat(images);
      options.images = images;
      $canvas.kenburns(options);
    }
    // Otherwise, just unpause it.
    else {
      $canvas.kenburnsPlay();
    }
  }

  card.onwindowsizechange = function() {
    checkAspectRatio();
  }

  card.onquit = function() {
    if (!$canvas) return;
    $canvas.kenburnsPause();
  }

  function checkAspectRatio() {
    var newAspectRatio = card.$.width() >= card.$.height() ? 'wider' : 'taller';
    if (newAspectRatio === aspectRatio) return;
    if ($canvas) {
      if (aspectRatio) $canvas.removeClass(aspectRatio);
      $canvas.addClass(newAspectRatio);
    }
    aspectRatio = newAspectRatio;
  }

  // Thanks internet! Modified from http://stackoverflow.com/questions/7231085/how-to-fall-back-to-marketplace-when-android-custom-url-scheme-not-handled
  function launchInstagram() {
    var URL = "instagram://user?username=%@".fmt(card.username);
    var MARKET = "market://details?id=com.instagram.android";
    var ITUNES = "itms-apps://itunes.apple.com/us/app/instagram/id389801252?mt=8";

    if (navigator.userAgent.match(/Android/)) {
      if (navigator.userAgent.match(/Chrome/)) {
        // Jelly Bean with Chrome browser
        setTimeout(function() {
          if (!document.webkitHidden) window.location = MARKET;
        }, 1000);
        window.location = URL;
      } else {
        // Older Android browser
        var iframe = document.createElement("iframe");
        iframe.style.border = "none";
        iframe.style.width = "1px";
        iframe.style.height = "1px";
        var t = setTimeout(function() {
          window.location = MARKET;
        }, 1000);
        iframe.onload = function () { clearTimeout(t) };
        iframe.src = URL;
        document.body.appendChild(iframe);
      }
    } else if (navigator.userAgent.match(/iPhone|iPad|iPod/)) {
      // IOS
      setTimeout(function() {
        if (!document.webkitHidden) window.location = ITUNES;
      }, 25);
      window.location = URL;
    }
  }

  return card;
})();


// ----------------------------------
// 404
//
cards.error = (function() {
  var card = {
    id: 'error',
    title: 'Error',
    useMaxHeight: true
  };

  var $errorAddress,
      $didYouMean,
      $didYouMeanLink;

  card.initialize = function() {
    $errorAddress = card.$.find('#me-error-address');
    $didYouMean = card.$.find('#me-error-didyoumean');
    $didYouMeanLink = $didYouMean.find('#me-error-didyoumean-link');
  };

  // On launch, populate the error card.
  card.onlaunch = function() {
    var errorPath = app.pathname();

    // Put the bad addres in the text.
    $errorAddress.text(errorPath);

    // See if there's a close match. If so, link it.
    var maybe = didYouMean(errorPath, cardList, 'id');
    if (maybe) {
      $didYouMean.removeClass('noyoudidnt');
      $didYouMeanLink.attr('href', '/me/%@'.fmt(maybe)).text(maybe);
    }
    else {
      $didYouMean.addClass('noyoudidnt');
    }
  }

  return card;
})();


// Scary data stuff.
try {
  cards.instagram.feed = %{instagram_feed};
  cards.instagram.username = '%{instagram_username}';
} catch(e) {
  cards.instagram.feed = [];
  cards.instagram.username = '';
}
