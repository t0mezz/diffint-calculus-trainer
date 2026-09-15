/* pool.js — shared dealing machinery for the three trainers.
 * A problem feels repetitive when its *shape* repeats, not when its
 * coefficients do: 3x² − 4x + 5 and −2x² + 6x − 1 are two draws of the
 * same exercise. So freshness is keyed on the shape (the source with
 * every number blanked), and families are drawn in proportion to the
 * variety they actually carry rather than one vote per family.
 * No dependencies. Keep it simple and readable.
 */
(function (global) {
  "use strict";

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function ri(lo, hi) {
    return lo + Math.floor(Math.random() * (hi - lo + 1));
  }

  function nz(lo, hi) {
    var v = 0;
    while (v === 0) v = ri(lo, hi);
    return v;
  }

  // The felt identity of a problem: coefficients blanked out.
  function shapeOf(source) {
    return String(source).replace(/-?\d+(\.\d+)?/g, "#");
  }

  // Remember the last n items; ask before dealing, record after.
  function Recent(max) { this.max = max; this.items = []; }
  Recent.prototype.has = function (v) { return this.items.indexOf(v) >= 0; };
  Recent.prototype.push = function (v) {
    this.items.push(v);
    while (this.items.length > this.max) this.items.shift();
  };

  // Weight each family by the variety it actually carries: sample it
  // and count the distinct shapes it produces. Without this, a
  // one-shape family like `tan` draws as often as a seven-shape one
  // like `product` and dominates what the trainee sees. The weight is
  // the square root of the shape count, not the count itself — enough
  // to stop small families hogging the deal, not so much that a plain
  // e^x disappears behind the composites. Sampling keeps the weights
  // honest as generators change; make() is pure string-building, so
  // this is cheap and runs once per pool.
  var weights = {};
  function weigh(tag, keys, make) {
    if (weights[tag]) return weights[tag];
    var table = [], total = 0;
    keys.forEach(function (key) {
      var seen = {}, n = 0;
      for (var i = 0; i < 160; i++) {
        var sh = shapeOf(make(key).source);
        if (!seen[sh]) { seen[sh] = 1; n++; }
      }
      total += n;
      // Capped so a combinatorial family (a sum of terms, with shapes
      // in the hundreds) crowds out the plain ones by at most 6:1.
      table.push({ key: key, w: Math.sqrt(Math.min(n, 36)) });
    });
    table.total = total;
    weights[tag] = table;
    return table;
  }

  function weightedPick(table) {
    var sum = 0, i;
    for (i = 0; i < table.length; i++) sum += table[i].w;
    var r = Math.random() * sum;
    for (i = 0; i < table.length; i++) {
      r -= table[i].w;
      if (r < 0) return table[i].key;
    }
    return table[table.length - 1].key;
  }

  // Anti-repeat memory lives per trainer, not per difficulty, so
  // switching range mid-session does not hand back what you just saw.
  // The shape window scales with how many shapes the pool has: a deep
  // memory over a shallow pool would collide on every draw and starve
  // whole families.
  var memories = {};
  function memoryFor(trainer, shapeCount) {
    if (!memories[trainer]) {
      var w = Math.max(3, Math.min(10, Math.floor(shapeCount / 3)));
      memories[trainer] = { shapes: new Recent(w), sources: new Recent(16) };
    }
    return memories[trainer];
  }

  // Deal one problem. make(key) builds a candidate from strings alone;
  // fair(p) parses it and says whether an answer to it can be graded.
  // Fairness is unconditional: never deal a problem whose answer cannot
  // be checked. Freshness is best-effort with a generous budget — a
  // hard cap would return the last candidate unchecked.
  function deal(opts) {
    var table = weigh(opts.trainer + ":" + opts.pool, opts.keys, opts.make);
    var mem = memoryFor(opts.trainer, table.total);
    var p, shape, tries = 0;
    for (;;) {
      p = opts.make(weightedPick(table));
      tries++;
      if (!opts.fair(p)) continue;
      shape = shapeOf(p.source);
      if ((!mem.shapes.has(shape) && !mem.sources.has(p.source)) ||
          tries > 200) break;
    }
    mem.shapes.push(shape);
    mem.sources.push(p.source);
    return p;
  }

  global.Pool = {
    deal: deal, shapeOf: shapeOf, pick: pick, ri: ri, nz: nz, Recent: Recent
  };
})(typeof window !== "undefined" ? window : globalThis);
