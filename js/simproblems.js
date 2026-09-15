/* simproblems.js — compositional pool of trig / exp / log identity
 * simplifications. Each generator returns
 * { prompt, source, expected, hint, rule }.
 * source: the unsimplified expression. expected: its simplest form
 * (parseable input for Algebra). prompt is kept equal to source for
 * compatibility — the pages render math with Tex.ofSource.
 *
 * Identities are parameterized rather than hardcoded: every trig
 * identity holds at any angle kx, and every identity can carry a
 * coefficient. On top of that, `combo` adds two independent identities
 * together. Both moves preserve what check() needs — the two sides stay
 * equivalent, and the left stays strictly larger — so the pool grows
 * combinatorially without loosening grading.
 *
 * Also provides nodeCount(ast) and check(userSrc, problem):
 * good (equivalent AND smaller), unsimplified (equivalent but no
 * smaller), wrong, or parse-error.
 */
(function (global) {
  "use strict";

  var ri = global.Pool.ri, pick = global.Pool.pick, nz = global.Pool.nz;

  var RULES = {
    pythag: "Pythagorean identity",
    double: "Double-angle",
    tansec: "Tangent & secant",
    exp: "Exponent laws",
    log: "Logarithm laws",
    inverse: "Inverse functions",
    combo: "Several identities"
  };

  // c·body, with unit coefficients collapsed. As in the other pools,
  // a negative unit needs "-1*": the parser reads "-x^2" as (-x)^2.
  function coef(c, body) {
    if (c === 1) return body;
    if (c === -1) return "-1*" + body;
    return c + "*" + body;
  }
  function grp(s) { return "(" + s + ")"; }
  function ang(k) { return k === 1 ? "x" : k + "*x"; }

  // ---------- identities: an expression and its simplest form ----------
  // Each returns { src, dst, rule, hint } with src strictly larger than
  // dst and numerically equal to it; generate() verifies both.
  var identities = {
    pythag: function () {
      var k = pick([1, 1, 2, 3, 4]), a = ang(k);
      switch (pick(["sum", "oneMinusSin", "oneMinusCos"])) {
        case "sum":
          return { src: "sin(" + a + ")^2 + cos(" + a + ")^2", dst: "1",
            rule: RULES.pythag,
            hint: k === 1 ? "sin² + cos² = 1" : "The identity holds for any angle" };
        case "oneMinusSin":
          return { src: "1 - sin(" + a + ")^2", dst: "cos(" + a + ")^2",
            rule: RULES.pythag, hint: "Solve sin² + cos² = 1 for cos²" };
        default:
          return { src: "1 - cos(" + a + ")^2", dst: "sin(" + a + ")^2",
            rule: RULES.pythag, hint: "Solve sin² + cos² = 1 for sin²" };
      }
    },
    double: function () {
      var k = pick([1, 1, 2, 3]), a = ang(k), two = ang(2 * k);
      switch (pick(["sin2", "cos2diff", "cos2a", "cos2b", "halfSin", "halfCos"])) {
        case "sin2":
          return { src: "2*sin(" + a + ")*cos(" + a + ")", dst: "sin(" + two + ")",
            rule: RULES.double, hint: "sin(2u) = 2·sin(u)·cos(u)" };
        case "cos2diff":
          return { src: "cos(" + a + ")^2 - sin(" + a + ")^2", dst: "cos(" + two + ")",
            rule: RULES.double, hint: "cos(2u) = cos² - sin²" };
        case "cos2a":
          return { src: "1 - 2*sin(" + a + ")^2", dst: "cos(" + two + ")",
            rule: RULES.double, hint: "cos(2u) = 1 - 2·sin²" };
        case "cos2b":
          return { src: "2*cos(" + a + ")^2 - 1", dst: "cos(" + two + ")",
            rule: RULES.double, hint: "cos(2u) = 2·cos² - 1" };
        case "halfSin":
          return { src: "(1 - cos(" + two + "))/2", dst: "sin(" + a + ")^2",
            rule: RULES.double, hint: "Half-angle: sin² = (1 - cos 2u)/2" };
        default:
          return { src: "(1 + cos(" + two + "))/2", dst: "cos(" + a + ")^2",
            rule: RULES.double, hint: "Half-angle: cos² = (1 + cos 2u)/2" };
      }
    },
    tansec: function () {
      var k = pick([1, 1, 2, 3]), a = ang(k), two = ang(2 * k);
      switch (pick(["tanTimesCos", "sqQuotient", "tanQuotient", "sinDouble",
        "cotTimesSin", "tanOverSin"])) {
        case "tanTimesCos":
          return { src: "tan(" + a + ")*cos(" + a + ")", dst: "sin(" + a + ")",
            rule: RULES.tansec, hint: "Write tan as sin/cos, then cancel" };
        case "sqQuotient":
          return { src: "sin(" + a + ")^2/cos(" + a + ")^2", dst: "tan(" + a + ")^2",
            rule: RULES.tansec, hint: "A quotient of squares is a square of tan" };
        case "tanQuotient":
          return { src: "sin(" + a + ")/cos(" + a + ")", dst: "tan(" + a + ")",
            rule: RULES.tansec, hint: "tan = sin / cos" };
        case "cotTimesSin":
          return { src: "cos(" + a + ")/(sin(" + a + ")/cos(" + a + "))",
            dst: "cos(" + a + ")^2/sin(" + a + ")",
            rule: RULES.tansec, hint: "Dividing by sin/cos multiplies by cos/sin" };
        case "tanOverSin":
          return { src: "tan(" + a + ")/sin(" + a + ")", dst: "1/cos(" + a + ")",
            rule: RULES.tansec, hint: "tan/sin leaves 1/cos" };
        default:
          return { src: "sin(" + two + ")/(2*sin(" + a + "))", dst: "cos(" + a + ")",
            rule: RULES.tansec, hint: "Expand sin(2u), then cancel" };
      }
    },
    exp: function () {
      switch (pick(["product", "power", "quotient", "expNeg"])) {
        case "product": {
          var a = nz(1, 4), b = nz(1, 4);
          return { src: "exp(" + ang(a) + ")*exp(" + ang(b) + ")",
            dst: "exp(" + ang(a + b) + ")",
            rule: RULES.exp, hint: "e^a·e^b = e^(a+b)" };
        }
        case "power": {
          var c = nz(1, 4), n = pick([2, 3, 4]);
          return { src: "exp(" + ang(c) + ")^" + n, dst: "exp(" + ang(c * n) + ")",
            rule: RULES.exp, hint: "(e^a)^n = e^(a·n)" };
        }
        case "expNeg": {
          var m = nz(1, 4);
          return { src: "1/exp(" + ang(m) + ")", dst: "exp(-1*" + ang(m) + ")",
            rule: RULES.exp, hint: "1/e^a = e^(-a)" };
        }
        default: {
          var p = nz(1, 4), q = nz(1, 4);
          if (p === q) q = p + 1;
          return { src: "exp(" + ang(p) + ")/exp(" + ang(q) + ")",
            dst: q > p ? "1/exp(" + ang(q - p) + ")" : "exp(" + ang(p - q) + ")",
            rule: RULES.exp, hint: "e^a / e^b = e^(a-b)" };
        }
      }
    },
    log: function () {
      switch (pick(["split", "combine", "power", "quotient"])) {
        case "split": {
          var a = pick([2, 3, 4, 5]);
          return { src: "log(" + a + "*x) - log(" + a + ")", dst: "log(x)",
            rule: RULES.log, hint: "ln(a·x) - ln(a) = ln(x)" };
        }
        case "combine": {
          var n = pick([2, 3, 4]);
          return { src: Array(n + 1).join("log(x) + ").slice(0, -3),
            dst: coef(n, "log(x)"),
            rule: RULES.log, hint: n + " of the same log make " + n + "·ln(x)" };
        }
        case "power": {
          var m = pick([2, 3, 4]);
          return { src: "log(x^" + m + ")/" + m, dst: "log(x)",
            rule: RULES.log, hint: "Bring the power down, then divide" };
        }
        default: {
          var b = pick([2, 3, 4]);
          return { src: "log(x/" + b + ") + log(" + b + ")", dst: "log(x)",
            rule: RULES.log, hint: "ln(x/b) + ln(b) = ln(x)" };
        }
      }
    },
    inverse: function () {
      switch (pick(["expLog", "logExp", "sqrtSq", "sqrtPow", "logExpK"])) {
        case "expLog":
          return { src: "exp(log(x))", dst: "x", rule: RULES.inverse,
            hint: "exp and ln undo each other" };
        case "logExp":
          return { src: "log(exp(x))", dst: "x", rule: RULES.inverse,
            hint: "ln and exp undo each other" };
        case "logExpK": {
          var k = pick([2, 3, 4]);
          return { src: "log(exp(" + ang(k) + "))", dst: ang(k),
            rule: RULES.inverse, hint: "ln and exp undo each other" };
        }
        case "sqrtPow":
          return { src: "sqrt(x^2)/x", dst: "1", rule: RULES.inverse,
            hint: "√(x²) is x for positive x" };
        default:
          return { src: "sqrt(x)*sqrt(x)", dst: "x", rule: RULES.inverse,
            hint: "√x · √x = x" };
      }
    }
  };

  // Add two independent identities. Both sides grow by the same node,
  // so the left stays strictly larger and the answer stays checkable —
  // which is what turns a few dozen identities into a few thousand.
  function combo(families) {
    var left = families.slice(), parts = [];
    while (parts.length < 2 && left.length) {
      var i = Math.floor(Math.random() * left.length);
      parts.push(identities[left.splice(i, 1)[0]]());
    }
    return {
      src: grp(parts[0].src) + " + " + grp(parts[1].src),
      dst: grp(parts[0].dst) + " + " + grp(parts[1].dst),
      rule: RULES.combo,
      hint: "Simplify each part on its own, then add"
    };
  }

  function build(key, families) {
    var id = key === "combo" ? combo(families) : identities[key]();
    return { prompt: id.src, source: id.src, expected: id.dst,
      hint: id.hint, rule: id.rule };
  }

  // Families a combo may draw from. Kept separate from POOLS so a combo
  // in "steady" cannot smuggle in a family that pool does not teach.
  var COMBO_FAMILIES = {
    steady: ["pythag", "exp", "log", "inverse"],
    spicy: ["pythag", "double", "tansec", "exp", "log", "inverse"]
  };

  var POOLS = {
    warmup: ["pythag", "exp", "inverse"],
    steady: ["pythag", "double", "exp", "log", "inverse", "tansec", "combo"],
    spicy: ["double", "tansec", "log", "exp", "pythag", "inverse", "combo"]
  };

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
    var name = POOLS[difficulty] ? difficulty : "steady";
    var families = COMBO_FAMILIES[name] || COMBO_FAMILIES.steady;
    var p = global.Pool.deal({
      trainer: "simplify",
      pool: name,
      keys: POOLS[name],
      make: function (key) { return build(key, families); },
      fair: function (c) {
        // parseable source of truth + expected simplest form
        c.ast = global.Algebra.parse(c.source);
        c.expectedAst = global.Algebra.simplify(
          global.Algebra.parse(c.expected));
        // Never deal a problem whose answer cannot be checked, or that
        // is not strictly simplifying.
        return coverage(c.ast) >= 5 &&
          global.Algebra.equivalent(c.ast, c.expectedAst) &&
          nodeCount(c.ast) > nodeCount(c.expectedAst);
      }
    });
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
