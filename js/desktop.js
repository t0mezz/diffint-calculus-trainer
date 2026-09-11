/* desktop.js — clock, draggable icons, click sounds, 3DS-style launch. */
(function () {
  "use strict";

  var icons = [
    document.getElementById("diffIcon"),
    document.getElementById("simpIcon"),
    document.getElementById("intIcon")
  ];
  var flash = document.getElementById("flash");
  var clock = document.getElementById("clock");
  var sndToggle = document.getElementById("sndToggle");

  // Soft "thock": a low, pitch-dropping body under a muffled tap,
  // rendered into one buffer and rounded off by a lowpass. No assets.
  var actx = null;
  function clickSound(gain) {
    if (!sndToggle.checked) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === "suspended") actx.resume();
      var sr = actx.sampleRate, dur = 0.09;
      var buf = actx.createBuffer(1, Math.floor(sr * dur), sr);
      var d = buf.getChannelData(0);
      // slight per-press pitch jitter so repeats don't sound canned
      var f0 = 320 * (0.95 + Math.random() * 0.1), f1 = f0 * 0.55;
      var phase = 0;
      for (var i = 0; i < d.length; i++) {
        var t = i / sr;
        var freq = f1 + (f0 - f1) * Math.exp(-t / 0.012);
        phase += 2 * Math.PI * freq / sr;
        var attack = Math.min(1, t / 0.0005); // no pop at onset
        var body = Math.sin(phase) * Math.exp(-t / 0.018);
        var tap = (Math.random() * 2 - 1) * Math.exp(-t / 0.0015) * 0.6;
        var tick = Math.sin(2 * Math.PI * 2600 * t) * Math.exp(-t / 0.002) * 0.25;
        d[i] = attack * (body + tap + tick);
      }
      var src = actx.createBufferSource();
      src.buffer = buf;
      var f = actx.createBiquadFilter();
      f.type = "lowpass"; f.frequency.value = 4000;
      var g = actx.createGain();
      g.gain.value = gain || 0.25;
      src.connect(f); f.connect(g); g.connect(actx.destination);
      src.start();
    } catch (e) { /* silent desktop */ }
  }

  function tick() {
    var d = new Date();
    var h = d.getHours() % 12 || 12;
    var m = ("0" + d.getMinutes()).slice(-2);
    clock.textContent = h + ":" + m + " ";
  }
  tick();
  setInterval(tick, 15000);

  // Retro arrow cursor: the drawn arrow follows the pointer 1:1 while
  // the native one hides — fine pointers only, so touch is untouched.
  // (No cursor animation, so reduced-motion needs no special path.)
  var cursorEl = document.getElementById("cursor");
  var finePointer = window.matchMedia("(pointer: fine)").matches;
  if (finePointer) {
    document.addEventListener("mousemove", function (e) {
      cursorEl.style.transform =
        "translate(" + e.clientX + "px," + e.clientY + "px)";
      cursorEl.classList.add("on");
    });
    document.addEventListener("mouseout", function (e) {
      if (!e.relatedTarget) cursorEl.classList.remove("on");
    });
  }

  var went = false;
  var ghost = null;
  function go(href) {
    if (went) return;
    went = true;
    window.location.href = href;
  }

  // Back-button hygiene: leave the desktop exactly as it was —
  // no clone, no flash, no selection, relaunchable.
  function reset() {
    if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
    ghost = null;
    flash.classList.remove("on");
    icons.forEach(function (ic) { ic.classList.remove("selected"); });
    opened = false;
    went = false;
    relayout(); // the window may have changed size while we were away
  }
  window.addEventListener("pageshow", reset);

  var opened = false;
  function open(icon) {
    if (opened) return;
    opened = true;
    // no selection highlight: the label never turns blue — not on
    // press, not mid-drag, not during launch
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      go(icon.getAttribute("data-href"));
      return;
    }
    // 3DS-style: a translucent copy pops over the stationary icon,
    // melts away under a white flash, then the trainer boots.
    var pic = icon.querySelector(".icon-pic");
    var r = pic.getBoundingClientRect();
    ghost = pic.cloneNode(true);
    ghost.classList.add("ghost");
    ghost.setAttribute("aria-hidden", "true");
    function px(v) { return Math.round(v) + "px"; }
    ghost.style.left = px(r.left);
    ghost.style.top = px(r.top);
    ghost.style.width = px(r.width);
    ghost.style.height = px(r.height);
    document.body.appendChild(ghost);
    // force layout so the transition starts at icon size
    void ghost.offsetWidth;
    ghost.classList.add("go");
    setTimeout(function () {
      ghost.style.opacity = "0";
      flash.classList.add("on");
    }, 230);
    setTimeout(function () { go(icon.getAttribute("data-href")); }, 380);
  }

  // Draggable icons: lift while held, free placement, click-vs-drag
  // disambiguation (a real drag never launches). Position resets on
  // every load — nothing is remembered.
  var drag = null; // at most one active drag: { icon, dx, dy, sx, sy, moved }

  // Clamp inside the desktop itself so the icon never slides under the
  // menu bar or off screen.
  function place(icon, x, y) {
    var pad = icon.offsetParent || {
      clientWidth: window.innerWidth, clientHeight: window.innerHeight
    };
    x = Math.max(0, Math.min(x, pad.clientWidth - icon.offsetWidth));
    y = Math.max(0, Math.min(y, pad.clientHeight - icon.offsetHeight));
    icon.style.left = Math.round(x) + "px";
    icon.style.top = Math.round(y) + "px";
  }

  // Home grid margins mirror css/desktop.css --pad-x/--pad-y
  // (test/desktop.js keeps them in sync); the horizontal gap between
  // icons equals the viewport margin PAD_X.
  var PAD_X = 48, PAD_Y = 40;

  function desk() {
    return icons[0].offsetParent || {
      clientWidth: window.innerWidth, clientHeight: window.innerHeight
    };
  }

  // Lay out every icon the user has not placed themselves on a grid
  // that always fits the current screen: as many columns as fit side
  // by side, wrapping into rows on narrow screens. User-dragged icons
  // keep their spot, clamped on screen. A fresh load homes everyone —
  // nothing is remembered across loads.
  function relayout() {
    var pad = desk();
    var iw = icons[0].offsetWidth || 93;
    var ih = icons[0].offsetHeight || 116;
    var cols = Math.max(1, Math.floor((pad.clientWidth - PAD_X) / (iw + PAD_X)));
    icons.forEach(function (icon, i) {
      if (drag && drag.icon === icon) return;
      if (icon._moved) { clamp(icon); return; }
      var c = i % cols, r = Math.floor(i / cols);
      place(icon, PAD_X + c * (iw + PAD_X), PAD_Y + r * (ih + PAD_Y));
    });
  }
  function clamp(icon) {
    var x = parseInt(icon.style.left, 10);
    var y = parseInt(icon.style.top, 10);
    if (isNaN(x) || isNaN(y)) return;
    place(icon, x, y);
  }
  window.addEventListener("resize", relayout);
  window.addEventListener("load", relayout); // styles may land after this script
  relayout();

  icons.forEach(function (icon) {
    icon.addEventListener("pointerdown", function (e) {
      drag = {
        icon: icon,
        dx: e.clientX - icon.offsetLeft,
        dy: e.clientY - icon.offsetTop,
        sx: e.clientX, sy: e.clientY,
        moved: false
      };
      clickSound(0.25);
      try { icon.setPointerCapture(e.pointerId); } catch (err) { /* mouse */ }
    });
    icon.addEventListener("pointermove", function (e) {
      if (!drag || drag.icon !== icon) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;
      drag.moved = true;
      icon.classList.add("dragging");
      place(icon, e.clientX - drag.dx, e.clientY - drag.dy);
    });
    function endDrag() {
      if (!drag || drag.icon !== icon) return;
      icon.classList.remove("dragging");
      if (drag.moved) {
        icon._suppressClick = true;
        icon._moved = true; // user-placed: relayout clamps it, never rehomes it
        clickSound(0.15); // soft set-down tick
      }
      drag = null;
    }
    icon.addEventListener("pointerup", function () { endDrag(); });
    icon.addEventListener("pointercancel", function () { endDrag(); });

    icon.addEventListener("click", function () {
      if (icon._suppressClick) { icon._suppressClick = false; return; }
      open(icon);
    });
  });
})();
