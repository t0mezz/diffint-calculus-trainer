/* problems.js — pool of nicely-differentiable random functions.
 * Each generator returns { prompt, source, hint, rule }.
 * prompt: pretty math for the LCD. source: parseable input for Algebra.
 * Coefficients are small integers so derivatives stay clean.
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
  function term(c, pow) {
    // pretty monomial: 3x^2, -x, 5
    if (pow === 0) return String(c);
    var mag = Math.abs(c);
    var body = (mag === 1 ? "x" : mag + "x") + (pow === 1 ? "" : "^" + pow);
    return (c < 0 ? "-" : "") + body;
  }
  function joinTerms(parts) {
    var s = "";
    parts.forEach(function (p, i) {
      if (p === "" || p === "0") return;
      if (i === 0 || s === "") s += p;
      else s += (p[0] === "-" ? " - " + p.slice(1) : " + " + p);
    });
    return s === "" ? "0" : s.replace(/^- /, "-");
  }
  var RULES = {
    power: "Power rule",
    trig: "Trig derivatives",
    exp: "Exponential",
    log: "Logarithm",
    chain: "Chain rule",
    product: "Product rule",
    quotient: "Quotient rule",
    sum: "Sum rule"
  };

  var generators = {
    polynomial: function () {
      var a = nz(-6, 6), b = nz(-6, 6), c = nz(-6, 6);
      var expr = joinTerms([term(a, 2), term(b, 1), term(c, 0)]);
      return { prompt: expr, source: a + "*x^2 + " + b + "*x + " + c, hint: "d/dx x^n = n·x^(n−1)", rule: RULES.power };
    },
    cubic: function () {
      var a = nz(-4, 4), b = nz(-5, 5), c = nz(-5, 5);
      var expr = joinTerms([term(a, 3), term(b, 2), term(c, 1)]);
      return { prompt: expr, source: a + "*x^3 + " + b + "*x^2 + " + c + "*x", hint: "Apply the power rule term by term", rule: RULES.power };
    },
    power: function () {
      var n = pick([3, 4, 5, 6]), a = nz(-5, 5);
      var inner = a === 1 ? "x^" + n : a === -1 ? "-x^" + n : a + "x^" + n;
      return { prompt: inner, source: a + "*x^" + n, hint: "Bring the exponent down", rule: RULES.power };
    },
    trig: function () {
      var f = pick(["sin", "cos"]), a = nz(-5, 5);
      var coef = a === 1 ? "" : a === -1 ? "-" : a;
      return { prompt: coef + f + "(x)", source: a + "*" + f + "(x)", hint: f === "sin" ? "(sin)′ = cos" : "(cos)′ = −sin", rule: RULES.trig };
    },
    exp: function () {
      var a = nz(-4, 4);
      var coef = a === 1 ? "" : a === -1 ? "-" : a;
      return { prompt: coef + "e^x", source: a + "*exp(x)", hint: "(e^x)′ = e^x", rule: RULES.exp };
    },
    expChain: function () {
      var k = pick([-3, -2, 2, 3]);
      return { prompt: "e^(" + k + "x)", source: "exp(" + k + "*x)", hint: "Chain rule: outer × inner′", rule: RULES.chain };
    },
    log: function () {
      var a = nz(-4, 4);
      var coef = a === 1 ? "" : a === -1 ? "-" : a;
      return { prompt: coef + "ln(x)", source: a + "*log(x)", hint: "(ln x)′ = 1/x", rule: RULES.log };
    },
    chainPoly: function () {
      var n = pick([2, 3]), a = nz(-3, 3), b = nz(-4, 4);
      var inner = joinTerms([term(a, 1), String(b)]);
      return { prompt: "(" + inner + ")^" + n, source: "(" + a + "*x + " + b + ")^" + n, hint: "n·inner^(n−1) · inner′", rule: RULES.chain };
    },
    chainTrig: function () {
      var f = pick(["sin", "cos"]), k = pick([-3, -2, 2, 3]);
      return { prompt: f + "(" + k + "x)", source: f + "(" + k + "*x)", hint: "Outer derivative × " + k, rule: RULES.chain };
    },
    product: function () {
      var mode = pick(["poly-sin", "poly-exp", "poly-cos", "sq-sin", "sq-exp",
        "x-log", "poly-poly"]);
      var a = nz(-4, 4);
      var mk = function (kind) {
        if (kind === "x-log") return { prompt: "x·ln(x)", source: "x*log(x)" };
        if (kind === "poly-poly") {
          var p = nz(-5, 5), q = nz(-5, 5);
          var L = "(x + " + p + ")", R = "(x + " + q + ")";
          return { prompt: L + "" + R, source: L + "*" + R };
        }
        var left = a === 1 ? "x" : a === -1 ? "-x" : a + "x";
        var right = kind === "poly-sin" || kind === "sq-sin" ? "sin(x)"
          : kind === "poly-cos" ? "cos(x)" : "e^x";
        var rsrc = kind === "poly-sin" || kind === "sq-sin" ? "sin(x)"
          : kind === "poly-cos" ? "cos(x)" : "exp(x)";
        var lsrc = kind === "sq-sin" || kind === "sq-exp"
          ? a + "*x^2" : a + "*x";
        var lpretty = (kind === "sq-sin" || kind === "sq-exp")
          ? (a === 1 ? "x^2" : a === -1 ? "-x^2" : a + "x^2") : left;
        return { prompt: lpretty + "·" + right, source: lsrc + "*" + rsrc };
      };
      var m = mk(mode);
      return { prompt: m.prompt, source: m.source,
        hint: "(uv)′ = u′v + uv′", rule: RULES.product };
    },
    quotient: function () {
      // varied numerators and denominators so the shape never repeats
      var numKind = pick(["x", "x2", "lin"]);
      var denKind = pick(["lin", "quad"]);
      var a = nz(-4, 4), b = nz(1, 5), c = nz(-4, 4);
      var numS = numKind === "x" ? "x" : numKind === "x2" ? "x^2"
        : "(" + a + "*x + " + c + ")";
      var denS = denKind === "lin" ? "(x + " + b + ")" : "(x^2 + " + b + ")";
      return { prompt: numS + " / " + denS, source: numS + "/" + denS,
        hint: "(u/v)′ = (u′v − uv′)/v²", rule: RULES.quotient };
    },
    tan: function () {
      var a = nz(-3, 3);
      var coef = a === 1 ? "" : a === -1 ? "-" : a;
      return { prompt: coef + "tan(x)", source: a + "*tan(x)",
        hint: "(tan)′ = 1/cos²", rule: RULES.trig };
    },
    quartic: function () {
      var a = nz(-3, 3), b = nz(-4, 4), c = nz(-5, 5);
      var expr = joinTerms([term(a, 4), term(b, 2), term(c, 0)]);
      return { prompt: expr, source: a + "*x^4 + " + b + "*x^2 + " + c,
        hint: "Power rule, term by term", rule: RULES.power };
    },
    sumMixed: function () {
      var f = pick(["sin", "cos", "exp"]);
      var a = nz(-4, 4);
      var fname = f === "exp" ? "e^x" : f + "(x)";
      var fsrc = f === "exp" ? "exp(x)" : f + "(x)";
      return { prompt: joinTerms([term(a, 1), fname]), source: a + "*x + " + fsrc,
        hint: "Differentiate each part separately", rule: RULES.sum };
    },
    expSquare: function () {
      var s = pick([1, -1]);
      var inner = s === 1 ? "x^2" : "-x^2";
      return { prompt: "e^(" + inner + ")", source: "exp(" + inner + ")",
        hint: "Chain rule: e^u · u′", rule: RULES.chain };
    },
    trigSquare: function () {
      var f = pick(["sin", "cos"]);
      return { prompt: f + "(x²)", source: f + "(x^2)",
        hint: "Outer derivative × 2x", rule: RULES.chain };
    },
    logChain: function () {
      var a = nz(-4, 4), b = ri(-5, 5);
      return { prompt: "ln(" + joinTerms([term(a, 1), String(b)]) + ")",
        source: "log(" + a + "*x + " + b + ")",
        hint: "Chain rule: inner′/inner", rule: RULES.chain };
    },
    sqrtChain: function () {
      var a = nz(-4, 4), b = ri(-5, 5);
      return { prompt: "√(" + joinTerms([term(a, 1), String(b)]) + ")",
        source: "sqrt(" + a + "*x + " + b + ")",
        hint: "Chain rule on x^(1/2)", rule: RULES.chain };
    },
    reciprocal: function () {
      var a = nz(-4, 4), b = nz(-5, 5);
      return { prompt: "1/(" + joinTerms([term(a, 1), String(b)]) + ")",
        source: "1/(" + a + "*x + " + b + ")",
        hint: "Write as (inner)^−1, then chain", rule: RULES.chain };
    },
    sqrt: function () {
      var a = nz(-4, 4);
      var coef = a === 1 ? "" : a === -1 ? "-" : a;
      return { prompt: coef + "√x", source: a + "*sqrt(x)", hint: "√x = x^(1/2)", rule: RULES.power };
    }
  };

  var POOLS = {
    warmup: ["polynomial", "power", "trig", "exp", "sqrt", "sumMixed"],
    steady: ["polynomial", "quartic", "trig", "tan", "exp", "log", "logChain",
      "chainPoly", "product", "reciprocal", "sqrtChain", "sumMixed"],
    spicy: ["quartic", "tan", "expChain", "expSquare", "chainTrig", "trigSquare",
      "chainPoly", "product", "quotient", "log", "logChain", "reciprocal"]
  };

  // Anti-repeat: no identical source twice in a row, and no repeat
  // of anything seen in the last few tickets.
  var lastKey = null, recentSources = [];

  // A problem is only fair if answers to it can actually be checked:
  // count sample points where the problem itself evaluates finite.
  // (The checker skips points where either side is non-finite, so this
  // is the pool of points a correct answer is verified against.)
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
    var key, p, tries = 0, ok = false;
    do {
      key = pick(pool);
      p = generators[key]();
      // parseable source of truth + expected derivative
      var ast = global.Algebra.parse(p.source);
      p.ast = ast;
      p.expected = global.Algebra.simplify(global.Algebra.differentiate(ast));
      tries++;
      // Fairness is unconditional: never deal a problem whose answer
      // cannot be checked. Freshness is best-effort with a generous
      // budget — a hard cap would return the last candidate unchecked.
      var fair = coverage(p.ast) >= 5;
      var fresh = key !== lastKey && recentSources.indexOf(p.source) < 0;
      ok = fair && (fresh || tries > 200);
    } while (!ok);
    lastKey = key;
    recentSources.push(p.source);
    if (recentSources.length > 12) recentSources.shift();
    p.difficulty = difficulty;
    p.solution = global.Algebra.toString(p.expected);
    return p;
  }

  global.Problems = { generate: generate, pools: POOLS, rules: RULES };
})(typeof window !== "undefined" ? window : globalThis);
