// Exercises js/desktop.js: click -> ghost pop -> fade + flash -> boot,
// Back-button pageshow reset, reduced-motion path, and icon dragging
// (lift, free drop, click suppression, reset behavior), and keeping
// a dragged icon on screen across resizes.
// Run: node test/desktop.js   (expects DESKTOP PASS)
"use strict";
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "desktop.js"), "utf8");

function klass() {
  const s = new Set();
  return { add: (c) => s.add(c), has: (c) => s.has(c), remove: (c) => s.delete(c) };
}

// Fresh stub DOM + eval. seedPos pre-fills stale storage to prove it
// is ignored (reset behavior), reduced selects the reduced-motion path.
function setup(seedPos, reduced) {
  const timers = [];
  const winListeners = {};
  const setCalls = [];
  const store = seedPos ? { diffIconPos: JSON.stringify(seedPos) } : {};
  const flashEl = { classList: klass() };
  let appended = null, removedEl = null;
  const ghostEl = {
    classList: klass(),
    style: {},
    offsetWidth: 54,
    setAttribute() {},
    parentNode: { removeChild: (el) => { removedEl = el; } },
  };
  const picEl = {
    getBoundingClientRect: () => ({ left: 700, top: 20, width: 54, height: 54 }),
    cloneNode: () => ghostEl,
  };
  const sndEl = { checked: true };
  let starts = 0, resumes = 0;
  // one shared desktop, like the real DOM where every icon's
  // offsetParent is the same .desktop element
  const pad = { clientWidth: 1200, clientHeight: 776 };
  const makeIcon = (href) => {
    const fire = {};
    return {
      fire,
      classList: klass(),
      style: {},
      offsetLeft: 48, offsetTop: 40, offsetWidth: 100, offsetHeight: 120,
      offsetParent: pad,
      setPointerCapture() {},
      querySelector: () => picEl,
      getAttribute: (name) => (name === "data-href" ? href : null),
      addEventListener: (ev, fn) => { fire[ev] = fn; },
    };
  };
  const iconEl = makeIcon("differentiator.html");
  const iconB = makeIcon("simplifier.html");
  const iconC = makeIcon("integrator.html");
  var AudioStub = function () {
    this.state = "suspended";
    this.sampleRate = 44100;
    this.destination = {};
    this.resume = () => { resumes++; this.state = "running"; };
    this.createBuffer = (ch, n) => ({ getChannelData: () => new Float32Array(n) });
    this.createBufferSource = () => ({ connect() {}, start() { starts++; } });
    this.createBiquadFilter = () => ({ type: "", frequency: {}, connect() {} });
    this.createGain = () => ({ gain: {}, connect() {} });
  };
  global.document = {
    body: { appendChild: (el) => { appended = el; } },
    getElementById: (id) => {
      if (id === "diffIcon") return iconEl;
      if (id === "simpIcon") return iconB;
      if (id === "intIcon") return iconC;
      if (id === "flash") return flashEl;
      if (id === "clock") return { textContent: "" };
      if (id === "sndToggle") return sndEl;
      throw new Error("unexpected id " + id);
    },
  };
  let navigatedTo = null;
  global.window = {
    innerWidth: 1200, innerHeight: 800,
    location: {},
    matchMedia: () => ({ matches: !!reduced }),
    addEventListener: (ev, fn) => { winListeners[ev] = fn; },
    AudioContext: AudioStub,
  };
  Object.defineProperty(global.window.location, "href", {
    set: (v) => { navigatedTo = v; }, configurable: true,
  });
  global.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); setCalls.push([k, String(v)]); },
  };
  global.setInterval = () => 0;
  global.setTimeout = (fn) => { timers.push(fn); return 0; };

  eval.call(global, src);
  return {
    iconEl, iconB, iconC, pad, flashEl, ghostEl, timers, winListeners, setCalls, sndEl,
    get navigated() { return navigatedTo; },
    set navigated(v) { navigatedTo = v; },
    get appended() { return appended; },
    get removedEl() { return removedEl; },
    get starts() { return starts; },
    get resumes() { return resumes; },
    click() { iconEl.fire["click"](); },
    ptr(ev, arg) { iconEl.fire[ev](arg); },
    clickB() { iconB.fire["click"](); },
    ptrB(ev, arg) { iconB.fire[ev](arg); },
    clickC() { iconC.fire["click"](); },
    ptrC(ev, arg) { iconC.fire[ev](arg); },
  };
}

let failures = 0;
const assert = (c, m) => { console.log((c ? "ok: " : "FAIL: ") + m); if (!c) failures++; };

// Static guard for the lost-margin regression: the icon must start at
// the desktop padding via CSS vars, never at an unpadded 0,0.
{
  const css = fs.readFileSync(path.join(__dirname, "..", "css", "desktop.css"), "utf8");
  const m = css.match(/\.icon\s*\{([^}]*)\}/);
  const ok = m && /left:\s*var\(--pad-x\)/.test(m[1]) && /top:\s*var\(--pad-y\)/.test(m[1]);
  console.log((ok ? "ok: " : "FAIL: ") + "icon starts at desktop padding");
  if (!ok) failures++;
}

// Static guard for the JS-owned home grid: no per-icon position rules
// may fight it in CSS, and its PAD_X/PAD_Y margins must match the
// --pad-x/--pad-y viewport margins in CSS.
{
  const css = fs.readFileSync(path.join(__dirname, "..", "css", "desktop.css"), "utf8");
  const rule = (id) => {
    const r = css.match(new RegExp("#" + id + "\\s*\\{([^}]*)\\}"));
    return r ? r[1] : "";
  };
  const noOverrides = !/(left|top)\s*:/.test(rule("simpIcon")) &&
    !/(left|top)\s*:/.test(rule("intIcon")) &&
    !/(left|top)\s*:/.test(rule("diffIcon"));
  const cssPad = (name) => {
    const m = css.match(new RegExp(name + ":\\s*(\\d+)px"));
    return m ? parseInt(m[1], 10) : null;
  };
  const jm = src.match(/var PAD_X = (\d+), PAD_Y = (\d+);/);
  const ok = noOverrides && jm &&
    cssPad("--pad-x") === parseInt(jm[1], 10) &&
    cssPad("--pad-y") === parseInt(jm[2], 10);
  console.log((ok ? "ok: " : "FAIL: ") + "home grid owns icon positions, margins in sync");
  if (!ok) failures++;
}

// --- open flow, full motion ---
{
  const t = setup(null);
  t.click();
  assert(t.iconEl.classList.has("selected"), "icon selected");
  assert(t.appended === t.ghostEl, "translucent copy spawned");
  assert(t.ghostEl.classList.has("ghost") && t.ghostEl.classList.has("go"), "copy pops");
  assert(t.ghostEl.style.left === "700px" && t.ghostEl.style.width === "54px", "copy covers icon");
  assert(t.timers.length === 2, "flash + boot timers queued");
  t.timers[0]();
  assert(t.ghostEl.style.opacity === "0", "copy fades before boot");
  assert(t.flashEl.classList.has("on"), "white flash fires");
  assert(t.navigated === null, "no boot before flash");
  t.timers[1]();
  assert(t.navigated === "differentiator.html", "boots after flash");
  t.winListeners["pageshow"]();
  assert(t.removedEl === t.ghostEl, "copy removed on return");
  assert(!t.flashEl.classList.has("on"), "flash cleared on return");
  assert(!t.iconEl.classList.has("selected"), "selection cleared on return");
  t.navigated = null;
  t.timers.length = 0;
  t.click();
  assert(t.timers.length === 2, "relaunch queues timers again");
}

// --- reduced motion: straight through, nothing spawned ---
{
  const t = setup(null, true);
  t.click();
  assert(t.navigated === "differentiator.html", "reduced motion boots at once");
  assert(t.appended === null, "no copy spawned under reduced motion");
}

// --- second icon: boots the simplifier, drags independently ---
{
  const t = setup(null);
  t.clickB();
  assert(t.timers.length === 2, "second icon queues launch timers");
  t.timers[0](); t.timers[1]();
  assert(t.navigated === "simplifier.html", "second icon boots simplifier");
  t.winListeners["pageshow"]();
  assert(!t.iconEl.classList.has("selected") && !t.iconB.classList.has("selected"),
    "return clears selection on both icons");
  t.navigated = null;
  t.timers.length = 0;

  // a drag on the first icon suppresses only its own click
  const down = { clientX: 60, clientY: 50, pointerId: 1 };
  t.ptr("pointerdown", down);
  t.ptr("pointermove", { clientX: 200, clientY: 200 });
  t.ptr("pointerup", {});
  t.click();
  assert(t.timers.length === 0, "dragged icon still suppressed");
  t.clickB();
  assert(t.timers.length === 2, "other icon still launches");

  // the second icon drags too
  t.winListeners["pageshow"]();
  t.timers.length = 0;
  t.ptrB("pointerdown", down);
  t.ptrB("pointermove", { clientX: 300, clientY: 120 });
  assert(t.iconB.style.left === "288px" && t.iconB.style.top === "110px",
    "second icon follows pointer, got: " + t.iconB.style.left + "/" + t.iconB.style.top);
  t.ptrB("pointerup", {});
  t.clickB();
  assert(t.timers.length === 0, "second-icon drag never launches");
}

// --- reduced motion on the second icon ---
{
  const t = setup(null, true);
  t.clickB();
  assert(t.navigated === "simplifier.html", "reduced motion boots simplifier at once");
}

// --- third icon: boots the integrator, drags too ---
{
  const t = setup(null);
  t.clickC();
  assert(t.timers.length === 2, "third icon queues launch timers");
  t.timers[0](); t.timers[1]();
  assert(t.navigated === "integrator.html", "third icon boots integrator");
  t.winListeners["pageshow"]();
  assert(!t.iconEl.classList.has("selected") &&
    !t.iconB.classList.has("selected") &&
    !t.iconC.classList.has("selected"),
    "return clears selection on all icons");
  t.navigated = null;
  t.timers.length = 0;

  const down = { clientX: 60, clientY: 50, pointerId: 1 };
  t.ptrC("pointerdown", down);
  t.ptrC("pointermove", { clientX: 300, clientY: 400 });
  assert(t.iconC.style.left === "288px" && t.iconC.style.top === "390px",
    "third icon follows pointer, got: " + t.iconC.style.left + "/" + t.iconC.style.top);
  t.ptrC("pointerup", {});
  t.clickC();
  assert(t.timers.length === 0, "third-icon drag never launches");
}

// --- drag: jitter still opens; real drag moves, suppresses, resets ---
{
  const t = setup(null);
  const down = { clientX: 60, clientY: 50, pointerId: 1 };
  t.ptr("pointerdown", down);
  t.ptr("pointermove", { clientX: 61, clientY: 51 }); // jitter, not a drag
  t.ptr("pointerup", {});
  t.click();
  assert(t.timers.length === 2, "jitter click still opens");

  t.winListeners["pageshow"](); // reset launch flags
  t.timers.length = 0;
  t.ptr("pointerdown", down);
  assert(t.starts === 2 && t.resumes === 1, "press clicks once (context resumed)");
  t.ptr("pointermove", { clientX: 200, clientY: 200 });
  assert(t.iconEl.classList.has("dragging"), "icon lifts while dragged");
  assert(t.iconEl.style.left === "188px" && t.iconEl.style.top === "190px",
    "icon follows pointer, got: " + t.iconEl.style.left + "/" + t.iconEl.style.top);
  t.ptr("pointerup", {});
  assert(!t.iconEl.classList.has("dragging"), "lift released on drop");
  t.click();
  assert(t.timers.length === 0, "drag never launches");
  assert(t.setCalls.length === 0,
    "drop position forgotten, got: " + JSON.stringify(t.setCalls));

  t.ptr("pointerdown", down);
  t.ptr("pointermove", { clientX: 300, clientY: 300 });
  t.ptr("pointercancel", {});
  t.click();
  assert(t.timers.length === 0, "cancelled drag never launches");
  assert(t.setCalls.length === 0, "cancelled drag not remembered");

  // drop tick sounds, toggle silences everything
  const heard = t.starts;
  t.ptr("pointerdown", down);
  t.ptr("pointermove", { clientX: 250, clientY: 250 });
  t.ptr("pointerup", {});
  assert(t.starts === heard + 2, "press + set-down both sound");
  t.sndEl.checked = false;
  t.ptr("pointerdown", down);
  t.ptr("pointerup", {});
  assert(t.starts === heard + 2, "toggle mutes the desktop");
}

// --- reset behavior: stale storage ignored, icons home on the grid ---
// (stub icons are 100x120, PAD 48/40: homes are (48,40), (196,40),
// (344,40) on a 1200-wide desktop)
{
  const t = setup({ x: 300, y: 200 });
  assert(t.iconEl.style.left === "48px" && t.iconEl.style.top === "40px",
    "first icon homed, got: " + t.iconEl.style.left + "/" + t.iconEl.style.top);
  assert(t.iconB.style.left === "196px" && t.iconC.style.left === "344px",
    "row homed with viewport-margin gaps, got: " + t.iconB.style.left + "/" + t.iconC.style.left);
}

// --- stale off-screen position ignored on load ---
{
  // stored on a big monitor, loaded on a 1200x776 desktop
  const t = setup({ x: 1500, y: 900 });
  assert(t.iconEl.style.left === "48px" && t.iconEl.style.top === "40px",
    "stale position ignored, homed, got: " + t.iconEl.style.left + "/" + t.iconEl.style.top);
}
{
  // drag, then shrink: the dragged icon is clamped, the rest reflow
  const t = setup(null);
  t.ptr("pointerdown", { clientX: 60, clientY: 50, pointerId: 1 });
  t.ptr("pointermove", { clientX: 500, clientY: 300 });
  t.ptr("pointerup", {});
  assert(t.iconEl.style.left === "488px", "drag places icon, got: " + t.iconEl.style.left);
  const pad = t.pad;
  pad.clientWidth = 375; pad.clientHeight = 667; // narrow phone portrait
  t.winListeners["resize"]();
  assert(t.iconEl.style.left === "275px" && t.iconEl.style.top === "290px",
    "resize pushes dragged icon back on screen, got: " + t.iconEl.style.left + "/" + t.iconEl.style.top);
  assert(t.iconC.style.left === "48px" && t.iconC.style.top === "200px",
    "third icon wraps to row two, got: " + t.iconC.style.left + "/" + t.iconC.style.top);
  pad.clientWidth = 1200; pad.clientHeight = 776;
  t.winListeners["resize"]();
  assert(t.iconEl.style.left === "275px" && t.iconEl.style.top === "290px",
    "growing back keeps the dragged spot, got: " + t.iconEl.style.left + "/" + t.iconEl.style.top);
  assert(t.iconC.style.left === "344px" && t.iconC.style.top === "40px",
    "growing back restores the row, got: " + t.iconC.style.left + "/" + t.iconC.style.top);
  assert(t.setCalls.length === 0, "resize writes nothing to storage");
  pad.clientWidth = 375;
  t.winListeners["pageshow"](); // size changed while on the trainer
  assert(t.iconEl.style.left === "275px", "Back refits to the current size, got: " + t.iconEl.style.left);
  assert(t.iconC.style.left === "48px", "Back reflows the row, got: " + t.iconC.style.left);
}
{
  // narrow phone column: single file, everything on screen
  const t = setup(null);
  t.pad.clientWidth = 200; t.pad.clientHeight = 800;
  t.winListeners["resize"]();
  const tops = [t.iconEl, t.iconB, t.iconC].map((ic) => parseInt(ic.style.top, 10));
  const lefts = [t.iconEl, t.iconB, t.iconC].map((ic) => parseInt(ic.style.left, 10));
  assert(lefts.every((x) => x === 48), "one column at the margin, got: " + lefts);
  assert(tops[0] < tops[1] && tops[1] < tops[2], "stacked downward, got: " + tops);
  const fits = [t.iconEl, t.iconB, t.iconC].every((ic) =>
    parseInt(ic.style.left, 10) + ic.offsetWidth <= t.pad.clientWidth);
  assert(fits, "every icon fits on screen");
}
{
  const t = setup(null);
  t.winListeners["resize"]();
  assert(t.iconEl.style.left === "48px", "unmoved icons rehome on resize");
}
{
  // a fresh load forgets even a just-completed drop
  const t = setup(null);
  t.ptr("pointerdown", { clientX: 60, clientY: 50, pointerId: 1 });
  t.ptr("pointermove", { clientX: 500, clientY: 300 });
  t.ptr("pointerup", {});
  const fresh = setup(null);
  assert(fresh.iconEl.style.left === "48px" && fresh.iconEl.style.left !== "488px",
    "reload rehomes the icon, got: " + fresh.iconEl.style.left);
}

console.log(failures === 0 ? "DESKTOP PASS" : failures + " FAILURES");
process.exit(failures ? 1 : 0);
