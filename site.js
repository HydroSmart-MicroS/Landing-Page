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
let scrollIdle;
window.addEventListener('scroll', () => {
  updateHeader();
  if (!root.classList.contains('is-scrolling')) root.classList.add('is-scrolling');
  clearTimeout(scrollIdle);
  scrollIdle = setTimeout(() => root.classList.remove('is-scrolling'), 160);
}, { passive: true });
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

let animateNavigation;
let departure;

document.addEventListener('click', (event) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || reducedMotion.matches) return;

  const link = event.target.closest('a[href]');
  if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return;

  if (link.getAttribute('href').startsWith('#')) return;

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

window.addEventListener('pageshow', (event) => {
  if (!event.persisted || !departure) return;
  departure.cancel();
  departure = undefined;
});

if (!reducedMotion.matches) {
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

      const detailAnimations = [];
      const dashboard = document.querySelector('.dashboard');
      const consumption = dashboard.querySelector('[data-demo-consumption]');
      const cost = dashboard.querySelector('[data-demo-cost]');
      const finalConsumption = consumption.textContent;
      const finalCost = cost.textContent;

      inView(dashboard, () => {
        if (reducedMotion.matches) return;
        const line = dashboard.querySelector('.chart-line');
        line.style.strokeDasharray = '1';
        detailAnimations.push(
          animate(line, { strokeDashoffset: [1, 0] }, { duration: 1.25, ease: 'easeInOut' }),
          animate(dashboard.querySelector('.chart-fill'), { opacity: [0, 1] }, { duration: 1, delay: 0.2 }),
          animate(0, 8400, {
            duration: 1.1,
            ease: 'easeOut',
            onUpdate: value => { consumption.textContent = Math.round(value).toLocaleString('en-US').replaceAll(',', ' '); },
            onComplete: () => { consumption.textContent = finalConsumption; }
          }),
          animate(0, 19.32, {
            duration: 1.1,
            ease: 'easeOut',
            onUpdate: value => { cost.textContent = value.toFixed(2).replace('.', ','); },
            onComplete: () => { cost.textContent = finalCost; }
          }),
          animate(dashboard.querySelector('.dashboard-alert'), {
            opacity: [0, 1],
            transform: ['translateY(8px)', 'translateY(0)']
          }, { duration: 0.4, delay: 1.1 })
        );
      }, { amount: 0.35 });

      inView('.member', (member) => {
        if (reducedMotion.matches) return;
        const index = [...member.parentElement.children].indexOf(member);
        detailAnimations.push(animate(member.querySelector('.portrait img'), {
          opacity: [0.45, 1],
          transform: ['translateY(16px) scale(1.06)', 'translateY(0) scale(1)']
        }, { duration: 0.8, delay: (index % 3) * 0.06, ease: [0.22, 1, 0.36, 1] }));
      }, { amount: 0.2 });

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
        detailAnimations.forEach(detail => detail.cancel());
        consumption.textContent = finalConsumption;
        cost.textContent = finalCost;
        document.querySelectorAll('.chart-line, .chart-fill, .dashboard-alert, .portrait img').forEach(element => {
          element.style.removeProperty('opacity');
          element.style.removeProperty('transform');
          element.style.removeProperty('stroke-dasharray');
          element.style.removeProperty('stroke-dashoffset');
        });
      }, { once: true });
    })
    .catch((error) => console.warn('No se pudieron cargar las animaciones.', error));
}
