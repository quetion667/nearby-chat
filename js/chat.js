// The demo conversation. Ten messages, held in a variable, gone on reload.
//
// Deliberately storage-free: the session token lives in the closure below and
// nowhere else. Not localStorage, not sessionStorage, not a cookie — the page
// promises that reloading erases the conversation, and the only way to keep
// that promise is to have nowhere to reload it from.
//
// The counter here is advisory. The server enforces the real ceiling and is
// what decides the conversation is over; this only keeps the UI honest.

import { CHAT, CONFIG } from './copy.js';

const api = (path) => `${CONFIG.apiBase.replace(/\/$/, '')}/api/web${path}`;

export function createChat(el, { onOpen, onClose } = {}) {
  let token = null;
  let remaining = CONFIG.sessionMessages;
  let closed = false;
  let busy = false;
  let greeted = false;

  function bubble(text, who) {
    const line = document.createElement('p');
    line.className = `chat__msg chat__msg--${who}`;
    line.textContent = text;
    el.log.appendChild(line);
    el.log.scrollTop = el.log.scrollHeight;
    return line;
  }

  function note(text) {
    const line = bubble(text, 'note');
    return line;
  }

  function paintRemaining() {
    if (closed) { el.remaining.textContent = ''; return; }
    el.remaining.textContent = remaining === 1
      ? CHAT.lastOne
      : CHAT.remaining.replace('{n}', String(remaining));
  }

  function lock(state) {
    busy = state;
    el.input.disabled = state || closed;
    el.send.disabled = state || closed;
    if (!state && !closed) el.input.focus();
  }

  function finish(message) {
    closed = true;
    note(message);
    el.input.disabled = true;
    el.send.disabled = true;
    paintRemaining();
  }

  async function ensureSession(promises) {
    if (token) return true;
    try {
      const response = await fetch(api('/session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promises: promises || [] }),
      });
      if (response.status === 429) { finish(CHAT.busy); return false; }
      if (!response.ok) { finish(CHAT.offline); return false; }
      const data = await response.json();
      token = data.token;
      remaining = data.remaining;
      paintRemaining();
      return true;
    } catch (err) {
      finish(CHAT.offline);
      return false;
    }
  }

  async function send(text) {
    if (busy || closed || !text.trim()) return;
    bubble(text, 'you');
    el.input.value = '';
    lock(true);

    const pending = bubble('…', 'them');
    try {
      const response = await fetch(api('/message'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, text }),
      });
      pending.remove();
      if (response.status === 410) { finish(CHAT.expired); return; }
      if (response.status === 429) { finish(CHAT.busy); return; }
      if (!response.ok) { lock(false); note(CHAT.offline); return; }

      const data = await response.json();
      data.bubbles.forEach((line) => bubble(line, 'them'));
      remaining = data.remaining;
      paintRemaining();
      if (data.closed) { finish(CHAT.closed); return; }
      lock(false);
    } catch (err) {
      pending.remove();
      lock(false);
      note(CHAT.offline);
    }
  }

  async function open(promises) {
    el.root.hidden = false;
    document.body.classList.add('is-chatting');
    if (onOpen) onOpen();
    if (!greeted) {
      greeted = true;
      note(CHAT.opening);
    }
    const ready = await ensureSession(promises);
    if (ready) lock(false);
  }

  function close() {
    el.root.hidden = true;
    document.body.classList.remove('is-chatting');
    if (onClose) onClose();
  }

  el.form.addEventListener('submit', (event) => {
    event.preventDefault();
    send(el.input.value);
  });
  el.close.addEventListener('click', close);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !el.root.hidden) close();
  });

  el.title.textContent = CHAT.title;
  el.note.textContent = CHAT.note;
  el.send.textContent = CHAT.send;
  el.close.textContent = CHAT.close;
  el.input.placeholder = CHAT.placeholder;
  paintRemaining();

  return { open, close };
}
