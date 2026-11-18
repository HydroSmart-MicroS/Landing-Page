// SpotlightCard, Magnet and TiltedCard adapted from React Bits for HydroSmart's static landing.
// Copyright (c) 2026 David Haz. Source revision and license are in reactbits.LICENSE.txt.
const pointerMotion = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
const magnets = [...document.querySelectorAll('[data-rb-magnet]')];
let spotlight;
let tiltedCard;
let pointer;
let frame = 0;

function clearCard(card) {
  if (!card) return;
  card.classList.remove('is-rb-active');
  for (const property of ['--rb-x', '--rb-y', '--rb-rotate-x', '--rb-rotate-y']) {
    card.style.removeProperty(property);
  }
}

function reset() {
  cancelAnimationFrame(frame);
  frame = 0;
  pointer = undefined;
  clearCard(spotlight);
  clearCard(tiltedCard);
  spotlight = undefined;
  tiltedCard = undefined;
  for (const magnet of magnets) {
    magnet.classList.remove('is-rb-active');
    magnet.style.removeProperty('--rb-magnet-x');
    magnet.style.removeProperty('--rb-magnet-y');
  }
}

function paint() {
  frame = 0;
  if (!pointer || !pointerMotion.matches) return;

  const nextSpotlight = pointer.target.closest('[data-rb-spotlight]');
  if (spotlight !== nextSpotlight) clearCard(spotlight);
  spotlight = nextSpotlight;
  if (spotlight) {
    const rect = spotlight.getBoundingClientRect();
    spotlight.style.setProperty('--rb-x', `${pointer.x - rect.left}px`);
    spotlight.style.setProperty('--rb-y', `${pointer.y - rect.top}px`);
    spotlight.classList.add('is-rb-active');
  }

  const nextTilt = pointer.target.closest('[data-rb-tilt]');
  if (tiltedCard !== nextTilt) clearCard(tiltedCard);
  tiltedCard = nextTilt;
  if (tiltedCard) {
    const rect = tiltedCard.getBoundingClientRect();
    const x = Math.min(1, Math.max(-1, (pointer.x - rect.left - rect.width / 2) / (rect.width / 2)));
    const y = Math.min(1, Math.max(-1, (pointer.y - rect.top - rect.height / 2) / (rect.height / 2)));
    tiltedCard.style.setProperty('--rb-rotate-x', `${-y * 6}deg`);
    tiltedCard.style.setProperty('--rb-rotate-y', `${x * 6}deg`);
    tiltedCard.style.setProperty('--rb-x', `${pointer.x - rect.left}px`);
    tiltedCard.style.setProperty('--rb-y', `${pointer.y - rect.top}px`);
    tiltedCard.classList.add('is-rb-active');
  }

  for (const magnet of magnets) {
    const rect = magnet.getBoundingClientRect();
    const dx = pointer.x - rect.left - rect.width / 2;
    const dy = pointer.y - rect.top - rect.height / 2;
    const outside = Math.hypot(Math.max(0, Math.abs(dx) - rect.width / 2), Math.max(0, Math.abs(dy) - rect.height / 2));
    const influence = Math.max(0, 1 - outside / 36);
    magnet.classList.toggle('is-rb-active', influence > 0);
    magnet.style.setProperty('--rb-magnet-x', `${Math.max(-8, Math.min(8, dx / 6)) * influence}px`);
    magnet.style.setProperty('--rb-magnet-y', `${Math.max(-6, Math.min(6, dy / 6)) * influence}px`);
  }
}

document.addEventListener('pointermove', event => {
  if (event.pointerType !== 'mouse' || !pointerMotion.matches) return;
  pointer = { x: event.clientX, y: event.clientY, target: event.target };
  if (!frame) frame = requestAnimationFrame(paint);
}, { passive: true });
document.documentElement.addEventListener('pointerleave', reset);
window.addEventListener('blur', reset);
window.addEventListener('scroll', reset, { passive: true });
document.addEventListener('keydown', event => {
  if (event.key === 'Tab') reset();
});
pointerMotion.addEventListener('change', reset);
