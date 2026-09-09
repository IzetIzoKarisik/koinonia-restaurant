/* ==========================================================================
   Koinonia — site behaviour
   Header state, mobile nav, hero slider, scroll reveal, menu lightbox.
   Every module bails out quietly if its markup is absent, so one file
   serves every page.
   ========================================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Language: German is the source, English on request ----------
     Every translatable string sits beside its German original in the markup:
     data-en carries the text, data-en-<attribute> anything else (alt,
     aria-label, content, title, data-title). The choice is remembered per
     visitor, and ?lang=en links straight to the English version. */
  var i18n = (function () {
    var STORE = 'koinonia-lang';
    var PREFIX = 'data-en-';
    // CSS cannot match "any attribute starting with", so the translated
    // attributes are listed here - extend it when the markup gains a new one.
    var SELECTOR = '[data-en],[data-en-alt],[data-en-aria-label],' +
                   '[data-en-content],[data-en-title],[data-en-data-title]';
    var listeners = [];
    var lang = 'de';

    function remember(value) {
      try { window.localStorage.setItem(STORE, value); } catch (e) { /* private mode */ }
    }

    (function pick() {
      var fromUrl = /[?&]lang=(de|en)(?:&|$)/.exec(window.location.search);
      var wanted = fromUrl && fromUrl[1];
      if (!wanted) {
        try { wanted = window.localStorage.getItem(STORE); } catch (e) { /* private mode */ }
      }
      if (wanted !== 'de' && wanted !== 'en') return;
      lang = wanted;
      if (fromUrl) remember(lang);
    }());

    // The German wording is cached on the element the first time it is read,
    // so switching back needs no second copy of it in the markup. It has to be
    // taken on every swap, English ones included: a visitor who arrives with
    // English already chosen would otherwise overwrite the original unseen.
    function german(el, key, read) {
      var cache = el.__koinoniaDe || (el.__koinoniaDe = {});
      if (!(key in cache)) cache[key] = read();
      return cache[key];
    }

    function swap(el) {
      var text = el.getAttribute('data-en');
      if (text !== null) {
        var originalText = german(el, '#text', function () { return el.textContent; });
        el.textContent = lang === 'en' ? text : originalText;
      }
      // Copy first: setAttribute writes into the live NamedNodeMap we iterate.
      Array.prototype.slice.call(el.attributes).forEach(function (attr) {
        if (attr.name.indexOf(PREFIX) !== 0) return;
        var name = attr.name.slice(PREFIX.length);
        var original = german(el, name, function () { return el.getAttribute(name); });
        var value = lang === 'en' ? attr.value : original;
        if (value !== null) el.setAttribute(name, value);
      });
    }

    function apply(root) {
      var scope = root || document;
      if (scope.nodeType === 1 && scope.matches(SELECTOR)) swap(scope);
      Array.prototype.forEach.call(scope.querySelectorAll(SELECTOR), swap);
      document.documentElement.lang = lang;
    }

    apply();

    return {
      current: function () { return lang; },
      t: function (de, en) { return lang === 'en' ? en : de; },
      apply: apply,
      onChange: function (fn) { listeners.push(fn); },
      set: function (next) {
        if (next !== 'de' && next !== 'en') return;
        if (next === lang) return;
        lang = next;
        remember(lang);
        apply();
        listeners.forEach(function (fn) { fn(lang); });
      }
    };
  }());

  /* ---------- The DE / EN switch in the header ---------- */
  (function langSwitch() {
    var group = document.querySelector('.lang');
    if (!group) return;

    var buttons = Array.prototype.slice.call(group.querySelectorAll('[data-lang]'));

    function sync() {
      buttons.forEach(function (btn) {
        btn.setAttribute('aria-pressed', String(btn.getAttribute('data-lang') === i18n.current()));
      });
    }

    group.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-lang]');
      if (btn) i18n.set(btn.getAttribute('data-lang'));
    });

    i18n.onChange(sync);
    sync();
  }());

  /* ---------- Header: solid once scrolled past the hero top ---------- */
  (function header() {
    var el = document.querySelector('.header');
    if (!el || el.classList.contains('header--static')) return;

    var ticking = false;
    function update() {
      el.classList.toggle('header--solid', window.scrollY > 40);
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();
  }());

  /* ---------- Mobile navigation ---------- */
  (function nav() {
    var toggle = document.querySelector('.nav-toggle');
    var panel = document.querySelector('.nav');
    if (!toggle || !panel) return;

    var body = document.body;
    var html = document.documentElement;
    var lockedAt = 0;

    // Pin the page instead of relying on overflow:hidden, which mobile
    // browsers ignore on <body> - otherwise the page behind the panel keeps
    // scrolling and you land somewhere else when it closes.
    function setOpen(open) {
      if (open === body.classList.contains('nav-open')) return;

      if (open) {
        lockedAt = window.pageYOffset || html.scrollTop || 0;
        body.style.top = -lockedAt + 'px';
        body.classList.add('nav-open', 'is-scroll-locked');
      } else {
        body.classList.remove('nav-open', 'is-scroll-locked');
        body.style.top = '';
        var behavior = html.style.scrollBehavior;
        html.style.scrollBehavior = 'auto';   // defeat scroll-behavior: smooth
        window.scrollTo(0, lockedAt);
        html.style.scrollBehavior = behavior;
      }

      toggle.setAttribute('aria-expanded', String(open));
      label();
    }

    function label() {
      var open = body.classList.contains('nav-open');
      toggle.setAttribute('aria-label', open ? i18n.t('Menü schließen', 'Close menu')
                                             : i18n.t('Menü öffnen', 'Open menu'));
    }
    i18n.onChange(label);

    toggle.addEventListener('click', function () {
      setOpen(!body.classList.contains('nav-open'));
    });

    panel.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && body.classList.contains('nav-open')) {
        setOpen(false);
        toggle.focus();
      }
    });

    // Reset when resizing back up to the desktop layout.
    window.matchMedia('(min-width: 901px)').addEventListener('change', function (e) {
      if (e.matches) setOpen(false);
    });
  }());

  /* ---------- Hero slider ---------- */
  (function hero() {
    var slides = Array.prototype.slice.call(document.querySelectorAll('.hero__slide'));
    var dotWrap = document.querySelector('.hero__dots');
    if (slides.length < 2) return;

    var index = 0;
    var timer = null;
    var DELAY = 6500;

    function dotLabel(i) {
      return i18n.t('Bild ' + (i + 1) + ' von ' + slides.length,
                    'Image ' + (i + 1) + ' of ' + slides.length);
    }

    var dots = slides.map(function (_, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-label', dotLabel(i));
      b.addEventListener('click', function () { go(i); restart(); });
      if (dotWrap) dotWrap.appendChild(b);
      return b;
    });

    function go(next) {
      slides[index].classList.remove('is-active');
      dots[index].setAttribute('aria-selected', 'false');
      index = (next + slides.length) % slides.length;
      slides[index].classList.add('is-active');
      dots[index].setAttribute('aria-selected', 'true');
    }

    function restart() {
      window.clearInterval(timer);
      if (!reduceMotion) timer = window.setInterval(function () { go(index + 1); }, DELAY);
    }

    go(0);
    restart();

    i18n.onChange(function () {
      dots.forEach(function (b, i) { b.setAttribute('aria-label', dotLabel(i)); });
    });

    // Pause while the tab is hidden so slides don't race in the background.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) window.clearInterval(timer);
      else restart();
    });
  }());

  /* ---------- Reveal on scroll ---------- */
  (function reveal() {
    var items = document.querySelectorAll('.reveal');
    if (!items.length) return;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

    items.forEach(function (el, i) {
      el.style.transitionDelay = (i % 4) * 90 + 'ms';
      io.observe(el);
    });
  }());

  /* ---------- Lightbox for the scanned menu pages ---------- */
  (function lightbox() {
    var cards = Array.prototype.slice.call(document.querySelectorAll('[data-full]'));
    if (!cards.length) return;

    var lastFocus = null;
    var current = 0;

    var box = document.createElement('div');
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Speisekarte in voller Größe');
    box.setAttribute('data-en-aria-label', 'Menu page at full size');
    box.innerHTML =
      '<div class="lightbox__bar">' +
        '<span class="lightbox__title"></span>' +
        '<div class="lightbox__actions">' +
          '<button type="button" class="lightbox__btn" data-lb="prev" aria-label="Vorherige Seite" data-en-aria-label="Previous page">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>' +
          '</button>' +
          '<button type="button" class="lightbox__btn" data-lb="next" aria-label="Nächste Seite" data-en-aria-label="Next page">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>' +
          '</button>' +
          '<a class="lightbox__btn" data-lb="open" href="#" target="_blank" rel="noopener" aria-label="Bild in neuem Tab öffnen" data-en-aria-label="Open image in a new tab">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/></svg>' +
          '</a>' +
          '<button type="button" class="lightbox__btn" data-lb="close" aria-label="Schließen" data-en-aria-label="Close">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div class="lightbox__stage"><img alt=""></div>';
    document.body.appendChild(box);
    i18n.apply(box);

    var img = box.querySelector('.lightbox__stage img');
    var title = box.querySelector('.lightbox__title');
    var openLink = box.querySelector('[data-lb="open"]');
    var stage = box.querySelector('.lightbox__stage');
    var closeBtn = box.querySelector('[data-lb="close"]');

    function show(i) {
      current = (i + cards.length) % cards.length;
      var card = cards[current];
      var label = card.getAttribute('data-title') || '';
      img.src = card.getAttribute('data-full');
      img.alt = label;
      title.textContent = label + '  ·  ' + (current + 1) + '/' + cards.length;
      openLink.href = card.getAttribute('data-full');
      stage.scrollTop = 0;
    }

    function open(i) {
      lastFocus = document.activeElement;
      show(i);
      box.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      closeBtn.focus();
    }

    function close() {
      box.classList.remove('is-open');
      document.body.style.overflow = '';
      img.removeAttribute('src');
      if (lastFocus) lastFocus.focus();
    }

    cards.forEach(function (card, i) {
      card.addEventListener('click', function () { open(i); });
    });

    // The page titles come from the cards, which i18n has just re-labelled.
    i18n.onChange(function () {
      if (box.classList.contains('is-open')) show(current);
    });

    box.addEventListener('click', function (e) {
      var action = e.target.closest('[data-lb]');
      if (action) {
        var kind = action.getAttribute('data-lb');
        if (kind === 'close') close();
        if (kind === 'prev') show(current - 1);
        if (kind === 'next') show(current + 1);
        return;
      }
      // Clicking the backdrop (but not the image) closes.
      if (e.target === stage || e.target === box) close();
    });

    document.addEventListener('keydown', function (e) {
      if (!box.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(current - 1);
      if (e.key === 'ArrowRight') show(current + 1);
      if (e.key === 'Tab') {
        // Keep focus inside the dialog.
        var focusables = box.querySelectorAll('button, a[href]');
        var first = focusables[0];
        var last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }());

  /* ---------- Mark today's row in the opening hours ---------- */
  (function today() {
    var rows = document.querySelectorAll('[data-day]');
    if (!rows.length) return;
    var d = String(new Date().getDay());
    rows.forEach(function (row) {
      if (row.getAttribute('data-day').split(',').indexOf(d) > -1) {
        row.classList.add('is-today');
      }
    });
  }());
}());
