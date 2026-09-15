/* intproblems.js — compositional pool of indefinite integrals.
 * Each generator returns { prompt, source, expected, hint, rule }.
 * source: the integrand. expected: one correct antiderivative
 * (parseable input for Algebra, +C omitted). prompt is kept equal to
 * source for compatibility — the pages render math with Tex.ofSource.
 *
 * Problems are composed, not enumerated: a term is a coefficient times
 * a base (power, root, reciprocal, trig or exponential, optionally on a
 * linear inner argument kx), and an integrand is one such term or a sum
 * of two or three. Sums cost nothing to grade — check() differentiates
 * the answer and compares it with the integrand, so any equal
 * antiderivative counts, with or without a constant term.
 */
(function (global) {
  "use strict";

  var ri = global.Pool.ri, pick = global.Pool.pick, nz = global.Pool.nz;

  var RULES = {
    power: "Power rule",
    trig: "Trig integrals",
    exp: "Exponential",
    log: "Logarithm",
    sum: "Sum rule"
  };

  function gcd(a, b) { return b ? gcd(b, a % b) : a; }

  // c·body, with unit coefficients collapsed.
  // NOTE: never emit a bare "-body" — the parser reads "-x^4" as
  // (-x)^4, so a negative unit needs the explicit "-1*" prefix.
  function coef(c, body) {
    if (c === 1) return body;
    if (c === -1) return "-1*" + body;
    return c + "*" + body;
  }

  // (c/d)·body, reduced to lowest terms. d > 0.
  function coefOver(c, d, body) {
    var g = gcd(Math.abs(c), d) || 1;
    c /= g; d /= g;
    return d === 1 ? coef(c, body) : coef(c, body) + "/" + d;
  }

  // Join term sources into a sum, folding leading minus signs so the
  // integrand reads "3x^2 - sin(x)" rather than "3x^2 + -sin(x)".
  function join(parts) {
    return parts.reduce(function (acc, s) {
      return s.charAt(0) === "-" ? acc + " - " + s.slice(1) : acc + " + " + s;
    });
  }

  function arg(k) { return k === 1 ? "x" : k + "*x"; }

  // ---------- terms: a base, a coefficient, and its antiderivative ----------
  // Each returns { src, anti, rule, hint }. src differentiates back
  // from anti exactly; generate() verifies that before dealing.
  var terms = {
    power: function (spicy) {
      var n = spicy ? pick([0, 1, 2, 3, 4, 5, -2]) : pick([0, 1, 2, 3]);
      var a = nz(spicy ? -6 : -4, spicy ? 6 : 4);
      if (n === -2) {
        return { src: a + "/x^2", anti: (-a) + "/x", rule: RULES.power,
          hint: "x^-2 integrates to -x^-1" };
      }
      var body = n === 0 ? null : n === 1 ? "x" : "x^" + n;
      return {
        src: body === null ? String(a) : coef(a, body),
        anti: coefOver(a, n + 1, n === 0 ? "x" : "x^" + (n + 1)),
        rule: RULES.power,
        hint: n === 0 ? "∫a dx = a·x" : "∫x^n dx = x^(n+1)/(n+1)"
      };
    },
    root: function (spicy) {
      var a = spicy ? nz(-5, 5) : pick([1, 2, 3]);
      if (Math.random() < 0.5) {
        return { src: coef(a, "sqrt(x)"), anti: coefOver(2 * a, 3, "sqrt(x)^3"),
          rule: RULES.power, hint: "√x = x^(1/2), then the power rule" };
      }
      return { src: a + "/sqrt(x)", anti: coef(2 * a, "sqrt(x)"),
        rule: RULES.power, hint: "1/√x = x^(-1/2), then the power rule" };
    },
    log: function (spicy) {
      var a = spicy ? nz(-5, 5) : pick([1, 2, 3]);
      var k = spicy ? pick([1, 1, 2, 3]) : 1;
      return {
        src: k === 1 ? a + "/x" : a + "/(" + arg(k) + ")",
        anti: coefOver(a, k, "log(x)"),
        rule: RULES.log,
        hint: k === 1 ? "∫1/x dx = ln(x)" : "Factor the " + k + " out first"
      };
    },
    trig: function (spicy) {
      var f = pick(["sin", "cos"]);
      var k = spicy ? pick([1, 2, 3, 4]) : 1;
      var a = spicy ? nz(-5, 5) : pick([1, 1, 2, 3]);
      var inner = f + "(" + arg(k) + ")";
      var other = (f === "sin" ? "cos" : "sin") + "(" + arg(k) + ")";
      return {
        src: coef(a, inner),
        anti: coefOver(f === "sin" ? -a : a, k, other),
        rule: RULES.trig,
        hint: k === 1 ? (f === "sin" ? "∫sin = -cos" : "∫cos = sin")
          : "Substitute u = " + k + "x, then divide by " + k
      };
    },
    sec2: function (spicy) {
      var k = spicy ? pick([1, 2, 3]) : 1;
      var a = spicy ? nz(-4, 4) : pick([1, 2]);
      return { src: a + "/cos(" + arg(k) + ")^2",
        anti: coefOver(a, k, "tan(" + arg(k) + ")"),
        rule: RULES.trig, hint: "1/cos² is the derivative of tan" };
    },
    exp: function (spicy) {
      var k = spicy ? pick([1, 2, 3, -1, -2]) : 1;
      var a = spicy ? nz(-5, 5) : pick([1, 1, 2, 3]);
      var inner = "exp(" + arg(k) + ")";
      return { src: coef(a, inner), anti: coefOver(a, k, inner),
        rule: RULES.exp, hint: "∫e^(kx) dx = e^(kx)/k" };
    }
  };

  // Draw n terms from distinct families, so a sum never repeats itself.
  function drawTerms(families, n, spicy) {
    var left = families.slice(), out = [];
    while (out.length < n && left.length) {
      var i = Math.floor(Math.random() * left.length);
      out.push(terms[left.splice(i, 1)[0]](spicy));
    }
    return out;
  }

  // A pool key is either a single family or a sum of several; the sum
  // is what turns a handful of bases into a combinatorial pool.
  var SUMS = { sum2: 2, sum3: 3 };

  function build(key, families, spicy) {
    if (!SUMS[key]) {
      var t = terms[key](spicy);
      return { prompt: t.src, source: t.src, expected: t.anti,
        hint: t.hint, rule: t.rule };
    }
    var ts = drawTerms(families, SUMS[key], spicy);
    var src = join(ts.map(function (t) { return t.src; }));
    return {
      prompt: src, source: src,
      expected: join(ts.map(function (t) { return t.anti; })),
      hint: "Integrate each term separately",
      rule: RULES.sum
    };
  }

  // Families a sum may draw from, per difficulty. Kept separate from
  // POOLS so a sum in "steady" cannot smuggle in a spicy-only base.
  var SUM_FAMILIES = {
    warmup: ["power", "trig", "exp"],
    steady: ["power", "root", "log", "trig", "exp"],
    spicy: ["power", "root", "log", "trig", "exp", "sec2"]
  };

  var POOLS = {
    warmup: ["power", "trig", "exp", "sum2"],
    steady: ["power", "trig", "exp", "log", "root", "sum2"],
    spicy: ["power", "trig", "exp", "log", "root", "sec2", "sum2", "sum3"]
  };

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
    var name = POOLS[difficulty] ? difficulty : "steady";
    var spicy = name === "spicy";
    var families = SUM_FAMILIES[name] || SUM_FAMILIES.steady;
    var p = global.Pool.deal({
      trainer: "integrate",
      pool: name,
      keys: POOLS[name],
      make: function (key) { return build(key, families, spicy); },
      fair: function (c) {
        // parseable source of truth + one antiderivative that
        // differentiates back to it
        c.ast = global.Algebra.parse(c.source);
        c.expectedAst = global.Algebra.simplify(
          global.Algebra.parse(c.expected));
        return coverage(c.ast) >= 5 && global.Algebra.equivalent(
          global.Algebra.differentiate(c.expectedAst), c.ast);
      }
    });
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
