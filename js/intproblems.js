/* intproblems.js — pool of single-term indefinite integrals.
 * Each generator returns { prompt, source, expected, hint, rule }.
 * prompt: pretty math for the LCD. source: the integrand to show.
 * expected: one correct antiderivative (parseable input for Algebra,
 * +C omitted). Answers are graded by differentiation: check() parses
 * the user's answer, differentiates it, and tests equivalence with
 * the integrand — so any equal antiderivative counts, with or
 * without a constant term.
 */
(function (global) {
  "use strict";

  function ri(lo, hi) {
    return lo + Math.floor(Math.random() * (hi - lo + 1));
  }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function nz(lo, hi) {
    var v = 0;
    while (v === 0) v = ri(lo, hi);
    return v;
  }
  var RULES = {
    power: "Power rule",
    trig: "Trig integrals",
    exp: "Exponential",
    log: "Logarithm"
  };

  // Format q*x^m, collapsing unit coefficients: 1*x^3 -> x^3.
  // NOTE: never emit a bare "-x^m" — the parser reads "-x^4" as
  // (-x)^4, so a negative unit needs the explicit "-1*" prefix.
  function coefTerm(q, m) {
    var body = m === 1 ? "x" : "x^" + m;
    if (q === 1) return body;
    if (q === -1) return "-1*" + body;
    return q + "*" + body;
  }

  var generators = {
    power: function (spicy) {
      var n = spicy ? pick([1, 2, 3, 4, -2]) : pick([0, 1, 2, 3]);
      var a = nz(spicy ? -6 : -4, spicy ? 6 : 4);
      var m = n + 1;
      var src = n === 0 ? String(a)
        : n === -2 ? a + "/x^2"
        : a + "*x^" + n;
      var pretty = n === 0 ? String(a)
        : n === -2 ? a + "/x²"
        : (a === 1 ? "" : a === -1 ? "−" : a) + "x" + (n === 1 ? "" : "^" + n);
      // ∫a·x^n = a·x^m/m: fold the scalar when it divides evenly
      var num = a, den = m, exp;
      if (num % den === 0) {
        exp = coefTerm(num / den, m);
      } else {
        exp = a === 1 ? "x^" + m + "/" + den
          : a === -1 ? "-1*x^" + m + "/" + den
          : a + "*x^" + m + "/" + den;
      }
      return { prompt: pretty, source: src, expected: exp,
        hint: n === 0 ? "∫a dx = a·x"
          : n === -2 ? "x^−2 integrates to −x^−1"
          : "∫x^n dx = x^(n+1)/(n+1)", rule: RULES.power };
    },
    trig: function (spicy) {
      var f = pick(["sin", "cos"]);
      var k = spicy ? pick([1, 2, 3]) : 1;
      var a = (spicy && Math.random() < 0.5) ? nz(2, 4) : 1;
      var arg = k === 1 ? "x" : k + "*x";
      var cosArg = "cos(" + arg + ")", sinArg = "sin(" + arg + ")";
      var src = (a === 1 ? "" : a + "*") + f + "(" + arg + ")";
      // ∫a·sin(kx) = −a·cos(kx)/k, ∫a·cos(kx) = a·sin(kx)/k
      var exp = f === "sin" ? "-" + a + "*" + cosArg : a + "*" + sinArg;
      if (a === 1) exp = f === "sin" ? "-" + cosArg : sinArg;
      if (k !== 1) exp += "/" + k;
      var fname = f === "sin" ? "sin" : "cos";
      return { prompt: (a === 1 ? "" : a) + fname + "(" + (k === 1 ? "x" : k + "x") + ")",
        source: src, expected: exp,
        hint: k === 1 ? (f === "sin" ? "∫sin = −cos" : "∫cos = sin")
          : "Substitute u = " + k + "x, then divide by " + k,
        rule: RULES.trig };
    },
    exp: function (spicy) {
      var k = spicy ? pick([1, 2, 3]) : 1;
      var arg = k === 1 ? "x" : k + "*x";
      return { prompt: "e^(" + (k === 1 ? "x" : k + "x") + ")",
        source: "exp(" + arg + ")",
        expected: k === 1 ? "exp(x)" : "exp(" + arg + ")/" + k,
        hint: "∫e^(kx) dx = e^(kx)/k", rule: RULES.exp };
    },
    log: function (spicy) {
      if (!spicy || Math.random() < 0.5)
        return { prompt: "1/x", source: "1/x", expected: "log(x)",
          hint: "∫1/x dx = ln(x)", rule: RULES.log };
      var a = pick([2, 3]);
      return { prompt: "1/(" + a + "x)", source: "1/(" + a + "*x)",
        expected: "log(x)/" + a, hint: "Factor the " + a + " out first",
        rule: RULES.log };
    },
    root: function (spicy) {
      var a = spicy ? nz(1, 4) : pick([2, 3]);
      if (Math.random() < 0.5)
        return { prompt: a + "√x", source: a + "*sqrt(x)",
          expected: (2 * a) + "*x^(3/2)/3",
          hint: "√x = x^(1/2), then the power rule", rule: RULES.power };
      return { prompt: a + "/√x", source: a + "/sqrt(x)",
        expected: (2 * a) + "*sqrt(x)",
        hint: "1/√x = x^(−1/2), then the power rule", rule: RULES.power };
    }
  };

  var POOLS = {
    warmup: ["power", "trig", "exp"],
    steady: ["power", "trig", "exp", "log", "root"],
    spicy: ["power", "trig", "exp", "log", "root"]
  };

  // Anti-repeat: no identical source twice in a row, and no repeat
  // of anything seen in the last few tickets.
  var lastKey = null, recentSources = [];

  // A problem is only fair if answers to it can actually be checked:
  // count sample points where the integrand itself evaluates finite.
  // (The checker differentiates the answer and compares it against
  // the integrand at these points.)
  function coverage(ast) {
    var n = 0;
    global.Algebra.samplePoints.forEach(function (x) {
      try {
        var v = global.Algebra.evaluate(ast, x);
        if (typeof v === "number" && isFinite(v) && Math.abs(v) < 1e6) n++;
      } catch (e) { /* pole: skip */ }
    });
    return n;
  }

  function generate(difficulty) {
    var pool = POOLS[difficulty] || POOLS.steady;
    var spicy = difficulty === "spicy";
    var key, p, tries = 0;
    do {
      key = pick(pool);
      p = generators[key](spicy);
      // parseable source of truth + one antiderivative that
      // differentiates back to it
      var ast = global.Algebra.parse(p.source);
      var want = global.Algebra.parse(p.expected);
      p.ast = ast;
      p.expectedAst = want;
      tries++;
    } while (tries < 12 &&
      (key === lastKey || recentSources.indexOf(p.source) >= 0 ||
        coverage(p.ast) < 5 ||
        !global.Algebra.equivalent(global.Algebra.differentiate(p.expectedAst), p.ast)));
    lastKey = key;
    recentSources.push(p.source);
    if (recentSources.length > 12) recentSources.shift();
    p.difficulty = difficulty;
    p.solution = global.Algebra.toString(p.expectedAst);
    return p;
  }

  // Grade an answer by differentiating it: good when its derivative
  // matches the integrand. Parse errors throw; the caller reports them.
  function check(userSrc, problem) {
    var userAst = global.Algebra.parse(userSrc);
    var back = global.Algebra.differentiate(userAst);
    return global.Algebra.equivalent(back, problem.ast) ? "good" : "wrong";
  }

  global.IntProblems = {
    generate: generate, pools: POOLS, rules: RULES, check: check
  };
})(typeof window !== "undefined" ? window : globalThis);
