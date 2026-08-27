// Fallback backend for machines without WebGL2. Same state in, a simpler
// creature out: a morphing gradient blob driven by CSS custom properties.

function toCss(color) {
  // Linear back to sRGB, then to an integer triplet.
  const channel = (v) => Math.round(Math.min(1, Math.max(0, v)) ** (1 / 2.2) * 255);
  return `${channel(color[0])}, ${channel(color[1])}, ${channel(color[2])}`;
}

export function createCssEntity(host) {
  const root = document.createElement('div');
  root.className = 'css-entity';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = '<div class="css-entity__blob"></div><div class="css-entity__ring"></div>';
  host.appendChild(root);

  const blob = root.querySelector('.css-entity__blob');
  const ring = root.querySelector('.css-entity__ring');
  let size = 1;

  function resize(width, height) {
    size = Math.min(width, height);
    root.style.setProperty('--unit', `${size}px`);
  }

  function render(state) {
    const wobble = Math.sin(state.time * 0.9) * 0.5 + 0.5;
    const breath = 1 + (Math.sin(state.time * 0.9) * 0.03 + Math.sin(state.time * 1.37) * 0.02) * (0.4 + 0.6 * state.wake);

    root.style.setProperty('--col-a', toCss(state.colA));
    root.style.setProperty('--col-b', toCss(state.colB));
    root.style.setProperty('--col-c', toCss(state.colC));
    root.style.setProperty('--wake', state.wake.toFixed(3));
    root.style.setProperty('--charge', state.charge.toFixed(3));

    blob.style.transform = [
      `translate(${state.centerX * size * 0.25}px, ${state.centerY * size * -0.25}px)`,
      `scale(${(state.scale * breath).toFixed(4)})`,
      `rotate(${(state.time * 6 + wobble * 12).toFixed(2)}deg)`,
    ].join(' ');
    blob.style.borderRadius = [
      `${42 + wobble * 14}% ${58 - wobble * 14}% ${64 - wobble * 10}% ${36 + wobble * 10}%`,
      `/`,
      `${44 + wobble * 10}% ${52 - wobble * 8}% ${48 + wobble * 8}% ${56 - wobble * 10}%`,
    ].join(' ');
    blob.style.filter = `blur(${(14 - 6 * state.wake).toFixed(1)}px) saturate(${(0.9 + 0.5 * state.wake).toFixed(2)})`;
    blob.style.opacity = (0.35 + 0.65 * state.wake).toFixed(3);

    const pulseVisible = state.pulseAmp > 0.001 && state.pulseT < 1;
    ring.style.opacity = pulseVisible ? ((1 - state.pulseT) * state.pulseAmp).toFixed(3) : '0';
    ring.style.transform = `scale(${(state.scale * (1 + state.pulseT * 1.1)).toFixed(3)})`;
    return true;
  }

  return { kind: 'css', resize, render };
}
