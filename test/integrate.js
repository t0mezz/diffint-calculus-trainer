// Tests for the integrator: every family differentiates back to its
// integrand, check() accepts any equal antiderivative (+C or not) and
// rejects wrong answers, bad syntax throws, and the pool only deals
// fair single-term problems, spicy included.
// Run: node test/integrate.js   (expects INTEGRATE PASS)
"use strict";
const path = require("path");
const DIR = path.join(__dirname, "..", "js");

global.window = global;
require(path.join(DIR, "algebra.js"));
require(path.join(DIR, "intproblems.js"));

let failures = 0;
function assert(cond, msg) {
  console.log((cond ? "ok: " : "FAIL: ") + msg);
  if (!cond) failures++;
}

function differentiatesBack(src, want) {
  const a = Algebra.parse(src), w = Algebra.parse(want);
  return Algebra.equivalent(Algebra.differentiate(w), a);
}

// Every family, fixed cases: the stated antiderivative is correct
[
  ["4", "4*x"],
  ["3*x^2", "x^3"],
  ["2*x", "x^2"],
  ["5*x^3", "5*x^4/4"],
  ["-4*x^3", "-1*x^4"],
  ["2/x^2", "-2*x^-1"],
  ["sin(x)", "-cos(x)"],
  ["cos(x)", "sin(x)"],
  ["2*sin(2*x)", "-1*cos(2*x)"],
  ["3*cos(3*x)", "sin(3*x)"],
  ["exp(x)", "exp(x)"],
  ["exp(2*x)", "exp(2*x)/2"],
  ["1/x", "log(x)"],
  ["1/(2*x)", "log(x)/2"],
  ["3*sqrt(x)", "6*x^(3/2)/3"],
  ["2/sqrt(x)", "4*sqrt(x)"],
].forEach(([src, want]) => {
  assert(differentiatesBack(src, want), `∫${src} = ${want}`);
});

// check() grading on one problem
{
  const prob = {
    ast: Algebra.parse("2*x"),
    expectedAst: Algebra.parse("x^2"),
  };
  assert(IntProblems.check("x^2", prob) === "good", "antiderivative accepted");
  assert(IntProblems.check("x^2 + 5", prob) === "good",
    "constant term accepted (differentiates away)");
  assert(IntProblems.check("x^3", prob) === "wrong", "wrong answer rejected");
  try {
    IntProblems.check("2 +* x", prob);
    assert(false, "bad syntax should throw");
  } catch (e) { assert(true, "bad syntax throws"); }
}

// Pool fuzz: inverse-correct, solution accepted, wrong rejected,
// checkable, no immediate repeats, spicy deals harder shapes
{
  let last = null;
  let spicyHard = 0;
  ["warmup", "steady", "spicy"].forEach((d) => {
    for (let i = 0; i < 40; i++) {
      const p = IntProblems.generate(d);
      assert(Algebra.equivalent(Algebra.differentiate(p.expectedAst), p.ast),
        `inverse: ∫${p.source} = ${p.solution}`);
      assert(IntProblems.check(p.solution, p) === "good",
        `solution accepted: ${p.source}`);
      assert(IntProblems.check("x^999 + 1", p) === "wrong",
        `wrong rejected: ${p.source}`);
      assert(p.source !== last, `no immediate repeat: ${p.source}`);
      last = p.source;
      const cov = Algebra.samplePoints.filter((x) => {
        try {
          const v = Algebra.evaluate(p.ast, x);
          return Number.isFinite(v) && Math.abs(v) < 1e6;
        } catch (e) { return false; }
      }).length;
      assert(cov >= 5, `coverage ${cov}: ${p.source}`);
      assert(typeof p.hint === "string" && p.hint.length > 0, `hint: ${p.source}`);
      assert(typeof p.rule === "string" && p.rule.length > 0, `rule: ${p.source}`);
      if (d === "spicy" && /(\/x\^2|\([23]\*x\)|log|sqrt)/.test(p.source)) spicyHard++;
    }
  });
  assert(spicyHard > 0, `spicy deals harder shapes (${spicyHard} seen)`);
}

console.log(failures === 0 ? "INTEGRATE PASS" : failures + " FAILURES");
process.exit(failures ? 1 : 0);
