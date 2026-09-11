# Differentiator Mk I

A skeuomorphic derivative trainer. Open `index.html` in a browser — no build,
no dependencies, no tracking.

- `index.html` — the bench instrument (LCD, odometers, lamp, levers)
- `css/styles.css` — skeuomorphic styling
- `js/algebra.js` — symbolic backbone: parse, differentiate, simplify,
  evaluate, equivalence-check
- `js/problems.js` — random pool of nicely-differentiable functions
  (Warm-up / Steady / Spicy)
- `js/app.js` — trainer wiring: streaks, lamp, sounds, tickets

Check the backbone with Node: `node test/smoke.js` (expects `ALL PASS`).
