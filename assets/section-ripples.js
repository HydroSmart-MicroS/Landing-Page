// Efecto original (filtros SVG) para las secciones fuera del hero; el hero usa water-ripples.js (WebGL).
const pointerMotion = matchMedia('(any-hover: hover) and (any-pointer: fine) and (prefers-reduced-motion: no-preference)');
const lifetime = 400;
const interval = 80;
const waveCount = Math.ceil(lifetime / interval);
const maxRadius = 156;
const excludedCards = '[data-rb-spotlight], [data-rb-tilt], .member';

// A child cannot opt out of an ancestor's SVG filter, so filter the surrounding content separately.
function rippleTargets(element) {
  if (element.matches(excludedCards)) return [];
  if (!element.querySelector(excludedCards)) return [element];
  return [...element.children].flatMap(rippleTargets);
}

function svgElement(tag, attributes = {}) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}

function rippleTexture() {
  const canvas = document.createElement('canvas');
  const size = 128;
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const texture = ctx.createImageData(size, size);

  // Red and green encode the horizontal and vertical displacement of each pixel.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) * 2 / size - 1;
      const dy = (y + 0.5) * 2 / size - 1;
      const distance = Math.hypot(dx, dy);
      const envelope = Math.max(0, 1 - Math.abs(distance - 0.68) / 0.31);
      const wave = Math.sin((distance - 0.68) * 29) / distance;
      const pixel = (y * size + x) * 4;
      texture.data[pixel] = 128 + 127 * wave * dx;
      texture.data[pixel + 1] = 128 + 127 * wave * dy;
      texture.data[pixel + 3] = 255 * envelope ** 2;
    }
  }

  ctx.putImageData(texture, 0, 0);
  return canvas.toDataURL();
}

function setupRipples() {
  const svg = svgElement('svg', { width: 0, height: 0, 'aria-hidden': 'true' });
  svg.style.position = 'absolute';
  document.body.append(svg);
  const texture = rippleTexture();
  const targets = [...document.querySelectorAll('main > section:not(.hero), .site-footer, .header-inner > *')].flatMap(rippleTargets).map((element, index) => {
    const id = 'water-ripple-' + index;
    const filter = svgElement('filter', { id, filterUnits: 'userSpaceOnUse', x: -56, y: -56, 'color-interpolation-filters': 'sRGB' });
    filter.append(svgElement('feFlood', { 'flood-color': '#808080', result: 'still' }));
    const merge = svgElement('feMerge', { result: 'water' });
    merge.append(svgElement('feMergeNode', { in: 'still' }));
    const waves = Array.from({ length: waveCount }, (_, index) => {
      const name = 'wave' + index;
      const image = svgElement('feImage', { href: texture, width: 1, height: 1, result: name });
      const fade = svgElement('feComponentTransfer', { in: name, result: name + '-faded' });
      const opacity = svgElement('feFuncA', { type: 'linear', slope: 0 });
      fade.append(opacity);
      filter.append(image, fade);
      merge.append(svgElement('feMergeNode', { in: name + '-faded' }));
      return { image, opacity };
    });
    filter.append(merge, svgElement('feDisplacementMap', {
      in: 'SourceGraphic', in2: 'water', scale: element.matches('.hero') ? 7 : 5,
      xChannelSelector: 'R', yChannelSelector: 'G'
    }));
    svg.append(filter);
    return { element, id, filter, waves };
  });

  let drops = [];
  let frame;
  let active = new Set();

  function stop() {
    cancelAnimationFrame(frame);
    frame = undefined;
    drops = [];
    for (const target of active) target.element.style.removeProperty('filter');
    active.clear();
  }

  function draw(now) {
    drops = drops.filter(({ time }) => now - time < lifetime);
    if (!drops.length) {
      stop();
      return;
    }

    const circles = drops.map(({ x, y, time }) => {
      const age = Math.max(0, now - time) / lifetime;
      const strength = Math.min(1, 0.6 + age * 10) * (1 - age * age);
      return { x, y, radius: 24 + (maxRadius - 24) * age, strength };
    });
    const visible = new Set();

    // Read layout before updating filters and only rasterize elements near an active wave.
    const bounds = targets.map((target) => target.element.getBoundingClientRect());
    for (const [index, target] of targets.entries()) {
      const { left, top, right, bottom, width, height } = bounds[index];
      if (!width || !height || !circles.some(({ x, y, radius }) =>
        x + radius >= left && x - radius <= right && y + radius >= top && y - radius <= bottom)) continue;

      visible.add(target);
      if (width !== target.width || height !== target.height) {
        target.width = width;
        target.height = height;
        target.filter.setAttribute('width', width + 112);
        target.filter.setAttribute('height', height + 112);
      }

      for (const [waveIndex, { image, opacity }] of target.waves.entries()) {
        const circle = circles[waveIndex];
        if (!circle) {
          if (opacity.getAttribute('slope') !== '0') opacity.setAttribute('slope', 0);
          continue;
        }
        opacity.setAttribute('slope', circle.strength);
        const { x, y, radius } = circle;
        image.setAttribute('x', x - left - radius);
        image.setAttribute('y', y - top - radius);
        image.setAttribute('width', 2 * radius);
        image.setAttribute('height', 2 * radius);
      }

      if (!active.has(target)) target.element.style.filter = 'url(#' + target.id + ')';
    }

    for (const target of active) {
      if (!visible.has(target)) target.element.style.removeProperty('filter');
    }
    active = visible;
    frame = requestAnimationFrame(draw);
  }

  pointerMotion.addEventListener('change', stop);
  document.addEventListener('visibilitychange', stop);
  window.addEventListener('wheel', stop, { passive: true });
  window.addEventListener('scroll', stop, { passive: true });

  const add = ({ clientX: x, clientY: y }) => {
    const time = performance.now();
    const last = drops.at(-1);
    if (last && (time - last.time < interval || Math.hypot(x - last.x, y - last.y) < 7)) return;

    drops.push({ x, y, time });
    if (!frame) frame = requestAnimationFrame(draw);
  };
  return { add, stop };
}

let ripple;
document.addEventListener('pointermove', (event) => {
  if (event.pointerType !== 'mouse' || !pointerMotion.matches || document.documentElement.classList.contains('is-scrolling')) return;
  if (event.target.closest(excludedCards)) {
    ripple?.stop();
    return;
  }
  ripple ??= setupRipples();
  ripple.add(event);
}, { passive: true });
