# Nearby — landing page

A one-page, dependency-free presentation site. The centre of the screen is a
living entity you interact with: it sleeps, notices you, wakes when you hold it,
asks three short questions, and then tells you how it intends to treat you.
That is the whole game — about thirty seconds — and the call to action only
appears once it is awake.

Everything is hand-written: no framework, no bundler, no npm, no CDN except the
two web fonts. The entity is a raymarched, noise-displaced sphere drawn by a
single fullscreen fragment shader in WebGL2.

## Run it

```powershell
python web\serve.py
```

Then open <http://localhost:8000/>. Any static server works, but this one forces
`text/javascript` for `.js`, which Windows sometimes reports as `text/plain` —
and a wrong MIME type silently breaks ES modules.

## The interaction

| Stage | What happens |
| --- | --- |
| dormant | A dim, sagging shape. It droops further the longer you ignore it. |
| noticed | Move the cursor and it brightens and leans towards you. |
| charging | Press and hold anywhere (or Space). A ring fills over 1.5 s. Let go early and it settles back and says so. |
| asking | Three either/or questions. Hovering an answer previews the entity it would become; choosing it commits the colour. |
| awake | It repeats your three choices back as promises, and the button that opens the chat appears. Click the body to poke it. |
| chatting | A panel over the page. Ten messages, then it closes. The entity stays alive behind it. |

`skip` in the top right goes straight to the chat, past the questions entirely.
`Wake it again` restarts the whole thing.

For demos and screenshots, `?stage=ask` opens on the first question and
`?stage=awake` opens on the finished state.

## Files

| File | Owns |
| --- | --- |
| `index.html` | Structure only. All text is injected from `js/copy.js`. |
| `styles.css` | Type, layout, the ring, the section reveals. |
| `js/copy.js` | **Every word on the page**, plus `CONFIG.apiBase`. Edit here. |
| `js/chat.js` | The demo conversation: session, ten messages, no storage. |
| `js/main.js` | The state machine, input, springs, the render loop. |
| `js/shaders.js` | GLSL for the entity. |
| `js/entity-gl.js` | WebGL2 backend and adaptive resolution. |
| `js/entity-css.js` | Fallback backend for machines without WebGL2. |
| `PROMPT.md` | A ready prompt for asking an LLM to build a variant of this. |

## The chat

The page talks to one endpoint, `POST /api/web/session` then
`POST /api/web/message`. Ten messages per session, enforced on the server; the
counter in the corner is advisory, because the client is assumed hostile.

**Nothing is stored.** The session token lives in a JavaScript variable and
nowhere else — not `localStorage`, not `sessionStorage`, not a cookie. Reloading
the page loses the token, and the conversation with it. That is the promise the
copy makes, and the only way to keep it is to have nowhere to reload it from.

The three answers from the opening game are sent once, when the session starts,
as the conversation's opening condition: the companion begins as the thing it
just promised to be. Skipping the game sends none, and that is a supported path.

## Before showing it to anyone

1. Set `CONFIG.apiBase` in `js/copy.js` to the API origin. It is empty until
   then, which means same-origin, which means nothing answers.
2. The API must allow this page's exact origin (`WEB_CHAT_ALLOWED_ORIGINS`) and
   have `WEB_CHAT_ENABLED=true`. Both default to off.
3. Re-read the copy in `js/copy.js`. The boundary and memory sections are
   written to match what this demo actually does; if that changes, change them.

## Notes on how it behaves

- **Performance.** The shader is priced per pixel, so the renderer picks a
  starting resolution from a pixel budget and drops one step at a time if
  frames run long. It degrades resolution rather than frame rate — a laggy
  entity reads as a lethargic one, which is a lie about the character.
- **No WebGL2.** The page swaps in a CSS blob driven by the same state. The
  game still works.
- **Touch.** The hold is a long press, so the page refuses the callout menu and
  text selection over the hero, keeps pull-to-refresh from firing mid-hold, and
  treats a finger that drifts more than 12px as scrolling rather than a failed
  hold — it lets go quietly instead of sulking. Phones also get a smaller pixel
  budget, and the canvas is sized in `dvh` so a collapsing address bar cannot
  leave a strip of flat background. Landscape phones get a compact layout.
- **Reduced motion.** `prefers-reduced-motion` softens the pulses and turns off
  section reveals, scroll smoothing, and the drifting scroll cue.
- **Keyboard.** Space holds and pokes; the answers are real buttons, so Tab and
  Enter work, and focusing an answer previews it exactly like hovering does.
- **Continuity.** There is none, on purpose. The visit counter that used to
  live in `localStorage` was removed: a page that greets you as a returning
  visitor while the conversation forgets you on reload is telling two
  different stories.
