/* simproblems.js — pool of trig / exp / log identity simplifications.
 * Each generator returns { prompt, source, expected, hint, rule }.
 * prompt: pretty math for the LCD. source: the unsimplified expression.
 * expected: its simplest form (parseable input for Algebra).
 * Also provides nodeCount(ast) and check(userSrc, problem):
 * good (equivalent AND smaller), unsimplified (equivalent but no
 * smaller), wrong, or parse-error.
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
    pythag: "Pythagorean identity",
    double: "Double-angle",
    tansec: "Tangent & secant",
    exp: "Exponent laws",
    log: "Logarithm laws",
    inverse: "Inverse functions"
  };

  var generators = {
    pythag: function () {
      var mode = pick(["sum", "sumK", "oneMinusSin", "oneMinusCos"]);
      if (mode === "sum")
        return { prompt: "sin²(x) + cos²(x)", source: "sin(x)^2 + cos(x)^2",
          expected: "1", hint: "sin² + cos² = 1", rule: RULES.pythag };
      if (mode === "sumK") {
        var k = pick([2, 3]);
        return { prompt: "sin²(" + k + "x) + cos²(" + k + "x)",
          source: "sin(" + k + "*x)^2 + cos(" + k + "*x)^2",
          expected: "1", hint: "The identity holds for any angle", rule: RULES.pythag };
      }
      if (mode === "oneMinusSin")
        return { prompt: "1 − sin²(x)", source: "1 - sin(x)^2",
          expected: "cos(x)^2", hint: "Solve sin² + cos² = 1 for cos²", rule: RULES.pythag };
      return { prompt: "1 − cos²(x)", source: "1 - cos(x)^2",
        expected: "sin(x)^2", hint: "Solve sin² + cos² = 1 for sin²", rule: RULES.pythag };
    },
    double: function () {
      var mode = pick(["sin2", "cos2diff", "cos2a", "cos2b", "halfSin", "halfCos"]);
      if (mode === "sin2")
        return { prompt: "2·sin(x)·cos(x)", source: "2*sin(x)*cos(x)",
          expected: "sin(2*x)", hint: "sin(2x) = 2·sin(x)·cos(x)", rule: RULES.double };
      if (mode === "cos2diff")
        return { prompt: "cos²(x) − sin²(x)", source: "cos(x)^2 - sin(x)^2",
          expected: "cos(2*x)", hint: "cos(2x) = cos² − sin²", rule: RULES.double };
      if (mode === "cos2a")
        return { prompt: "1 − 2·sin²(x)", source: "1 - 2*sin(x)^2",
          expected: "cos(2*x)", hint: "cos(2x) = 1 − 2·sin²", rule: RULES.double };
      if (mode === "cos2b")
        return { prompt: "2·cos²(x) − 1", source: "2*cos(x)^2 - 1",
          expected: "cos(2*x)", hint: "cos(2x) = 2·cos² − 1", rule: RULES.double };
      if (mode === "halfSin")
        return { prompt: "(1 − cos(2x)) / 2", source: "(1 - cos(2*x))/2",
          expected: "sin(x)^2", hint: "Half-angle: sin² = (1 − cos 2x)/2", rule: RULES.double };
      return { prompt: "(1 + cos(2x)) / 2", source: "(1 + cos(2*x))/2",
        expected: "cos(x)^2", hint: "Half-angle: cos² = (1 + cos 2x)/2", rule: RULES.double };
    },
    tansec: function () {
      var mode = pick(["tanTimesCos", "sqQuotient", "tanQuotient", "sinDouble"]);
      if (mode === "tanTimesCos")
        return { prompt: "tan(x)·cos(x)", source: "tan(x)*cos(x)",
          expected: "sin(x)", hint: "Write tan as sin/cos, then cancel", rule: RULES.tansec };
      if (mode === "sqQuotient")
        return { prompt: "sin²(x) / cos²(x)", source: "sin(x)^2/cos(x)^2",
          expected: "tan(x)^2", hint: "A quotient of squares is a square of tan",
          rule: RULES.tansec };
      if (mode === "tanQuotient")
        return { prompt: "sin(x) / cos(x)", source: "sin(x)/cos(x)",
          expected: "tan(x)", hint: "tan = sin / cos", rule: RULES.tansec };
      return { prompt: "sin(2x) / (2·sin(x))", source: "sin(2*x)/(2*sin(x))",
        expected: "cos(x)", hint: "Expand sin(2x), then cancel", rule: RULES.tansec };
    },
    exp: function () {
      var mode = pick(["product", "power", "quotient"]);
      if (mode === "product") {
        var a = nz(1, 3), b = nz(1, 3);
        return { prompt: "e^(" + a + "x)·e^(" + b + "x)",
          source: "exp(" + a + "*x)*exp(" + b + "*x)",
          expected: "exp(" + (a + b) + "*x)", hint: "e^a·e^b = e^(a+b)", rule: RULES.exp };
      }
      if (mode === "power") {
        var c = nz(1, 3), n = pick([2, 3]);
        return { prompt: "(e^(" + c + "x))^" + n, source: "exp(" + c + "*x)^" + n,
          expected: "exp(" + (c * n) + "*x)", hint: "(e^a)^n = e^(a·n)", rule: RULES.exp };
      }
      var p = nz(1, 3), q = nz(1, 3);
      if (p === q) q = p + 1;
      return { prompt: "e^(" + p + "x) / e^(" + q + "x)",
        source: "exp(" + p + "*x)/exp(" + q + "*x)",
        expected: q > p ? "1/exp(" + (q - p) + "*x)" : "exp(" + (p - q) + "*x)",
        hint: "e^a / e^b = e^(a−b)", rule: RULES.exp };
    },
    log: function () {
      var mode = pick(["split", "combine", "halfSquare"]);
      if (mode === "split") {
        var a = pick([2, 3, 4]);
        return { prompt: "ln(" + a + "x) − ln(" + a + ")",
          source: "log(" + a + "*x) - log(" + a + ")",
          expected: "log(x)",
          hint: "ln(a·x) − ln(a) = ln(x)", rule: RULES.log };
      }
      if (mode === "combine") {
        return { prompt: "ln(x) + ln(x)", source: "log(x) + log(x)",
          expected: "2*log(x)", hint: "Two of the same log make 2·ln(x)",
          rule: RULES.log };
      }
      return { prompt: "ln(x²) / 2", source: "log(x^2)/2",
        expected: "log(x)", hint: "Halve the power inside", rule: RULES.log };
    },
    inverse: function () {
      var mode = pick(["expLog", "logExp", "sqrtSq"]);
      if (mode === "expLog")
        return { prompt: "e^(ln(x))", source: "exp(log(x))",
          expected: "x", hint: "exp and ln undo each other", rule: RULES.inverse };
      if (mode === "logExp")
        return { prompt: "ln(e^(x))", source: "log(exp(x))",
          expected: "x", hint: "ln and exp undo each other", rule: RULES.inverse };
      return { prompt: "√(x)·√(x)", source: "sqrt(x)*sqrt(x)",
        expected: "x", hint: "√x · √x = x", rule: RULES.inverse };
    }
  };

  var POOLS = {
    warmup: ["pythag", "exp", "inverse"],
    steady: ["pythag", "double", "exp", "log", "inverse", "tansec"],
    spicy: ["double", "tansec", "log", "exp", "pythag", "inverse"]
  };

  // Anti-repeat: no identical source twice in a row, and no repeat
  // of anything seen in the last few tickets.
  var lastKey = null, recentSources = [];

  // A problem is only fair if answers to it can actually be checked:
  // count sample points where the problem itself evaluates finite.
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

  function nodeCount(n) {
    switch (n.t) {
      case "num": case "var": case "const": return 1;
      case "un": return 1 + nodeCount(n.a);
      case "fn": return 1 + nodeCount(n.a);
      case "bin": return 1 + nodeCount(n.a) + nodeCount(n.b);
    }
    return 1;
  }

  function generate(difficulty) {
    var pool = POOLS[difficulty] || POOLS.steady;
    var key, p, tries = 0;
    do {
      key = pick(pool);
      p = generators[key]();
      // parseable source of truth + expected simplest form
      var ast = global.Algebra.parse(p.source);
      var want = global.Algebra.parse(p.expected);
      p.ast = ast;
      p.expectedAst = want;
      tries++;
    } while (tries < 12 &&
      (key === lastKey || recentSources.indexOf(p.source) >= 0 ||
        coverage(p.ast) < 5 ||
        !global.Algebra.equivalent(p.ast, p.expectedAst) ||
        nodeCount(p.ast) <= nodeCount(p.expectedAst)));
    lastKey = key;
    recentSources.push(p.source);
    if (recentSources.length > 12) recentSources.shift();
    p.difficulty = difficulty;
    p.solution = global.Algebra.toString(p.expectedAst);
    return p;
  }

  // Grade an answer: good (equal and smaller), unsimplified (equal
  // but no smaller), wrong, or parse-error (throws stay with caller).
  function check(userSrc, problem) {
    var userAst = global.Algebra.parse(userSrc);
    if (!global.Algebra.equivalent(userAst, problem.expectedAst)) return "wrong";
    if (nodeCount(userAst) < nodeCount(problem.ast)) return "good";
    return "unsimplified";
  }

  global.SimProblems = {
    generate: generate, pools: POOLS, rules: RULES,
    nodeCount: nodeCount, check: check
  };
})(typeof window !== "undefined" ? window : globalThis);
