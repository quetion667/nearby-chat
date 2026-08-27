// WebGL2 backend for the entity. Owns the canvas, the program and the
// adaptive resolution scale. It renders state; it never decides state.

import { VERT_SRC, FRAG_SRC } from './shaders.js';

const UNIFORM_NAMES = [
  'uRes', 'uTime', 'uPointer', 'uPointerAmt', 'uCenter', 'uScale',
  'uWake', 'uCharge', 'uPulseT', 'uPulseAmp', 'uDroop', 'uCalm',
  'uColA', 'uColB', 'uColC', 'uSeed',
];

const QUALITY_STEPS = [1.0, 0.8, 0.65, 0.5, 0.4];

function compile(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`shader compile failed: ${log}`);
  }
  return shader;
}

export function createGlEntity(canvas) {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
  });
  if (!gl) return null;

  let program;
  try {
    const vs = compile(gl, gl.VERTEX_SHADER, VERT_SRC);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
    program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`program link failed: ${gl.getProgramInfoLog(program)}`);
    }
  } catch (err) {
    console.warn('[entity] falling back to CSS backend:', err.message);
    return null;
  }

  const vao = gl.createVertexArray();
  const loc = {};
  for (const name of UNIFORM_NAMES) loc[name] = gl.getUniformLocation(program, name);

  gl.useProgram(program);
  gl.bindVertexArray(vao);

  let qualityIndex = 0;
  let cssWidth = 1;
  let cssHeight = 1;
  let lost = false;
  const frameTimes = [];

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    lost = true;
  });

  // Raymarching is priced per pixel, so the budget is a pixel count rather
  // than a device ratio. Above the budget, start lower instead of stuttering.
  // Phones get a smaller one: a mid-range mobile GPU is not a desktop one, and
  // a stuttering entity reads as a sick one.
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const PIXEL_BUDGET = coarsePointer ? 0.95e6 : 1.7e6;

  function applySize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const scale = QUALITY_STEPS[qualityIndex] * dpr;
    const width = Math.max(1, Math.round(cssWidth * scale));
    const height = Math.max(1, Math.round(cssHeight * scale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  function chooseInitialQuality() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    while (
      qualityIndex < QUALITY_STEPS.length - 1 &&
      cssWidth * cssHeight * (QUALITY_STEPS[qualityIndex] * dpr) ** 2 > PIXEL_BUDGET
    ) {
      qualityIndex += 1;
    }
  }

  let sized = false;

  function resize(width, height) {
    cssWidth = width;
    cssHeight = height;
    if (!sized) {
      chooseInitialQuality();
      sized = true;
    }
    applySize();
  }

  // If the machine cannot hold the frame budget, drop resolution rather than
  // frame rate. Slowness reads as lethargy, and lethargy is a lie about the character.
  function trackPerformance(dt) {
    frameTimes.push(dt);
    if (frameTimes.length < 45) return;
    const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    frameTimes.length = 0;
    if (avg > 0.024 && qualityIndex < QUALITY_STEPS.length - 1) {
      qualityIndex += 1;
      applySize();
    }
  }

  function render(state, dt) {
    if (lost) return false;
    applySize();
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);
    gl.bindVertexArray(vao);

    gl.uniform2f(loc.uRes, canvas.width, canvas.height);
    gl.uniform1f(loc.uTime, state.time);
    gl.uniform2f(loc.uPointer, state.pointerX, state.pointerY);
    gl.uniform1f(loc.uPointerAmt, state.pointerAmount);
    gl.uniform2f(loc.uCenter, state.centerX, state.centerY);
    gl.uniform1f(loc.uScale, state.scale);
    gl.uniform1f(loc.uWake, state.wake);
    gl.uniform1f(loc.uCharge, state.charge);
    gl.uniform1f(loc.uPulseT, state.pulseT);
    gl.uniform1f(loc.uPulseAmp, state.pulseAmp);
    gl.uniform1f(loc.uDroop, state.droop);
    gl.uniform1f(loc.uCalm, state.calm);
    gl.uniform3f(loc.uColA, state.colA[0], state.colA[1], state.colA[2]);
    gl.uniform3f(loc.uColB, state.colB[0], state.colB[1], state.colB[2]);
    gl.uniform3f(loc.uColC, state.colC[0], state.colC[1], state.colC[2]);
    gl.uniform1f(loc.uSeed, state.seed);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    trackPerformance(dt);
    return true;
  }

  return { kind: 'webgl', resize, render };
}
