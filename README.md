# Differentiator Mk I

A platinum-styled derivative trainer behind a retro desktop landing page.
Open `index.html` in a browser — no build, no dependencies, no tracking.

- `index.html` + `css/desktop.css` + `js/desktop.js` — the desktop:
  menu bar, clock, three icons, zoom-rect opening animation
- `differentiator.html` — the trainer window (platinum, TeX-style math)
- `simplifier.html` + `js/simproblems.js` + `js/simpapp.js` — the
  identities trainer: simplify trig / exp / log expressions; answers
  must be equal AND smaller
- `integrator.html` + `js/intproblems.js` + `js/intapp.js` — the
  integrator: indefinite integrals composed from terms (power, trig,
  exp, log, roots, 1/cos²) and sums of them; answers graded by
  differentiation, +C omitted
- `css/styles.css` — skeuomorphic styling
- `js/algebra.js` — symbolic backbone: parse, differentiate, simplify,
  evaluate, equivalence-check
- `js/pool.js` — shared dealing machinery: shape-keyed anti-repeat and
  variety-weighted family selection, used by all three trainers
- `js/problems.js` — random pool of nicely-differentiable functions
  (Warm-up / Steady / Spicy)
- `js/app.js` — trainer wiring: streaks, lamp, sounds, tickets

Check the backbone with Node: `node test/smoke.js` (expects `ALL PASS`).
Check the desktop open flow: `node test/desktop.js` (expects `DESKTOP PASS`).
Check the simplifier pool: `node test/simplify.js` (expects `SIMPLIFY PASS`).
Check the integrator pool: `node test/integrate.js` (expects `INTEGRATE PASS`).
