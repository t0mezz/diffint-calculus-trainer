// Tests for the identities simplifier: every family simplifies to its
// stated answer, check() grades good / unsimplified / wrong, bad syntax
// throws, and the pool only deals fair, strictly-simplifying problems.
// Run: node test/simplify.js   (expects SIMPLIFY PASS)
"use strict";
const path = require("path");
const DIR = path.join(__dirname, "..", "js");

global.window = global;
require(path.join(DIR, "algebra.js"));
require(path.join(DIR, "simproblems.js"));

let failures = 0;
function assert(cond, msg) {
  console.log((cond ? "ok: " : "FAIL: ") + msg);
  if (!cond) failures++;
}

// Every identity family, fixed cases: equivalent and strictly smaller
[
  ["sin(x)^2 + cos(x)^2", "1"],
  ["sin(3*x)^2 + cos(3*x)^2", "1"],
  ["1 - sin(x)^2", "cos(x)^2"],
  ["1 - cos(x)^2", "sin(x)^2"],
  ["2*sin(x)*cos(x)", "sin(2*x)"],
  ["cos(x)^2 - sin(x)^2", "cos(2*x)"],
  ["1 - 2*sin(x)^2", "cos(2*x)"],
  ["2*cos(x)^2 - 1", "cos(2*x)"],
  ["(1 - cos(2*x))/2", "sin(x)^2"],
  ["(1 + cos(2*x))/2", "cos(x)^2"],
  ["tan(x)*cos(x)", "sin(x)"],
  ["sin(x)^2/cos(x)^2", "tan(x)^2"],
  ["sin(x)/cos(x)", "tan(x)"],
  ["sin(2*x)/(2*sin(x))", "cos(x)"],
  ["exp(2*x)*exp(3*x)", "exp(5*x)"],
  ["exp(2*x)^3", "exp(6*x)"],
  ["exp(3*x)/exp(x)", "exp(2*x)"],
  ["log(3*x) - log(3)", "log(x)"],
  ["log(x) + log(x)", "2*log(x)"],
  ["log(x^2)/2", "log(x)"],
  ["exp(log(x))", "x"],
  ["log(exp(x))", "x"],
  ["sqrt(x)*sqrt(x)", "x"],
].forEach(([src, want]) => {
  const a = Algebra.parse(src), w = Algebra.parse(want);
  assert(Algebra.equivalent(a, w), `${src} == ${want}`);
  assert(SimProblems.nodeCount(a) > SimProblems.nodeCount(w),
    `${src} strictly simplifies to ${want}`);
});

// check() grading on one problem
{
  const prob = {
    ast: Algebra.parse("sin(x)^2 + cos(x)^2"),
    expectedAst: Algebra.parse("1"),
  };
  assert(SimProblems.check("1", prob) === "good", "simplest form accepted");
  assert(SimProblems.check("cos(x)^2 + sin(x)^2", prob) === "unsimplified",
    "restated problem rejected as unsimplified");
  assert(SimProblems.check("0", prob) === "wrong", "wrong answer rejected");
  assert(SimProblems.check("1 + 0", prob) === "good", "smaller equal form accepted");
  try {
    SimProblems.check("2 +* x", prob);
    assert(false, "bad syntax should throw");
  } catch (e) { assert(true, "bad syntax throws"); }
}

// Pool fuzz: fair (checkable), equivalent, strictly simplifying,
// clean print, no immediate repeats
{
  const uglyRe = [
    /(^|[^0-9.])0 \*/, /\* 0([^0-9.]|$)/, /\+ 0([^0-9.]|$)/,
    /\+ -/, /- -/, /x\^1([^0-9]|$)/, /\^ 0([^0-9.]|$)/,
    /(^|[^0-9.])\* 1([^0-9.]|$)/,
  ];
  let last = null;
  ["warmup", "steady", "spicy"].forEach((d) => {
    for (let i = 0; i < 40; i++) {
      const p = SimProblems.generate(d);
      assert(Algebra.equivalent(p.ast, p.expectedAst),
        `equivalent: ${p.source} -> ${p.solution}`);
      assert(SimProblems.nodeCount(p.ast) > SimProblems.nodeCount(p.expectedAst),
        `strictly simpler: ${p.source} -> ${p.solution}`);
      assert(!uglyRe.some((re) => re.test(p.solution)),
        `clean print: ${p.solution}`);
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
    }
  });
}

console.log(failures === 0 ? "SIMPLIFY PASS" : failures + " FAILURES");
process.exit(failures ? 1 : 0);
