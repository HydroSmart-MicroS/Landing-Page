const header = document.querySelector('.site-header');
const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('#navegacion');

const root = document.documentElement;
const themeToggle = document.querySelector('.theme-toggle');
const themeColor = document.querySelector('meta[name="theme-color"]');

function updateTheme() {
  root.dataset.theme = root.dataset.themePreference ?? 'light';
  themeToggle.setAttribute('aria-checked', String(root.dataset.theme === 'dark'));
  themeColor.content = getComputedStyle(root).getPropertyValue('--paper').trim();
}

updateTheme();
themeToggle.hidden = false;
themeToggle.addEventListener('click', () => {
  root.dataset.themePreference = root.dataset.theme === 'dark' ? 'light' : 'dark';
  try {
    localStorage.setItem('hydrosmart-landing-theme', root.dataset.themePreference);
  } catch {}
  updateTheme();
});

function setMenu(open) {
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  nav.classList.toggle('open', open);
}

function updateHeader() {
  header.classList.toggle('scrolled', window.scrollY > 24);
}

document.documentElement.classList.add('js-enabled');
updateHeader();
window.addEventListener('scroll', updateHeader, { passive: true });
toggle.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
nav.addEventListener('click', (event) => {
  if (event.target.closest('a')) setMenu(false);
});
document.addEventListener('click', (event) => {
  if (nav.classList.contains('open') && !header.contains(event.target)) setMenu(false);
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !nav.classList.contains('open')) return;
  setMenu(false);
  toggle.focus();
});

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const titlesInView = new IntersectionObserver((entries) => {
  for (const { target, isIntersecting } of entries) {
    target.classList.toggle('title-water-active', isIntersecting);
  }
});
document.querySelectorAll('[data-title-water]').forEach((title) => titlesInView.observe(title));

let lenis;
let animateNavigation;
let departure;

document.addEventListener('click', (event) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || reducedMotion.matches) return;

  const link = event.target.closest('a[href]');
  if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return;

  if (link.getAttribute('href').startsWith('#')) {
    const target = document.getElementById(link.hash.slice(1));
    if (!lenis || !target) return;

    event.preventDefault();
    if (location.hash !== link.hash) history.pushState(null, '', link.hash);
    target.focus({ preventScroll: true });
    lenis.scrollTo(target, { duration: 0.95, easing: (progress) => 1 - (1 - progress) ** 3 });
    return;
  }

  if (!animateNavigation || link.origin !== location.origin || link.href === location.href) return;

  event.preventDefault();
  if (departure) return;

  departure = animateNavigation(document.querySelector('main'), {
    opacity: [1, 0.48],
    transform: ['translateY(0)', 'translateY(-12px)']
  }, { duration: 0.2, ease: 'easeIn' });

  const navigate = () => location.assign(link.href);
  departure.finished.then(navigate, navigate);
});

window.addEventListener('popstate', () => {
  if (lenis?.isScrolling !== 'smooth') return;
  // Deja que el navegador restaure la posición del historial.
  lenis.stop();
  lenis.start();
});

window.addEventListener('pageshow', (event) => {
  if (!event.persisted || !departure) return;
  departure.cancel();
  departure = undefined;
});

if (!reducedMotion.matches) {
  import('https://cdn.jsdelivr.net/npm/lenis@1.3.27/dist/lenis.mjs')
    .then(({ default: Lenis }) => {
      lenis = new Lenis({ autoRaf: true, stopInertiaOnNavigate: true });
    })
    .catch((error) => console.warn('No se pudo cargar el desplazamiento suave.', error));

  import('https://cdn.jsdelivr.net/npm/framer-motion@14.13.0/dom/+esm')
    .then(({ animate, inView, scroll }) => {
      if (reducedMotion.matches) return;
      animateNavigation = animate;

      const enter = (element, delay = 0) => animate(element, {
        opacity: [0.35, 1],
        transform: ['translateY(20px)', 'translateY(0)']
      }, { duration: 0.62, delay, ease: [0.22, 1, 0.36, 1] });

      document.querySelectorAll('[data-intro]').forEach((element, index) => enter(element, index * 0.07));

      inView('[data-reveal]', (element) => {
        if (!reducedMotion.matches) enter(element);
      }, { amount: 0.18 });

      const water = document.querySelector('.hero-water');
      animate(water.firstElementChild, { scale: [1.08, 1] }, { duration: 1.45, ease: 'easeOut' });
      const animation = animate(water, {
        transform: ['scale(1)', 'translateY(9%) scale(1.24)']
      }, { ease: 'linear' });
      const stop = scroll(animation, { target: water.parentElement, offset: ['start start', 'end start'] });
      reducedMotion.addEventListener('change', ({ matches }) => {
        if (!matches) return;
        stop();
        animation.cancel();
      }, { once: true });
    })
    .catch((error) => console.warn('No se pudieron cargar las animaciones.', error));
}
