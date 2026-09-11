# Differentiator Mk I

A platinum-styled derivative trainer behind a retro desktop landing page.
Open `index.html` in a browser — no build, no dependencies, no tracking.

- `index.html` + `css/desktop.css` + `js/desktop.js` — the desktop:
  menu bar, clock, one icon, zoom-rect opening animation
- `differentiator.html` — the trainer window (platinum, TeX-style math)
- `css/styles.css` — skeuomorphic styling
- `js/algebra.js` — symbolic backbone: parse, differentiate, simplify,
  evaluate, equivalence-check
- `js/problems.js` — random pool of nicely-differentiable functions
  (Warm-up / Steady / Spicy)
- `js/app.js` — trainer wiring: streaks, lamp, sounds, tickets

Check the backbone with Node: `node test/smoke.js` (expects `ALL PASS`).
Check the desktop open flow: `node test/desktop.js` (expects `DESKTOP PASS`).
