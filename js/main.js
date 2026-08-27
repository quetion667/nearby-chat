// The page is one small state machine wrapped around one living thing.
// Stages: dormant -> noticed -> charging -> asking -> settling -> awake.

import { createGlEntity } from './entity-gl.js';
import { createCssEntity } from './entity-css.js';
import { CONFIG, LINES, QUESTIONS, POKES, SECTIONS, FOOTER } from './copy.js';
import { createChat } from './chat.js';

const Stage = {
  DORMANT: 'dormant',
  NOTICED: 'noticed',
  CHARGING: 'charging',
  ASKING: 'asking',
  SETTLING: 'settling',
  AWAKE: 'awake',
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;
// Frame-rate independent smoothing: k is roughly "how eager", dt in seconds.
const approach = (current, target, k, dt) => current + (target - current) * (1 - Math.exp(-k * dt));

function hexToLinear(hex) {
  const int = parseInt(hex.slice(1), 16);
  const srgb = [(int >> 16) & 255, (int >> 8) & 255, int & 255].map((c) => c / 255);
  return srgb.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
}

const BASE_PALETTE = {
  a: hexToLinear('#463358'),
  b: hexToLinear('#C2AEF2'),
  c: hexToLinear('#FF8A4A'),
};

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

// ---------------------------------------------------------------- state ---

const S = {
  time: 0,
  pointerX: 0,
  pointerY: 0,
  pointerAmount: 0,
  centerX: 0,
  centerY: 0,
  scale: 0.2,
  wake: 0,
  charge: 0,
  pulseT: 1,
  pulseAmp: 0,
  droop: 0,
  calm: 0,
  colA: BASE_PALETTE.a.slice(),
  colB: BASE_PALETTE.b.slice(),
  colC: BASE_PALETTE.c.slice(),
  seed: Math.random() * 20,
};

const T = {
  centerX: 0,
  centerY: 0.12,
  scale: 0.9,
  wake: 0.06,
  calm: 0,
  colA: BASE_PALETTE.a.slice(),
  colB: BASE_PALETTE.b.slice(),
  colC: BASE_PALETTE.c.slice(),
};

const game = {
  stage: Stage.DORMANT,
  questionIndex: 0,
  choices: [],
  preview: null,
  holding: false,
  holdStarted: 0,
  pointerTravel: 0,
  lastPointerMove: -10,
  lastPointerScreen: null,
  scrollProgress: 0,
  timers: [],
};

// -------------------------------------------------------------- elements ---

const el = {
  canvas: document.getElementById('stage'),
  fallbackHost: document.getElementById('fallback-host'),
  ring: document.getElementById('ring'),
  ringArc: document.getElementById('ring-arc'),
  voice: document.getElementById('voice'),
  hint: document.getElementById('hint'),
  choices: document.getElementById('choices'),
  question: document.getElementById('question'),
  step: document.getElementById('step'),
  promises: document.getElementById('promises'),
  cta: document.getElementById('cta'),
  ctaLinks: document.querySelectorAll('button.cta'),
  ctaNote: document.getElementById('cta-note'),
  again: document.getElementById('again'),
  skip: document.getElementById('skip'),
  hero: document.getElementById('hero-ui'),
  scrollCue: document.getElementById('scroll-cue'),
  sections: document.getElementById('sections'),
  footerNote: document.getElementById('footer-note'),
  footerMeaning: document.getElementById('footer-meaning'),
  chat: {
    root: document.getElementById('chat'),
    log: document.getElementById('chat-log'),
    form: document.getElementById('chat-form'),
    input: document.getElementById('chat-input'),
    send: document.getElementById('chat-send'),
    close: document.getElementById('chat-close'),
    title: document.getElementById('chat-title'),
    remaining: document.getElementById('chat-remaining'),
    note: document.getElementById('chat-note'),
  },
};

// One conversation per page load, by construction: the token lives inside this
// closure, so a reload cannot resume anything.
const chat = createChat(el.chat);

function openChat() {
  // The three answers are the opening condition: the companion should begin as
  // the thing it just promised to be. A visitor who skipped the game sends none.
  chat.open(game.choices.map((choice) => choice.promise));
}

// --------------------------------------------------------------- backend ---

let backend = createGlEntity(el.canvas);
if (!backend) {
  el.canvas.classList.add('is-hidden');
  document.body.classList.add('no-webgl');
  backend = createCssEntity(el.fallbackHost);
}

function layout() {
  // Measure the element, do not command it. CSS already stretched it across
  // the viewport; this only matches the drawing buffer to what it became.
  const w = el.canvas.clientWidth || window.innerWidth;
  const h = el.canvas.clientHeight || window.innerHeight;
  backend.resize(w, h);
  updateSpatialTargets();
}

// Where the entity sits and how big it reads, given the viewport and scroll.
function updateSpatialTargets() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspect = w / h;
  const portrait = aspect < 1.05;

  let base = aspect < 0.8 ? 0.66 : aspect < 1.2 ? 0.76 : 0.86;

  // Once it starts talking, it lifts and draws back to leave the words room.
  const talking = game.stage === Stage.ASKING
    || game.stage === Stage.SETTLING
    || game.stage === Stage.AWAKE;

  // Take the deeper reduction rather than multiplying them: a short landscape
  // window would otherwise shrink the entity to a speck behind the text.
  base *= Math.min(h < 620 ? 0.82 : 1, talking ? 0.8 : 1);

  const p = game.scrollProgress;
  const lean = talking ? 0.09 : 0.12;
  const restY = talking ? 0.34 : 0.12;

  T.scale = lerp(base, base * (portrait ? 0.5 : 0.66), p);
  T.centerX = lerp(S.pointerX * lean * S.pointerAmount, portrait ? 0 : -1.25, p);
  T.centerY = lerp(restY + S.pointerY * lean * 0.6 * S.pointerAmount, portrait ? 1.35 : 0.42, p);
}

function project() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const half = h / 2;
  return {
    x: w / 2 + S.centerX * S.scale * half,
    y: h / 2 - S.centerY * S.scale * half,
    r: 0.59 * S.scale * half,
  };
}

// ------------------------------------------------------------- narration ---

function say(text, { hint = null } = {}) {
  if (el.voice.textContent !== text || !el.voice.classList.contains('is-in')) {
    el.voice.classList.remove('is-in');
    // Force reflow so the fade restarts even when the class was just removed.
    void el.voice.offsetWidth;
    el.voice.textContent = text;
    el.voice.classList.add('is-in');
  }
  setHint(hint);
}

function setHint(text) {
  el.hint.textContent = text || '';
  el.hint.classList.toggle('is-in', Boolean(text));
}

function setStep(text) {
  el.step.textContent = text || '';
  el.step.classList.toggle('is-in', Boolean(text));
}

function after(seconds, fn) {
  const id = window.setTimeout(() => {
    game.timers = game.timers.filter((t) => t !== id);
    fn();
  }, seconds * 1000);
  game.timers.push(id);
  return id;
}

function clearTimers() {
  game.timers.forEach((id) => window.clearTimeout(id));
  game.timers = [];
}

function pulse(amp) {
  S.pulseAmp = prefersReducedMotion ? amp * 0.4 : amp;
  S.pulseT = 0;
}

// --------------------------------------------------------------- palette ---

function paletteFor(choices, preview) {
  const entries = [{ palette: BASE_PALETTE, weight: 1 }];
  choices.forEach((choice) => entries.push({ palette: choice.linear, weight: 1.7 }));
  if (preview) entries.push({ palette: preview.linear, weight: 2.2 });

  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  const mix = (key) => [0, 1, 2].map((i) =>
    entries.reduce((sum, e) => sum + e.palette[key][i] * e.weight, 0) / total);

  return { a: mix('a'), b: mix('b'), c: mix('c') };
}

function applyPalette() {
  const next = paletteFor(game.choices, game.preview);
  T.colA = next.a;
  T.colB = next.b;
  T.colC = next.c;

  const presence = game.choices.reduce((sum, c) => sum + c.presence, 0)
    + (game.preview ? game.preview.presence * 0.5 : 0);
  if (game.stage === Stage.AWAKE || game.stage === Stage.SETTLING) {
    T.wake = clamp(0.82 + presence * 0.12, 0.6, 1);
  }
}

// Precompute linear colours once.
QUESTIONS.forEach((q) => q.options.forEach((o) => {
  o.linear = {
    a: hexToLinear(o.palette.a),
    b: hexToLinear(o.palette.b),
    c: hexToLinear(o.palette.c),
  };
}));

// ----------------------------------------------------------------- stages ---

const holdHint = () => (isCoarsePointer ? LINES.noticedHintTouch : LINES.noticedHint);

function toDormant() {
  game.stage = Stage.DORMANT;
  T.wake = 0.06;
  T.calm = 0;
  setStep('');
  say(LINES.dormantFirst);
  // The instruction arrives almost at once. Making someone hunt for the verb
  // is a puzzle, and this is meant to be a greeting.
  after(0.9, () => {
    if (game.stage === Stage.DORMANT) {
      setHint(isCoarsePointer ? LINES.dormantHintTouch : LINES.dormantHint);
    }
  });
  after(7, () => {
    if (game.stage === Stage.DORMANT) setHint(LINES.dormantNudge);
  });
}

function toNoticed(withPulse = true) {
  if (game.stage !== Stage.DORMANT && game.stage !== Stage.CHARGING) return;
  clearTimers();
  game.stage = Stage.NOTICED;
  T.wake = 0.34;
  if (withPulse) pulse(0.35);
  say(LINES.noticed, { hint: holdHint() });
}

function beginHold() {
  if (game.stage === Stage.DORMANT) toNoticed(true);
  if (game.stage !== Stage.NOTICED && game.stage !== Stage.CHARGING) return;
  game.holding = true;
  game.holdStarted = S.time;
  game.stage = Stage.CHARGING;
  T.wake = 0.55;
  el.ring.classList.add('is-live');
  after(0.4, () => {
    if (game.stage === Stage.CHARGING && game.holding) say(LINES.charging);
  });
}

// A finger that drifts is scrolling, not failing to hold. Let go without the
// sulk: the entity was never rejected.
function abandonHold() {
  if (!game.holding) return;
  game.holding = false;
  el.ring.classList.remove('is-live');
  if (game.stage === Stage.CHARGING) {
    game.stage = Stage.NOTICED;
    T.wake = 0.3;
    setHint(holdHint());
  }
}

function endHold() {
  if (!game.holding) return;
  game.holding = false;
  el.ring.classList.remove('is-live');
  if (game.stage !== Stage.CHARGING) return;

  if (S.charge >= 0.995) return; // completion is handled in the loop
  clearTimers();
  game.stage = Stage.NOTICED;
  T.wake = 0.26;
  S.droop = Math.min(1, S.droop + 0.55);
  say(LINES.tooSoon, { hint: holdHint() });
}

function completeCharge() {
  game.holding = false;
  el.ring.classList.remove('is-live');
  clearTimers();
  game.stage = Stage.SETTLING;
  T.wake = 0.85;
  T.calm = 0.5;
  pulse(1.0);
  say(LINES.awoken);
  after(1.0, askNext);
}

function askNext() {
  const question = QUESTIONS[game.questionIndex];
  if (!question) return toSettled();

  game.stage = Stage.ASKING;
  setStep(`${game.questionIndex + 1} / ${QUESTIONS.length}`);
  // Only the first question needs the reassurance; after that it is obvious.
  setHint(game.questionIndex === 0 ? LINES.askHint : '');
  el.question.textContent = question.ask;
  el.question.classList.add('is-in');
  el.voice.classList.remove('is-in');

  el.choices.innerHTML = '';
  question.options.forEach((option, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice';
    button.textContent = option.label;
    button.style.setProperty('--delay', `${index * 90}ms`);
    button.addEventListener('pointerenter', () => {
      game.preview = option;
      applyPalette();
    });
    button.addEventListener('pointerleave', () => {
      game.preview = null;
      applyPalette();
    });
    button.addEventListener('focus', () => {
      game.preview = option;
      applyPalette();
    });
    button.addEventListener('blur', () => {
      game.preview = null;
      applyPalette();
    });
    button.addEventListener('click', () => choose(option));
    el.choices.appendChild(button);
  });
  el.choices.classList.add('is-in');
}

function choose(option) {
  if (game.stage !== Stage.ASKING) return;
  game.stage = Stage.SETTLING;
  game.choices.push(option);
  game.preview = null;
  game.questionIndex += 1;
  applyPalette();
  pulse(0.6);

  el.choices.classList.remove('is-in');
  el.question.classList.remove('is-in');
  say(option.reply);

  after(0.85, () => {
    if (game.questionIndex < QUESTIONS.length) {
      askNext();
    } else {
      toSettled();
    }
  });
}

function toSettled() {
  game.stage = Stage.SETTLING;
  T.wake = 1;
  T.calm = 1;
  pulse(0.9);
  setStep('');
  say(LINES.settling);
  after(0.9, toAwake);
}

function toAwake() {
  game.stage = Stage.AWAKE;
  T.calm = 1;
  setStep('');
  applyPalette();
  el.voice.classList.remove('is-in');
  el.question.classList.remove('is-in');

  el.promises.innerHTML = '';
  game.choices.forEach((choice, index) => {
    const line = document.createElement('p');
    line.className = 'promise';
    line.textContent = choice.promise;
    line.style.setProperty('--delay', `${index * 180}ms`);
    el.promises.appendChild(line);
  });

  el.promises.classList.add('is-in');
  el.cta.classList.add('is-in');
  el.scrollCue.classList.add('is-in');
  el.skip.classList.add('is-hidden');
  el.again.classList.remove('is-hidden');
  document.body.classList.add('is-awake');

}

function skipToChat() {
  skipToAwake();
  openChat();
}

function skipToAwake() {
  if (game.stage === Stage.AWAKE) return;
  clearTimers();
  game.choices = QUESTIONS.map((q) => q.options[1]);
  game.questionIndex = QUESTIONS.length;
  game.preview = null;
  applyPalette();
  T.wake = 1;
  pulse(0.7);
  toAwake();
}

function restart() {
  clearTimers();
  game.stage = Stage.DORMANT;
  game.questionIndex = 0;
  game.choices = [];
  game.preview = null;
  game.pointerTravel = 0;
  S.charge = 0;
  applyPalette();

  el.promises.classList.remove('is-in');
  el.cta.classList.remove('is-in');
  el.scrollCue.classList.remove('is-in');
  el.again.classList.add('is-hidden');
  el.skip.classList.remove('is-hidden');
  document.body.classList.remove('is-awake');
  window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  toDormant();
}

function poke() {
  pulse(0.45);
  say(POKES[Math.floor(Math.random() * POKES.length)]);
  after(2.4, () => {
    if (game.stage === Stage.AWAKE) el.voice.classList.remove('is-in');
  });
}

// ------------------------------------------------------------------ input ---

function pointerToUv(clientX, clientY) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return {
    x: (clientX * 2 - w) / h,
    y: ((h - clientY) * 2 - h) / h,
  };
}

window.addEventListener('pointermove', (event) => {
  const uv = pointerToUv(event.clientX, event.clientY);
  S.pointerX = uv.x;
  S.pointerY = uv.y;
  game.lastPointerMove = S.time;

  if (game.lastPointerScreen) {
    game.pointerTravel += Math.hypot(
      event.clientX - game.lastPointerScreen.x,
      event.clientY - game.lastPointerScreen.y,
    );
  }
  game.lastPointerScreen = { x: event.clientX, y: event.clientY };

  if (game.holding && isCoarsePointer && game.holdOrigin) {
    const drift = Math.hypot(
      event.clientX - game.holdOrigin.x,
      event.clientY - game.holdOrigin.y,
    );
    if (drift > 12) abandonHold();
  }

  if (game.stage === Stage.DORMANT && game.pointerTravel > 90) toNoticed(true);
}, { passive: true });

function isInteractive(target) {
  return Boolean(target instanceof Element && target.closest('button, a, [data-no-hold]'));
}

window.addEventListener('pointerdown', (event) => {
  if (isInteractive(event.target)) return;

  const hit = project();
  const onEntity = Math.hypot(event.clientX - hit.x, event.clientY - hit.y) < hit.r * 1.1;

  if (game.stage === Stage.AWAKE) {
    if (onEntity) poke();
    return;
  }
  if (game.stage === Stage.ASKING || game.stage === Stage.SETTLING) return;

  const uv = pointerToUv(event.clientX, event.clientY);
  S.pointerX = uv.x;
  S.pointerY = uv.y;
  game.lastPointerMove = S.time;
  game.holdOrigin = { x: event.clientX, y: event.clientY };
  beginHold();
});

// The hold lasts about as long as a mobile browser's long-press gesture, so
// the callout menu has to be refused — but only over the hero, never over the
// text below, which should stay selectable.
window.addEventListener('contextmenu', (event) => {
  const target = event.target;
  if (isInteractive(target)) return;
  if (target instanceof Element && target.closest('.page')) return;
  event.preventDefault();
});

window.addEventListener('pointerup', endHold);
window.addEventListener('pointercancel', endHold);
window.addEventListener('blur', endHold);

window.addEventListener('keydown', (event) => {
  if (event.code !== 'Space' || event.repeat) return;
  if (isInteractive(document.activeElement)) return;
  if (game.scrollProgress > 0.3) return; // below the hero, space belongs to the page
  event.preventDefault();
  if (game.stage === Stage.AWAKE) {
    poke();
    return;
  }
  beginHold();
});

window.addEventListener('keyup', (event) => {
  if (event.code === 'Space') endHold();
});

window.addEventListener('scroll', () => {
  const span = Math.max(1, window.innerHeight * 0.85);
  game.scrollProgress = clamp(window.scrollY / span, 0, 1);
  el.hero.style.opacity = String(clamp(1 - game.scrollProgress * 1.35, 0, 1));
  el.hero.style.pointerEvents = game.scrollProgress > 0.5 ? 'none' : '';
}, { passive: true });

// A mobile address bar collapsing fires resize repeatedly. Rebuilding the
// drawing buffer on every one of those frames is worse than being a beat late.
let resizeTimer = null;
function scheduleLayout() {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(layout, 180);
}

window.addEventListener('resize', scheduleLayout);
window.addEventListener('orientationchange', scheduleLayout);

el.skip.addEventListener('click', skipToChat);
el.again.addEventListener('click', restart);

// ------------------------------------------------------------ static copy ---

function buildPage() {
  el.ctaLinks.forEach((button) => {
    button.addEventListener('click', openChat);
  });
  el.cta.querySelector('.cta__label').textContent = LINES.ctaLabel;
  el.ctaNote.textContent = LINES.ctaNote;
  el.again.textContent = LINES.again;
  el.skip.textContent = LINES.skip;
  el.scrollCue.querySelector('span').textContent = LINES.scrollCue;
  el.footerNote.textContent = FOOTER.note;
  el.footerMeaning.textContent = FOOTER.meaning;

  const fragment = document.createDocumentFragment();
  SECTIONS.forEach((section) => {
    const node = document.createElement('section');
    node.className = 'section';
    node.id = section.id;

    const kicker = document.createElement('p');
    kicker.className = 'section__kicker';
    kicker.textContent = section.kicker;

    const title = document.createElement('h2');
    title.className = 'section__title';
    title.textContent = section.title;

    node.append(kicker, title);
    section.body.forEach((paragraph) => {
      const p = document.createElement('p');
      p.className = 'section__body';
      p.textContent = paragraph;
      node.appendChild(p);
    });
    fragment.appendChild(node);
  });
  el.sections.appendChild(fragment);

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.25 });
  el.sections.querySelectorAll('.section').forEach((node) => observer.observe(node));

  // The sections are built here, so a deep link has to be honoured by hand.
  if (window.location.hash.length > 1) {
    try {
      document.querySelector(window.location.hash)?.scrollIntoView();
    } catch (err) {
      // A hash that is not a valid selector is not an error worth reporting.
    }
  }
}

// ------------------------------------------------------------------- loop ---

const RING_BOX = 400;
let lastFrame = performance.now();

function frame(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  S.time += dt;

  if (game.holding) {
    S.charge = clamp(S.charge + dt / CONFIG.holdSeconds, 0, 1);
    if (S.charge >= 1) completeCharge();
  } else if (game.stage !== Stage.CHARGING) {
    S.charge = approach(S.charge, 0, 6, dt);
  }

  const idle = S.time - game.lastPointerMove;
  const pointerTarget = idle < 1.6 ? 1 : 0;
  S.pointerAmount = approach(S.pointerAmount, pointerTarget, 2.2, dt);

  const droopTarget = clamp((idle - 3.5) / 6, 0, 1) * (1 - S.charge);
  S.droop = approach(S.droop, droopTarget, 0.8, dt);

  updateSpatialTargets();
  S.centerX = approach(S.centerX, T.centerX, 3.2, dt);
  S.centerY = approach(S.centerY, T.centerY, 3.2, dt);
  S.scale = approach(S.scale, T.scale, 2.6, dt);
  S.wake = approach(S.wake, T.wake, 2.0, dt);
  S.calm = approach(S.calm, T.calm, 1.2, dt);
  for (let i = 0; i < 3; i++) {
    S.colA[i] = approach(S.colA[i], T.colA[i], 3.0, dt);
    S.colB[i] = approach(S.colB[i], T.colB[i], 3.0, dt);
    S.colC[i] = approach(S.colC[i], T.colC[i], 3.0, dt);
  }

  if (S.pulseT < 1) S.pulseT = clamp(S.pulseT + dt / 1.3, 0, 1);

  // The ring is a fixed 400px box moved and scaled: no per-frame layout work.
  const hit = project();
  const ringScale = (hit.r * 2.34) / RING_BOX;
  el.ring.style.transform =
    `translate(${hit.x - RING_BOX / 2}px, ${hit.y - RING_BOX / 2}px) scale(${ringScale.toFixed(4)})`;
  el.ringArc.style.strokeDashoffset = String(1 - S.charge);

  // Before the hold, the ring breathes faintly: a target to aim at, so the
  // instruction has something to point to.
  const inviting = game.stage === Stage.DORMANT
    || game.stage === Stage.NOTICED
    || game.stage === Stage.CHARGING;
  const floor = inviting ? 0.34 + 0.12 * Math.sin(S.time * 1.7) : 0;
  el.ring.style.opacity = String(clamp(Math.max(S.charge * 1.6, floor), 0, 1));

  backend.render(S, dt);
  window.requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ start ---

buildPage();
layout();
toDormant();
window.requestAnimationFrame(frame);

// Dev shortcuts for screenshots and demos: ?stage=ask, ?stage=awake.
const requestedStage = new URLSearchParams(window.location.search).get('stage');
if (requestedStage === 'awake') {
  skipToAwake();
} else if (requestedStage === 'ask') {
  T.wake = 0.9;
  T.calm = 0.6;
  S.wake = 0.9;
  askNext();
}
