/* algebra.js — tiny symbolic backbone for the differential trainer.
 * Supports: x, numbers, pi, e, + - * / ^, parens, unary minus,
 * functions: sin cos tan exp log sqrt.
 * Provides: parse(src) -> AST, differentiate(ast) -> AST,
 * toString(ast), evaluate(ast, x), equivalent(a, b) via numeric sampling.
 * No dependencies. Keep it simple and readable.
 */
(function (global) {
  "use strict";

  // ---------- AST constructors ----------
  function num(value) { return { t: "num", v: value }; }
  function variable() { return { t: "var" }; }
  function constant(name) { return { t: "const", name: name }; }
  function unary(op, a) { return { t: "un", op: op, a: a }; }
  function binary(op, a, b) { return { t: "bin", op: op, a: a, b: b }; }
  function func(name, a) { return { t: "fn", name: name, a: a }; }

  // ---------- Tokenizer ----------
  function tokenize(src) {
    var tokens = [], i = 0, ch;
    while (i < src.length) {
      ch = src[i];
      if (/\s/.test(ch)) { i++; continue; }
      if (/[0-9.]/.test(ch)) {
        var j = i, dot = false;
        while (j < src.length && /[0-9.]/.test(src[j])) {
          if (src[j] === ".") { if (dot) break; dot = true; }
          j++;
        }
        tokens.push({ t: "n", v: parseFloat(src.slice(i, j)) });
        i = j; continue;
      }
      if (/[a-zA-Z_]/.test(ch)) {
        var k = i;
        while (k < src.length && /[a-zA-Z_0-9]/.test(src[k])) k++;
        tokens.push({ t: "id", v: src.slice(i, k) });
        i = k; continue;
      }
      if ("+-*/^(),".indexOf(ch) >= 0) { tokens.push({ t: ch }); i++; continue; }
      throw new Error("Unexpected character: " + ch);
    }
    tokens.push({ t: "eof" });
    return tokens;
  }

  // ---------- Parser (precedence climbing) ----------
  function Parser(tokens) { this.toks = tokens; this.pos = 0; }
  Parser.prototype.peek = function () { return this.toks[this.pos]; };
  Parser.prototype.next = function () { return this.toks[this.pos++]; };
  Parser.prototype.expect = function (t) {
    var tok = this.next();
    if (tok.t !== t) throw new Error("Expected '" + t + "'");
    return tok;
  };

  Parser.prototype.parse = function () {
    var e = this.add();
    if (this.peek().t !== "eof") throw new Error("Trailing input");
    return e;
  };
  Parser.prototype.add = function () {
    var e = this.mul();
    for (;;) {
      var t = this.peek().t;
      if (t === "+" || t === "-") { this.next(); e = binary(t, e, this.mul()); }
      else return e;
    }
  };
  Parser.prototype.mul = function () {
    var e = this.pow();
    for (;;) {
      var t = this.peek().t;
      if (t === "*" || t === "/") { this.next(); e = binary(t, e, this.pow()); }
      else if (this.implicitMulAhead()) { e = binary("*", e, this.pow()); }
      else return e;
    }
  };
  Parser.prototype.implicitMulAhead = function () {
    var t = this.peek();
    if (t.t === "n") return true;
    if (t.t === "id") return true;
    if (t.t === "(") return true;
    return false;
  };
  Parser.prototype.pow = function () {
    var base = this.prefix();
    if (this.peek().t === "^") {
      this.next();
      var exp = this.pow(); // right associative
      return binary("^", base, exp);
    }
    return base;
  };
  Parser.prototype.prefix = function () {
    var t = this.peek();
    if (t.t === "-") { this.next(); return unary("-", this.prefix()); }
    if (t.t === "+") { this.next(); return this.prefix(); }
    return this.atom();
  };
  var FUNCS = { sin: 1, cos: 1, tan: 1, exp: 1, log: 1, ln: 1, sqrt: 1 };

  Parser.prototype.atom = function () {
    var t = this.next();
    if (t.t === "n") return num(t.v);
    if (t.t === "(") {
      var e = this.add();
      this.expect(")");
      return e;
    }
    if (t.t === "id") {
      var name = t.v.toLowerCase();
      if (name === "x") return variable();
      if (name === "pi") return constant("pi");
      if (name === "e") return constant("e");
      if (FUNCS[name]) {
        this.expect("(");
        var arg = this.add();
        this.expect(")");
        if (name === "ln") name = "log";
        return func(name, arg);
      }
      throw new Error("Unknown name: " + t.v);
    }
    throw new Error("Unexpected token");
  };

  function parse(src) {
    if (!src || !src.trim()) throw new Error("Empty expression");
    // allow ** and common aliases before tokenizing
    src = src.replace(/\*\*/g, "^");
    return new Parser(tokenize(src)).parse();
  }

  // ---------- Differentiator ----------
  function diff(n) {
    switch (n.t) {
      case "num": return num(0);
      case "var": return num(1);
      case "const": return num(0);
      case "un": return unary(n.op, diff(n.a));
      case "bin": {
        var u = n.a, v = n.b, du = diff(u), dv = diff(v);
        switch (n.op) {
          case "+": return binary("+", du, dv);
          case "-": return binary("-", du, dv);
          case "*":
            return binary("+", binary("*", du, v), binary("*", u, dv));
          case "/":
            return binary("/",
              binary("-", binary("*", du, v), binary("*", u, dv)),
              binary("^", v, num(2)));
          case "^":
            if (v.t === "num") {
              // d/dx u^n = n * u^(n-1) * du
              return binary("*",
                binary("*", v, binary("^", u, num(v.v - 1))), du);
            }
            // general: d/dx u^v = u^v * (v' ln u + v u'/u)
            return binary("*", n,
              binary("+", binary("*", dv, func("log", u)),
                binary("*", v, binary("/", du, u))));
        }
        throw new Error("Unknown operator");
      }
      case "fn": {
        var a = n.a, da = diff(a);
        var outer;
        switch (n.name) {
          case "sin": outer = func("cos", a); break;
          case "cos": outer = unary("-", func("sin", a)); break;
          case "tan":
            outer = binary("^", func("cos", a), num(-2));
            // cleaner: sec^2 via 1/cos^2
            outer = binary("/", num(1), binary("^", func("cos", a), num(2)));
            break;
          case "exp": outer = func("exp", a); break;
          case "log": outer = binary("/", num(1), a); break;
          case "sqrt":
            outer = binary("/", num(1), binary("*", num(2), func("sqrt", a)));
            break;
          default: throw new Error("Unknown function: " + n.name);
        }
        if (isOne(da)) return outer;
        return binary("*", outer, da);
      }
    }
    throw new Error("Unknown node");
  }

  function isOne(n) { return n.t === "num" && n.v === 1; }
  function isNum(n, v) { return n.t === "num" && (v === undefined || n.v === v); }

  // Push a negation inward so printing stays clean: -(2*x) -> -2*x.
  function negate(n) {
    if (n.t === "num") return num(-n.v);
    if (n.t === "un") return n.a;
    if (n.t === "bin" && n.op === "*") {
      if (n.a.t === "num") return binary("*", num(-n.a.v), n.b);
      if (n.b.t === "num") return binary("*", n.a, num(-n.b.v));
      // -((-a) * b) is a * b: strip a negated factor outright
      if (n.a.t === "un") return binary("*", n.a.a, n.b);
      if (n.b.t === "un") return binary("*", n.a, n.b.a);
      // otherwise push into the left nested product: -((2*x) * s) -> (2*x) * s negated
      if (n.a.t === "bin" && n.a.op === "*") return binary("*", negate(n.a), n.b);
      if (n.b.t === "bin" && n.b.op === "*") return binary("*", n.a, negate(n.b));
    }
    if (n.t === "bin" && n.op === "/")
      return binary("/", negate(n.a), n.b);
    if (n.t === "bin" && n.op === "+")
      return binary("+", negate(n.a), negate(n.b));
    if (n.t === "bin" && n.op === "-")
      return binary("+", negate(n.a), n.b);
    return unary("-", n);
  }

  function once(n) {
    switch (n.t) {
      case "num": case "var": case "const": return n;
      case "un": {
        var a = once(n.a);
        if (isNum(a)) return num(-a.v);
        if (a.t === "un") return a.a;
        // push the minus into products/quotients: -(2*x) -> -2*x
        if (a.t === "bin" && (a.op === "*" || a.op === "/")) return negate(a);
        if (a !== n.a) return unary(n.op, a);
        return n;
      }
      case "fn": {
        var arg = once(n.a);
        if (arg !== n.a) return func(n.name, arg);
        return n;
      }
      case "bin": {
        var l = once(n.a), r = once(n.b);
        if (isNum(l) && isNum(r)) {
          var v;
          switch (n.op) {
            case "+": v = l.v + r.v; break;
            case "-": v = l.v - r.v; break;
            case "*": v = l.v * r.v; break;
            case "/": v = l.v / r.v; break;
            case "^": v = Math.pow(l.v, r.v); break;
          }
          return num(v);
        }
        switch (n.op) {
          case "+":
            if (isNum(r, 0)) return l;
            if (isNum(l, 0)) return r;
            // a + (-e) -> a - e, at any product depth
            var negAdd = negLeading(r);
            if (negAdd) return binary("-", l, negAdd);
            break;
          case "-":
            if (isNum(r, 0)) return l;
            if (isNum(l, 0)) return negate(r);
            // a - (-e) -> a + e, at any product depth
            var negSub = negLeading(r);
            if (negSub) return binary("+", l, negSub);
            break;
          case "*":
            if (isNum(l, 0) || isNum(r, 0)) return num(0);
            if (isNum(l, 1)) return r;
            if (isNum(r, 1)) return l;
            if (isNum(l, -1)) return negate(r);
            if (isNum(r, -1)) return negate(l);
            // absorb a negation: a * -b -> -(a * b), folded inward
            if (r.t === "un") return negate(binary("*", l, r.a));
            if (l.t === "un") return negate(binary("*", l.a, r));
            // a * (1 / e) -> a / e
            if (r.t === "bin" && r.op === "/" && isNum(r.a, 1))
              return binary("/", l, r.b);
            if (l.t === "bin" && l.op === "/" && isNum(l.a, 1))
              return binary("/", r, l.b);
            // fold separated constants: -2 * (3 * e) -> -6 * e
            if (isNum(l) && r.t === "bin" && r.op === "*" && isNum(r.a))
              return binary("*", num(l.v * r.a.v), r.b);
            if (isNum(l) && r.t === "bin" && r.op === "*" && isNum(r.b))
              return binary("*", num(l.v * r.b.v), r.a);
            if (isNum(r) && l.t === "bin" && l.op === "*" && isNum(l.a))
              return binary("*", num(l.a.v * r.v), l.b);
            if (isNum(r) && l.t === "bin" && l.op === "*" && isNum(l.b))
              return binary("*", num(l.b.v * r.v), l.a);
            // scalar to the front: e * 3 -> 3 * e
            if (isNum(r) && !isNum(l)) return binary("*", r, l);
            // e * (2 * f) -> 2 * e * f: hoist a buried scalar forward
            if (!isNum(l) && r.t === "bin" && r.op === "*") {
              if (isNum(r.a)) return binary("*", r.a, binary("*", l, r.b));
              if (isNum(r.b)) return binary("*", r.b, binary("*", l, r.a));
            }
            break;
          case "/":
            if (isNum(l, 0)) return num(0);
            if (isNum(r, 1)) return l;
            // x / x -> 1 (l is nonzero here: 0/x returned above)
            if (toString(l) === toString(r)) return num(1);
            break;
          case "^":
            if (isNum(r, 0)) return num(1);
            if (isNum(r, 1)) return l;
            if (isNum(l, 0) && isNum(r) && r.v > 0) return num(0);
            if (isNum(l, 1)) return num(1);
            break;
        }
        if (l !== n.a || r !== n.b) return binary(n.op, l, r);
        return n;
      }
    }
    return n;
  }

  // Negate the leftmost negative number in a product chain, if any:
  // a + (-4 * x * e) becomes a - 4 * x * e. Returns null when clean.
  function negLeading(n) {
    if (isNum(n) && n.v < 0) return num(-n.v);
    if (n.t === "bin" && n.op === "*") {
      var a = negLeading(n.a);
      if (a) return binary("*", a, n.b);
      var b = negLeading(n.b);
      if (b) return binary("*", n.a, b);
    }
    return null;
  }

  // Simplify to a fixpoint so solutions print cleanly.
  function simplify(n) {
    var cur = n;
    for (var i = 0; i < 25; i++) {
      var next = once(cur);
      if (toString(next) === toString(cur)) return next;
      cur = next;
    }
    return cur;
  }

  // ---------- Evaluator ----------
  function evaluate(n, x) {
    switch (n.t) {
      case "num": return n.v;
      case "var": return x;
      case "const": return n.name === "pi" ? Math.PI : Math.E;
      case "un": return -evaluate(n.a, x);
      case "bin": {
        var a = evaluate(n.a, x), b = evaluate(n.b, x);
        switch (n.op) {
          case "+": return a + b;
          case "-": return a - b;
          case "*": return a * b;
          case "/": return a / b;
          case "^": return Math.pow(a, b);
        }
        throw new Error("Unknown operator");
      }
      case "fn": {
        var v = evaluate(n.a, x);
        switch (n.name) {
          case "sin": return Math.sin(v);
          case "cos": return Math.cos(v);
          case "tan": return Math.tan(v);
          case "exp": return Math.exp(v);
          case "log": return Math.log(v);
          case "sqrt": return Math.sqrt(v);
        }
        throw new Error("Unknown function");
      }
    }
    throw new Error("Unknown node");
  }

  // ---------- Pretty printer ----------
  function prec(n) {
    if (n.t === "num" || n.t === "var" || n.t === "const" || n.t === "fn") return 4;
    if (n.t === "un") return 3;
    if (n.t === "bin") {
      if (n.op === "+" || n.op === "-") return 1;
      if (n.op === "*" || n.op === "/") return 2;
      return 3; // ^
    }
    return 0;
  }

  function fmtNum(v) {
    if (!isFinite(v)) return String(v);
    var r = Math.round(v);
    if (Math.abs(v - r) < 1e-9) return String(r);
    return String(Math.round(v * 1e6) / 1e6);
  }

  function toString(n) {
    switch (n.t) {
      case "num": return fmtNum(n.v);
      case "var": return "x";
      case "const": return n.name;
      case "un": {
        var s = toString(n.a);
        if (prec(n.a) < 3) s = "(" + s + ")";
        return "-" + s;
      }
      case "bin": {
        // render a + -3 as a - 3, and a - -3 as a + 3
        if ((n.op === "+" || n.op === "-") && n.b.t === "num" && n.b.v < 0) {
          var flippedN = n.op === "+" ? "-" : "+";
          return toString(n.a) + " " + flippedN + " " + fmtNum(-n.b.v);
        }
        // render a + (-b) as a - b, and a - (-b) as a + b
        if ((n.op === "+" || n.op === "-") && n.b.t === "un") {
          var flipped = n.op === "+" ? "-" : "+";
          var p2 = prec(n), l2 = toString(n.a), r2 = toString(n.b.a);
          if (prec(n.a) < p2) l2 = "(" + l2 + ")";
          if (prec(n.b.a) <= p2) r2 = "(" + r2 + ")";
          return l2 + " " + flipped + " " + r2;
        }
        var p = prec(n), l = toString(n.a), r = toString(n.b);
        if (prec(n.a) < p) l = "(" + l + ")";
        var needParen = prec(n.b) < p || (n.op === "^" && prec(n.b) <= p) ||
          ((n.op === "-" || n.op === "/") && prec(n.b) <= p);
        if (needParen) r = "(" + r + ")";
        var op = n.op === "*" ? "*" : n.op;
        return l + " " + op + " " + r;
      }
      case "fn": return n.name + "(" + toString(n.a) + ")";
    }
    return "?";
  }

  // ---------- Equivalence: numeric sampling ----------
  // Wide spread so restricted-domain shapes (log/sqrt of a decreasing
  // linear) still land several valid points; poles/NaNs are skipped.
  var SAMPLES = [0.4, -0.7, 1.3, 2.1, -1.6, 0.9, 3.0, -2.3, 0.15, 1.7,
    -0.25, 0.75, -1.15, 2.6, -2.9, 0.05];
  function finite(v) { return typeof v === "number" && isFinite(v); }

  function equivalent(astA, astB) {
    var tested = 0;
    for (var i = 0; i < SAMPLES.length; i++) {
      var x = SAMPLES[i], fa, fb;
      try { fa = evaluate(astA, x); } catch (e) { continue; }
      try { fb = evaluate(astB, x); } catch (e) { continue; }
      if (!finite(fa) || !finite(fb)) continue;
      tested++;
      var tol = 1e-6 * Math.max(1, Math.abs(fa), Math.abs(fb));
      if (Math.abs(fa - fb) > tol) return false;
    }
    return tested >= 3;
  }

  function equivalentSrc(userSrc, expectedAst) {
    var userAst = parse(userSrc);
    return equivalent(userAst, expectedAst);
  }

  global.Algebra = {
    parse: parse, differentiate: diff, simplify: simplify, toString: toString,
    evaluate: evaluate, equivalent: equivalent, equivalentSrc: equivalentSrc,
    samplePoints: SAMPLES
  };
})(typeof window !== "undefined" ? window : globalThis);
