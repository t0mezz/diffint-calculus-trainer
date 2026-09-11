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
  const fire = {};
  const sndEl = { checked: true };
  let starts = 0, resumes = 0;
  const iconEl = {
    classList: klass(),
    style: {},
    offsetLeft: 48, offsetTop: 40, offsetWidth: 100, offsetHeight: 120,
    offsetParent: { clientWidth: 1200, clientHeight: 776 },
    setPointerCapture() {},
    querySelector: () => picEl,
    addEventListener: (ev, fn) => { fire[ev] = fn; },
  };
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
    iconEl, flashEl, ghostEl, timers, winListeners, setCalls, sndEl,
    get navigated() { return navigatedTo; },
    set navigated(v) { navigatedTo = v; },
    get appended() { return appended; },
    get removedEl() { return removedEl; },
    get starts() { return starts; },
    get resumes() { return resumes; },
    click() { fire["click"](); },
    ptr(ev, arg) { fire[ev](arg); },
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

// --- reset behavior: stale storage ignored on load ---
{
  const t = setup({ x: 300, y: 200 });
  assert(t.iconEl.style.left === undefined && t.iconEl.style.top === undefined,
    "position reset, got: " + t.iconEl.style.left + "/" + t.iconEl.style.top);
}

// --- stale off-screen position ignored on load ---
{
  // stored on a big monitor, loaded on a 1200x776 desktop (icon 100x120)
  const t = setup({ x: 1500, y: 900 });
  assert(t.iconEl.style.left === undefined && t.iconEl.style.top === undefined,
    "stale position ignored on load, got: " + t.iconEl.style.left + "/" + t.iconEl.style.top);
}
{
  // drag, then shrink: the dragged icon is clamped on screen
  const t = setup(null);
  t.ptr("pointerdown", { clientX: 60, clientY: 50, pointerId: 1 });
  t.ptr("pointermove", { clientX: 500, clientY: 300 });
  t.ptr("pointerup", {});
  assert(t.iconEl.style.left === "488px", "drag places icon, got: " + t.iconEl.style.left);
  const pad = t.iconEl.offsetParent;
  pad.clientWidth = 375; pad.clientHeight = 250; // rotate to a phone
  t.winListeners["resize"]();
  assert(t.iconEl.style.left === "275px" && t.iconEl.style.top === "130px",
    "resize pushes icon back on screen, got: " + t.iconEl.style.left + "/" + t.iconEl.style.top);
  pad.clientWidth = 1200; pad.clientHeight = 776;
  t.winListeners["resize"]();
  assert(t.iconEl.style.left === "275px" && t.iconEl.style.top === "130px",
    "growing back keeps the clamped spot, got: " + t.iconEl.style.left + "/" + t.iconEl.style.top);
  assert(t.setCalls.length === 0, "resize writes nothing to storage");
  pad.clientWidth = 375;
  t.winListeners["pageshow"](); // size changed while on the trainer
  assert(t.iconEl.style.left === "275px", "Back refits to the current size, got: " + t.iconEl.style.left);
}
{
  const t = setup(null);
  t.winListeners["resize"]();
  assert(t.iconEl.style.left === undefined, "unmoved icon keeps its CSS padding spot on resize");
}
{
  // a fresh load forgets even a just-completed drop
  const t = setup(null);
  t.ptr("pointerdown", { clientX: 60, clientY: 50, pointerId: 1 });
  t.ptr("pointermove", { clientX: 500, clientY: 300 });
  t.ptr("pointerup", {});
  const fresh = setup(null);
  assert(fresh.iconEl.style.left === undefined,
    "reload resets the icon, got: " + fresh.iconEl.style.left);
}

console.log(failures === 0 ? "DESKTOP PASS" : failures + " FAILURES");
process.exit(failures ? 1 : 0);
