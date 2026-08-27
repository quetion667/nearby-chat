# Prompt for building a variant of this page

Paste this into an LLM when you want another take on the same idea. It
describes the design, not the code, so the model has to solve it rather than
copy it. Replace the bracketed parts.

---

Build a single-page presentation site for **[product]**, a companion you talk
to in [channel]. The pitch is not "an AI assistant" — it is a presence with its
own temperament that happens to be made of language.

**Output format.** Plain `index.html`, `styles.css`, and ES modules under
`js/`. No framework, no bundler, no npm, no CDN libraries. Web fonts are the
only external request allowed. Write every comment in English.

**The centrepiece.** The middle of the screen holds one living entity, and it
is the only illustration on the page. Draw it in WebGL2 with a single
fullscreen fragment shader: a sphere SDF, displaced by 3D simplex noise,
raymarched with an analytic bounding-sphere test so most pixels cost nothing.
Shade it with a fresnel rim rather than a specular highlight. Add a soft halo
outside the body and film grain over the whole frame. Uniforms it needs:
time, pointer position, entity centre, scale, wake, charge, pulse, droop, calm,
two colours. Fall back to a CSS blob driven by the same state if WebGL2 is
missing.

**Make it feel alive, specifically:**

- Breathe on two slow sine rates that do not divide into each other, so the
  rhythm never audibly loops.
- Sag when ignored. The longer the pointer sits still, the more the lower half
  hangs — and it re-inflates the moment the pointer moves.
- Lean towards the pointer with inertia, never snapping to it.
- Smooth the surface as it concentrates, roughen it when it is asleep.
- Fire an expanding ring on every meaningful event.
- Drive all of that through targets and frame-rate-independent smoothing, not
  CSS transitions.

**The thirty-second game, gating the call to action:**

1. **Dormant.** One line: something here is asleep. After a beat, a hint to
   move the cursor.
2. **Noticed.** First real cursor movement wakes the line "it noticed you" and
   a hint to press and hold.
3. **Charge.** Press and hold anywhere for ~1.5 s while a thin ring fills
   around the body. Releasing early must *cost* something: it settles back, it
   says so, and it visibly sags. One refusal buys more personality than ten
   reactions.
4. **Three questions.** Each is an either/or about how it should treat the
   user — who speaks first, closer or quieter on a bad day, blunt or gentle
   truth. Hovering an answer previews the entity it would become by shifting
   its colours live; choosing commits.
5. **Awake.** It repeats the three choices back as promises, in its own voice,
   and only now does the call to action appear.

Also: a `skip` control, a restart control, clicking the body makes it say
something short, and one counter in `localStorage` changes the opening line on
a return visit.

**Below the fold.** Four quiet sections — what it is, that it remembers, where
it refuses to go, how to delete everything — revealed by an IntersectionObserver,
with the entity docking small and dim at the edge behind a dark veil.

**Look.** Near-black background with a slow vertical lift. One accent colour
that the game itself changes. A light serif for anything the entity says, a
neutral sans for interface text. Generous space, no icons, no stock imagery,
no cards, no gradient buttons, no scroll-jacking.

**Constraints.** Keep the copy short and unsentimental; write it in the
entity's voice, not a marketing voice. Respect `prefers-reduced-motion`. Make
the answers real buttons so Tab and Enter work and focus previews like hover.
Cap the render resolution against a pixel budget and step it down if frames run
long. Put every string in one module so the voice can be edited in one place.

Before writing code, show me: the six-line state machine, the copy for every
stage, and the uniform list. Wait for my go.
