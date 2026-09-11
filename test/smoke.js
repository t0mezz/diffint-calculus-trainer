// Smoke test for the symbolic backbone + problem pool.
// Run: node test/smoke.js   (expects ALL PASS)
"use strict";
const path = require("path");
const DIR = path.join(__dirname, "..", "js");

global.window = global;
require(path.join(DIR, "algebra.js"));
require(path.join(DIR, "problems.js"));

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.log("FAIL:", msg); }
}

// Known derivatives
[
  ["3*x^2 + 2*x + 1", "6*x + 2"],
  ["sin(x)", "cos(x)"],
  ["cos(x)", "-sin(x)"],
  ["exp(x)", "exp(x)"],
  ["exp(2*x)", "2*exp(2*x)"],
  ["log(x)", "1/x"],
  ["sqrt(x)", "1/(2*sqrt(x))"],
  ["x*sin(x)", "sin(x) + x*cos(x)"],
  ["x^2/(x + 1)", "(2*x*(x+1) - x^2)/(x+1)^2"],
  ["(2*x + 1)^3", "6*(2*x+1)^2"],
  ["sin(3*x)", "3*cos(3*x)"],
  ["5", "0"],
  ["x", "1"],
].forEach(([src, want]) => {
  const got = Algebra.differentiate(Algebra.parse(src));
  assert(Algebra.equivalent(got, Algebra.parse(want)), `${src} -> ${want}`);
});

// Equivalent forms accepted, wrong rejected, bad syntax throws
const exp = Algebra.differentiate(Algebra.parse("3*x^2 + 2*x"));
assert(Algebra.equivalentSrc("6x+2", exp), "implicit mult accepted");
assert(Algebra.equivalentSrc("2 + 6*x", exp), "order-insensitive");
assert(!Algebra.equivalentSrc("6*x + 3", exp), "wrong answer rejected");
try { Algebra.parse("2 +* x"); assert(false, "bad syntax should throw"); }
catch (e) { /* expected */ }

// Pool: solution matches raw derivative, prints cleanly, matches finite diff
const uglyRe = [
  /(^|[^0-9.])0 \*/, /\* 0([^0-9.]|$)/, /\+ 0([^0-9.]|$)/,
  /\+ -/, /- -/, /x\^1([^0-9]|$)/, /\^ 0([^0-9.]|$)/,
  /(^|[^0-9.])\* 1([^0-9.]|$)/,
];
["warmup", "steady", "spicy"].forEach((d) => {
  for (let i = 0; i < 40; i++) {
    const p = Problems.generate(d);
    assert(Algebra.equivalent(p.expected, Algebra.differentiate(p.ast)),
      `simplified == raw for ${p.source}`);
    assert(!uglyRe.some((re) => re.test(p.solution)),
      `clean print: ${p.solution}`);
    // fair: the problem itself must be checkable at enough sample points
    const cov = Algebra.samplePoints.filter((x) => {
      try {
        const v = Algebra.evaluate(p.ast, x);
        return Number.isFinite(v) && Math.abs(v) < 1e6;
      } catch (e) { return false; }
    }).length;
    assert(cov >= 5, `coverage ${cov}: ${p.source} -> ${p.solution}`);
    // finite differences at an x0 inside the function's domain
    const h = 1e-5;
    const x0 = [1.1, -0.5, 0.5, 2.0, 2.5, 3.5, -2.0, -3.5, 0.2, -1.2].find((x) => {
      try {
        const vs = [x - h, x, x + h].map((t) => Algebra.evaluate(p.ast, t));
        return vs.every((v) => Number.isFinite(v) && Math.abs(v) < 1e6);
      } catch (e) { return false; }
    });
    assert(x0 !== undefined, `domain point found: ${p.source}`);
    const num = (Algebra.evaluate(p.ast, x0 + h) - Algebra.evaluate(p.ast, x0 - h)) / (2 * h);
    const ana = Algebra.evaluate(p.expected, x0);
    assert(Number.isFinite(ana) && Math.abs(ana) < 1e6 && Math.abs(num - ana) < 1e-3,
      `finite-diff mismatch: ${p.source} -> ${p.solution}`);
  }
});

console.log(failures === 0 ? "ALL PASS" : `${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
