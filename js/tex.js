/* tex.js — LaTeX-style HTML rendering for Algebra ASTs.
 * Variables italic, functions and constants upright, real stacked
 * fractions, superscripts, radical vinculum. Zero dependencies.
 * Consumes simplified ASTs; use Tex.ofSource(src) for raw input.
 */
(function (global) {
  "use strict";

  var MINUS = "\u2212";   // U+2212 minus, not a hyphen
  var THIN = "\u2009";  // thin space between word-like factors

  function rank(n) {
    if (n.t === "num" || n.t === "var" || n.t === "const" || n.t === "fn") return 4;
    if (n.t === "un") return 3;
    if (n.op === "+" || n.op === "-") return 1;
    if (n.op === "*" || n.op === "/") return 2;
    return 3; // ^
  }

  function fmtNum(v) {
    var r = Math.round(v);
    if (Math.abs(v - r) < 1e-9) return String(r);
    return String(Math.round(v * 1e6) / 1e6);
  }

  // Strip one leading negation so sums print "a - b", not "a + -b".
  // Returns the positive form, or null when n is not negated.
  function unneg(n) {
    if (n.t === "num" && n.v < 0) return { t: "num", v: -n.v };
    if (n.t === "un") return n.a;
    if (n.t === "bin" && n.op === "*") {
      var a = unneg(n.a);
      if (a) return { t: "bin", op: "*", a: a, b: n.b };
      var b = unneg(n.b);
      if (b) return { t: "bin", op: "*", a: n.a, b: b };
    }
    return null;
  }

  function paren(s) { return "(" + s + ")"; }

  function render(n) {
    switch (n.t) {
      case "num":
        return n.v < 0 ? MINUS + fmtNum(-n.v) : fmtNum(n.v);
      case "var":
        return '<i class="v">x</i>';
      case "const":
        return n.name === "pi" ? '<i class="v">\u03C0</i>' : '<span class="c">e</span>';
      case "un": {
        var inner = render(n.a);
        return MINUS + (rank(n.a) < 3 ? paren(inner) : inner);
      }
      case "fn":
        return renderFn(n);
      case "bin":
        return renderBin(n);
    }
    return "?";
  }

  function renderBin(n) {
    var l, r;
    switch (n.op) {
      case "+": {
        var pos = unneg(n.b);
        if (pos) return render(n.a) + " " + MINUS + " " + render(pos);
        return render(n.a) + " + " + render(n.b);
      }
      case "-":
        l = render(n.a);
        r = render(n.b);
        if (rank(n.b) <= 1) r = paren(r);
        return l + " " + MINUS + " " + r;
      case "*": {
        if (n.a.t === "num" && n.a.v === 1) return render(n.b);
        if (n.b.t === "num" && n.b.v === 1) return render(n.a);
        l = rank(n.a) < 2 ? paren(render(n.a)) : render(n.a);
        r = rank(n.b) < 2 ? paren(render(n.b)) : render(n.b);
        // juxtapose against numbers and groups, thin-space words: 2x(x + 3), x cos(x)
        if (n.a.t === "num" || n.b.t === "num" ||
            rank(n.a) < 2 || rank(n.b) < 2) return l + r;
        return l + THIN + r;
      }
      case "/":
        return '<span class="frac"><span class="top">' + render(n.a) +
          '</span><span class="bot">' + render(n.b) + "</span></span>";
      case "^": {
        var base = render(n.a);
        if (rank(n.a) < 3) base = paren(base);
        var exp = render(n.b);
        if (rank(n.b) < 4) exp = paren(exp);
        return base + "<sup>" + exp + "</sup>";
      }
    }
    return "?";
  }

  function renderFn(n) {
    var arg = render(n.a);
    switch (n.name) {
      case "sin": case "cos": case "tan":
        return '<span class="fn">' + n.name + "</span>" + THIN + "(" + arg + ")";
      case "exp":
        return '<span class="c">e</span><sup>' + arg + "</sup>";
      case "log":
        return '<span class="fn">ln</span>' + THIN + "(" + arg + ")";
      case "sqrt":
        return '<span class="radsign">\u221A</span><span class="rad">' + arg + "</span>";
    }
    return "?";
  }

  function ofSource(src) {
    var A = global.Algebra;
    return render(A.simplify(A.parse(src)));
  }

  global.Tex = { render: render, ofSource: ofSource };
})(typeof window !== "undefined" ? window : globalThis);
