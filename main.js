/* ==========================================================================
   Koinonia — website behaviour

   One small function per feature (language switch, mobile menu, hero
   slider, ...). Each one looks for its HTML first and does nothing if it
   isn't on the page, so the same file works on every page of the site.
   ========================================================================== */

// Has the visitor asked their device for less animation?
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;


/* ---------- Language ----------
   The German text is written directly in the HTML. The English text sits
   next to it in a "data-en" attribute. Attributes are translated the same
   way: "data-en-alt" holds the English alt text, "data-en-aria-label" the
   English aria-label, and "data-en-content" the English meta content.

   When the page loads, we copy the German into matching "data-de"
   attributes. Switching language then just copies the text for the chosen
   language ("data-de..." or "data-en...") back into place. */

const TRANSLATED_ATTRIBUTES = ['alt', 'aria-label', 'content'];

let currentLanguage = 'de';
const languageChangeListeners = [];

function saveGermanText() {
  for (const element of document.querySelectorAll('[data-en]')) {
    element.setAttribute('data-de', element.textContent);
  }
  for (const attribute of TRANSLATED_ATTRIBUTES) {
    for (const element of document.querySelectorAll('[data-en-' + attribute + ']')) {
      element.setAttribute('data-de-' + attribute, element.getAttribute(attribute));
    }
  }
}

function translatePage() {
  for (const element of document.querySelectorAll('[data-en]')) {
    element.textContent = element.getAttribute('data-' + currentLanguage);
  }
  for (const attribute of TRANSLATED_ATTRIBUTES) {
    for (const element of document.querySelectorAll('[data-en-' + attribute + ']')) {
      element.setAttribute(attribute, element.getAttribute('data-' + currentLanguage + '-' + attribute));
    }
  }
  document.documentElement.lang = currentLanguage;
}

// Picks the German or English version of a text that this script creates
// itself (like the slider's dot labels), e.g. translate('Karte', 'Map').
function translate(germanText, englishText) {
  return currentLanguage === 'en' ? englishText : germanText;
}

// Lets a feature run some code every time the language changes.
function onLanguageChange(callback) {
  languageChangeListeners.push(callback);
}

function setLanguage(language) {
  if (language === currentLanguage) return;

  currentLanguage = language;
  saveLanguageChoice(language);
  translatePage();

  for (const callback of languageChangeListeners) {
    callback();
  }
}

// The choice is kept in localStorage so the next page opens in the same
// language. Some browsers block localStorage (e.g. in private mode) — then
// the choice simply isn't remembered.
function saveLanguageChoice(language) {
  try {
    localStorage.setItem('koinonia-lang', language);
  } catch (error) {}
}

function getSavedLanguageChoice() {
  try {
    return localStorage.getItem('koinonia-lang');
  } catch (error) {
    return null;
  }
}

// A "?lang=en" in the address wins, then the visitor's last choice,
// and German is the default.
function pickStartingLanguage() {
  const fromUrl = new URLSearchParams(window.location.search).get('lang');
  if (fromUrl === 'de' || fromUrl === 'en') {
    saveLanguageChoice(fromUrl);
    return fromUrl;
  }

  const saved = getSavedLanguageChoice();
  if (saved === 'de' || saved === 'en') return saved;

  return 'de';
}


/* ---------- The DE / EN buttons in the header ---------- */
function setupLanguageButtons() {
  const buttons = document.querySelectorAll('.lang__btn');

  function updateButtons() {
    for (const button of buttons) {
      button.setAttribute('aria-pressed', button.dataset.lang === currentLanguage);
    }
  }

  for (const button of buttons) {
    button.addEventListener('click', () => setLanguage(button.dataset.lang));
  }

  updateButtons();
  onLanguageChange(updateButtons);
}


/* ---------- Header: dark background once the page is scrolled ---------- */
function setupHeaderBackground() {
  const header = document.querySelector('.header');
  if (!header) return;

  function updateHeader() {
    header.classList.toggle('header--solid', window.scrollY > 40);
  }

  window.addEventListener('scroll', updateHeader, { passive: true });
  updateHeader();
}


/* ---------- Mobile menu (the full-screen panel behind the burger) ---------- */
function setupMobileMenu() {
  const toggleButton = document.querySelector('.nav-toggle');
  const panel = document.querySelector('.nav');
  if (!toggleButton || !panel) return;

  const body = document.body;
  let scrollPositionWhenOpened = 0;

  function isOpen() {
    return body.classList.contains('nav-open');
  }

  function updateToggleLabel() {
    if (isOpen()) {
      toggleButton.setAttribute('aria-label', translate('Menü schließen', 'Close menu'));
    } else {
      toggleButton.setAttribute('aria-label', translate('Menü öffnen', 'Open menu'));
    }
  }

  function openMenu() {
    // Pin the page where it is. Phones ignore "overflow: hidden" on the
    // body, so without this the page behind the menu would keep scrolling.
    scrollPositionWhenOpened = window.scrollY;
    body.style.top = -scrollPositionWhenOpened + 'px';
    body.classList.add('nav-open');

    toggleButton.setAttribute('aria-expanded', 'true');
    updateToggleLabel();
  }

  function closeMenu() {
    if (!isOpen()) return;

    body.classList.remove('nav-open');
    body.style.top = '';

    // Jump straight back to where the visitor was, without smooth scrolling.
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, scrollPositionWhenOpened);
    document.documentElement.style.scrollBehavior = '';

    toggleButton.setAttribute('aria-expanded', 'false');
    updateToggleLabel();
  }

  toggleButton.addEventListener('click', () => {
    if (isOpen()) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  // Clicking a link inside the menu closes it.
  panel.addEventListener('click', (event) => {
    if (event.target.closest('a')) closeMenu();
  });

  // So does the Escape key.
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) {
      closeMenu();
      toggleButton.focus();
    }
  });

  // And so does making the window wide enough for the desktop menu
  // (the same width as in styles.css).
  window.matchMedia('(min-width: 1111px)').addEventListener('change', (event) => {
    if (event.matches) closeMenu();
  });

  onLanguageChange(updateToggleLabel);
}


/* ---------- Hero slider (the fading photos on the homepage) ---------- */
function setupHeroSlider() {
  const slides = document.querySelectorAll('.hero__slide');
  const dotsContainer = document.querySelector('.hero__dots');
  if (slides.length < 2 || !dotsContainer) return;

  const dots = [];
  let currentIndex = 0;
  let timer = null;

  function showSlide(index) {
    // After the last slide, start again from the first one.
    currentIndex = index % slides.length;

    slides.forEach((slide, i) => slide.classList.toggle('is-active', i === currentIndex));
    dots.forEach((dot, i) => dot.setAttribute('aria-selected', i === currentIndex));
  }

  function restartTimer() {
    clearInterval(timer);
    if (!reduceMotion) {
      timer = setInterval(() => showSlide(currentIndex + 1), 6500);
    }
  }

  function updateDotLabels() {
    dots.forEach((dot, i) => {
      const number = i + 1;
      dot.setAttribute('aria-label', translate(
        `Bild ${number} von ${slides.length}`,
        `Image ${number} of ${slides.length}`
      ));
    });
  }

  // One dot button per slide.
  slides.forEach((slide, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('role', 'tab');
    dot.addEventListener('click', () => {
      showSlide(i);
      restartTimer();
    });
    dotsContainer.append(dot);
    dots.push(dot);
  });

  updateDotLabels();
  showSlide(0);
  restartTimer();
  onLanguageChange(updateDotLabels);

  // Pause while the browser tab is hidden, so the slides don't keep
  // changing in the background.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearInterval(timer);
    } else {
      restartTimer();
    }
  });
}


/* ---------- Fade sections in as they scroll into view ----------
   (With reduced motion, styles.css shows them straight away instead.) */
function setupScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target); // it only needs to appear once
      }
    }
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

  document.querySelectorAll('.reveal').forEach((item, i) => {
    // Items next to each other fade in one after another, not all at once.
    item.style.transitionDelay = (i % 4) * 90 + 'ms';
    observer.observe(item);
  });
}


/* ---------- Map: only load OpenStreetMap once the visitor asks ---------- */
function setupMap() {
  const frame = document.querySelector('.map-frame');
  if (!frame) return;

  function mapTitle() {
    return translate(frame.dataset.mapTitle, frame.dataset.mapTitleEn);
  }

  frame.querySelector('[data-map-load]').addEventListener('click', () => {
    const iframe = document.createElement('iframe');
    iframe.src = frame.dataset.mapSrc;
    iframe.title = mapTitle();
    iframe.referrerPolicy = 'no-referrer-when-downgrade';
    frame.replaceChildren(iframe);
    iframe.focus();
  });

  onLanguageChange(() => {
    const iframe = frame.querySelector('iframe');
    if (iframe) iframe.title = mapTitle();
  });
}


/* ---------- Highlight today in the opening-hours list ----------
   Each row lists its days in data-day: 0 = Sunday, 1 = Monday, ... */
function markTodayInOpeningHours() {
  const today = String(new Date().getDay());

  for (const row of document.querySelectorAll('[data-day]')) {
    if (row.dataset.day.split(',').includes(today)) {
      row.classList.add('is-today');
    }
  }
}


/* ---------- The year in the footer's copyright line ---------- */
function showCurrentYear() {
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
}


/* ---------- Start everything ---------- */
saveGermanText();
currentLanguage = pickStartingLanguage();
translatePage();

setupLanguageButtons();
setupHeaderBackground();
setupMobileMenu();
setupHeroSlider();
setupScrollReveal();
setupMap();
markTodayInOpeningHours();
showCurrentYear();
