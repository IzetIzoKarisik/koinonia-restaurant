/* ==========================================================================
   Koinonia — website behaviour

   This file is split into small, named functions — one per feature
   (language switch, mobile menu, hero slider, ...). Every feature checks
   for its own HTML first and simply does nothing if that HTML isn't on
   the page, so the same file works on every page of the site.

   Everything below is wrapped in one function that runs immediately.
   That's just so none of our variable and function names leak out into
   the global scope, where they could clash with some other script.
   ========================================================================== */
(function () {
  'use strict';

  // Does this visitor's browser/OS ask for reduced motion? We check this
  // once at the top and reuse the answer everywhere below.
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ==========================================================================
     Language: German is written directly in the HTML. The English text for
     an element sits next to it in a "data-en" attribute (or "data-en-alt",
     "data-en-aria-label", etc. for things other than the visible text).
     Switching language just swaps the text/attributes back and forth.
     ========================================================================== */

  var LANGUAGE_STORAGE_KEY = 'koinonia-lang';
  var ENGLISH_ATTRIBUTE_PREFIX = 'data-en-';

  // CSS can't match "any attribute that starts with data-en-", so we list
  // the ones actually used in the markup here. Add to this list if a new
  // data-en-something attribute is used in the HTML.
  var TRANSLATABLE_SELECTOR =
    '[data-en],[data-en-alt],[data-en-aria-label],' +
    '[data-en-content],[data-en-title]';

  var currentLanguage = 'de';
  var languageChangeListeners = [];

  function saveLanguageChoice(value) {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, value);
    } catch (e) {
      // Some browsers block localStorage (e.g. private browsing mode).
      // That's fine — we just won't remember the choice for next time.
    }
  }

  function getSavedLanguageChoice() {
    try {
      return window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  // Reads "?lang=de" or "?lang=en" from the page URL, e.g.
  // "https://.../index.html?lang=en" -> "en". Returns null if there is no
  // such parameter in the URL.
  function getLanguageFromUrl() {
    var query = window.location.search; // e.g. "?lang=en&table=2"
    if (query === '') return null;

    var params = query.slice(1).split('&'); // ["lang=en", "table=2"]
    for (var i = 0; i < params.length; i++) {
      if (params[i] === 'lang=de') return 'de';
      if (params[i] === 'lang=en') return 'en';
    }
    return null;
  }

  // Decides which language to start with: the URL wins, then whatever was
  // remembered from a previous visit, and German is the default.
  function pickStartingLanguage() {
    var fromUrl = getLanguageFromUrl();
    if (fromUrl !== null) {
      saveLanguageChoice(fromUrl);
      return fromUrl;
    }

    var saved = getSavedLanguageChoice();
    if (saved === 'de' || saved === 'en') return saved;

    return 'de';
  }

  // The first time we translate an element's text, we save the original
  // German text on the element itself. That way, switching back to German
  // later doesn't need a second copy of the text anywhere in the HTML.
  function getOriginalGermanText(el) {
    if (el.__germanText === undefined) {
      el.__germanText = el.textContent;
    }
    return el.__germanText;
  }

  // Same idea, but for one attribute (alt, aria-label, ...) instead of the
  // visible text.
  function getOriginalGermanAttribute(el, name) {
    if (el.__germanAttributes === undefined) {
      el.__germanAttributes = {};
    }
    if (el.__germanAttributes[name] === undefined) {
      el.__germanAttributes[name] = el.getAttribute(name);
    }
    return el.__germanAttributes[name];
  }

  // Switches one element's text and translated attributes to the current
  // language.
  function translateElement(el) {
    var englishText = el.getAttribute('data-en');
    if (englishText !== null) {
      var germanText = getOriginalGermanText(el);
      if (currentLanguage === 'en') {
        el.textContent = englishText;
      } else {
        el.textContent = germanText;
      }
    }

    // Find every attribute on this element that starts with "data-en-".
    // We collect the names first, then change them in a second loop —
    // changing an attribute while looping over el.attributes directly
    // would skip some of the others.
    var namesToTranslate = [];
    for (var i = 0; i < el.attributes.length; i++) {
      var attributeName = el.attributes[i].name;
      if (attributeName.indexOf(ENGLISH_ATTRIBUTE_PREFIX) === 0) {
        namesToTranslate.push(attributeName);
      }
    }

    for (var j = 0; j < namesToTranslate.length; j++) {
      var englishAttributeName = namesToTranslate[j];
      var targetAttributeName = englishAttributeName.slice(ENGLISH_ATTRIBUTE_PREFIX.length);
      var englishValue = el.getAttribute(englishAttributeName);
      var germanValue = getOriginalGermanAttribute(el, targetAttributeName);

      if (currentLanguage === 'en') {
        el.setAttribute(targetAttributeName, englishValue);
      } else if (germanValue !== null) {
        el.setAttribute(targetAttributeName, germanValue);
      }
    }
  }

  // Translates every matching element on the page to the current language.
  function translatePage() {
    var elements = document.querySelectorAll(TRANSLATABLE_SELECTOR);
    for (var i = 0; i < elements.length; i++) {
      translateElement(elements[i]);
    }

    document.documentElement.lang = currentLanguage;
  }

  // Lets other parts of this file run some code every time the language
  // changes (e.g. to update a button label).
  function onLanguageChange(callback) {
    languageChangeListeners.push(callback);
  }

  // Switches the whole page to "de" or "en".
  function setLanguage(next) {
    if (next !== 'de' && next !== 'en') return;
    if (next === currentLanguage) return;

    currentLanguage = next;
    saveLanguageChoice(currentLanguage);
    translatePage();

    for (var i = 0; i < languageChangeListeners.length; i++) {
      languageChangeListeners[i](currentLanguage);
    }
  }

  // Shorthand used by the JavaScript-generated bits of the page (like the
  // slider's dot labels) that don't have data-en attributes of their own:
  // translate('Deutsch', 'English') returns whichever one is current.
  function translate(germanText, englishText) {
    if (currentLanguage === 'en') return englishText;
    return germanText;
  }

  currentLanguage = pickStartingLanguage();
  translatePage();

  /* ---------- The DE / EN switch in the header ---------- */
  function setupLanguageButtons() {
    var group = document.querySelector('.lang');
    if (!group) return;

    var buttons = group.querySelectorAll('[data-lang]');

    function updateButtonState() {
      for (var i = 0; i < buttons.length; i++) {
        var button = buttons[i];
        var isActiveLanguage = button.getAttribute('data-lang') === currentLanguage;
        button.setAttribute('aria-pressed', String(isActiveLanguage));
      }
    }

    group.addEventListener('click', function (event) {
      var button = event.target.closest('[data-lang]');
      if (button) setLanguage(button.getAttribute('data-lang'));
    });

    onLanguageChange(updateButtonState);
    updateButtonState();
  }

  /* ---------- Header: solid background once scrolled past the hero top --- */
  function setupHeaderBackground() {
    var header = document.querySelector('.header');
    if (!header) return;
    if (header.classList.contains('header--static')) return;

    var updateIsScheduled = false;

    function updateHeader() {
      if (window.scrollY > 40) {
        header.classList.add('header--solid');
      } else {
        header.classList.remove('header--solid');
      }
      updateIsScheduled = false;
    }

    window.addEventListener('scroll', function () {
      // Only schedule one update per animation frame, however many scroll
      // events fire in between — this keeps scrolling smooth.
      if (!updateIsScheduled) {
        window.requestAnimationFrame(updateHeader);
        updateIsScheduled = true;
      }
    }, { passive: true });

    updateHeader();
  }

  /* ---------- Mobile navigation (the slide-out menu panel) ---------- */
  function setupMobileNav() {
    var toggleButton = document.querySelector('.nav-toggle');
    var panel = document.querySelector('.nav');
    if (!toggleButton || !panel) return;

    var body = document.body;
    var html = document.documentElement;
    var scrollPositionWhenOpened = 0;

    function updateToggleLabel() {
      var isOpen = body.classList.contains('nav-open');
      if (isOpen) {
        toggleButton.setAttribute('aria-label', translate('Menü schließen', 'Close menu'));
      } else {
        toggleButton.setAttribute('aria-label', translate('Menü öffnen', 'Open menu'));
      }
    }
    onLanguageChange(updateToggleLabel);

    function openMenu() {
      if (body.classList.contains('nav-open')) return;

      // Remember where the visitor was, then pin the page at that spot.
      // Mobile browsers ignore "overflow: hidden" on <body>, so without
      // this trick the page behind the menu panel would keep scrolling.
      scrollPositionWhenOpened = window.pageYOffset || html.scrollTop || 0;
      body.style.top = -scrollPositionWhenOpened + 'px';
      body.classList.add('nav-open', 'is-scroll-locked');

      toggleButton.setAttribute('aria-expanded', 'true');
      updateToggleLabel();
    }

    function closeMenu() {
      if (!body.classList.contains('nav-open')) return;

      body.classList.remove('nav-open', 'is-scroll-locked');
      body.style.top = '';

      // Jump back to where the visitor was, without a smooth-scroll
      // animation fighting us on the way there.
      var previousScrollBehavior = html.style.scrollBehavior;
      html.style.scrollBehavior = 'auto';
      window.scrollTo(0, scrollPositionWhenOpened);
      html.style.scrollBehavior = previousScrollBehavior;

      toggleButton.setAttribute('aria-expanded', 'false');
      updateToggleLabel();
    }

    toggleButton.addEventListener('click', function () {
      if (body.classList.contains('nav-open')) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    // Clicking a link inside the panel should close it.
    panel.addEventListener('click', function (event) {
      if (event.target.closest('a')) closeMenu();
    });

    // The Escape key closes the panel too.
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && body.classList.contains('nav-open')) {
        closeMenu();
        toggleButton.focus();
      }
    });

    // If the window is resized back up to desktop width, make sure the
    // mobile panel isn't left open behind the desktop navigation.
    var desktopQuery = window.matchMedia('(min-width: 901px)');
    desktopQuery.addEventListener('change', function (event) {
      if (event.matches) closeMenu();
    });
  }

  /* ---------- Hero slider (the fading photos on the homepage) ---------- */
  function setupHeroSlider() {
    var slides = document.querySelectorAll('.hero__slide');
    var dotsContainer = document.querySelector('.hero__dots');
    if (slides.length < 2) return;

    var currentIndex = 0;
    var timer = null;
    var DELAY_MS = 6500;
    var dots = [];

    function dotLabel(index) {
      return translate(
        'Bild ' + (index + 1) + ' von ' + slides.length,
        'Image ' + (index + 1) + ' of ' + slides.length
      );
    }

    function showSlide(index) {
      slides[currentIndex].classList.remove('is-active');
      dots[currentIndex].setAttribute('aria-selected', 'false');

      // Wrap around: one before the first slide is the last slide, and
      // one after the last slide is the first slide again.
      currentIndex = (index + slides.length) % slides.length;

      slides[currentIndex].classList.add('is-active');
      dots[currentIndex].setAttribute('aria-selected', 'true');
    }

    function restartTimer() {
      window.clearInterval(timer);
      if (!reduceMotion) {
        timer = window.setInterval(function () {
          showSlide(currentIndex + 1);
        }, DELAY_MS);
      }
    }

    // Returns a click handler for one dot button that jumps straight to
    // "index". Written as its own function so each button gets the right
    // index, instead of all of them sharing the last value of a loop
    // variable.
    function makeDotClickHandler(index) {
      return function () {
        showSlide(index);
        restartTimer();
      };
    }

    // Build one dot button per slide.
    for (var i = 0; i < slides.length; i++) {
      var dot = document.createElement('button');
      dot.type = 'button';
      dot.setAttribute('role', 'tab');
      dot.setAttribute('aria-label', dotLabel(i));
      dot.addEventListener('click', makeDotClickHandler(i));

      if (dotsContainer) dotsContainer.appendChild(dot);
      dots.push(dot);
    }

    showSlide(0);
    restartTimer();

    onLanguageChange(function () {
      for (var i = 0; i < dots.length; i++) {
        dots[i].setAttribute('aria-label', dotLabel(i));
      }
    });

    // Pause the slideshow while the browser tab is hidden, so slides
    // don't silently change several times in the background.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        window.clearInterval(timer);
      } else {
        restartTimer();
      }
    });
  }

  /* ---------- Fade sections in as you scroll down to them ---------- */
  function setupScrollReveal() {
    var items = document.querySelectorAll('.reveal');
    if (items.length === 0) return;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      // No animation support, or the visitor asked for reduced motion —
      // just show everything immediately instead of animating it in.
      for (var i = 0; i < items.length; i++) {
        items[i].classList.add('is-visible');
      }
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          // Once it has appeared, we don't need to keep watching it.
          observer.unobserve(entry.target);
        }
      }
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

    for (var j = 0; j < items.length; j++) {
      // Items revealed together get a slightly different delay, so they
      // don't all fade in at exactly the same instant.
      items[j].style.transitionDelay = (j % 4) * 90 + 'ms';
      observer.observe(items[j]);
    }
  }

  /* ---------- Map: only contact OpenStreetMap once the visitor asks ---------- */
  function setupMapConsent() {
    var frame = document.querySelector('[data-map-src]');
    if (!frame) return;
    var button = frame.querySelector('[data-map-load]');

    button.addEventListener('click', function () {
      var iframe = document.createElement('iframe');
      iframe.src = frame.getAttribute('data-map-src');
      iframe.title = translate(frame.getAttribute('data-map-title'), frame.getAttribute('data-map-title-en'));
      iframe.referrerPolicy = 'no-referrer-when-downgrade';
      frame.innerHTML = '';
      frame.appendChild(iframe);
      iframe.focus();
    });

    onLanguageChange(function () {
      var iframe = frame.querySelector('iframe');
      if (iframe) {
        iframe.title = translate(frame.getAttribute('data-map-title'), frame.getAttribute('data-map-title-en'));
      }
    });
  }

  /* ---------- Mark today's row in the opening-hours table ---------- */
  function markTodayInHours() {
    var rows = document.querySelectorAll('[data-day]');
    if (rows.length === 0) return;

    // getDay() returns 0 for Sunday, 1 for Monday, and so on.
    var today = String(new Date().getDay());

    for (var i = 0; i < rows.length; i++) {
      var days = rows[i].getAttribute('data-day').split(',');
      if (days.indexOf(today) > -1) {
        rows[i].classList.add('is-today');
      }
    }
  }

  /* ---------- Run every feature ---------- */
  setupLanguageButtons();
  setupHeaderBackground();
  setupMobileNav();
  setupHeroSlider();
  setupScrollReveal();
  setupMapConsent();
  markTodayInHours();
}());
