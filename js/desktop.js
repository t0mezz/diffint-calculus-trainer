/* desktop.js — clock, draggable icon, click sounds, 3DS-style launch. */
(function () {
  "use strict";

  var icon = document.getElementById("diffIcon");
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

  var went = false;
  var ghost = null;
  function go() {
    if (went) return;
    went = true;
    window.location.href = "differentiator.html";
  }

  // Back-button hygiene: leave the desktop exactly as it was —
  // no clone, no flash, no selection, relaunchable.
  function reset() {
    if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
    ghost = null;
    flash.classList.remove("on");
    icon.classList.remove("selected");
    opened = false;
    went = false;
    fit(); // the window may have changed size while we were away
  }
  window.addEventListener("pageshow", reset);

  var opened = false;
  function open() {
    if (opened) return;
    opened = true;
    icon.classList.add("selected");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      go();
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
    setTimeout(go, 380);
  }

  // Draggable icon: lift while held, free placement, click-vs-drag
  // disambiguation (a real drag never launches). Position resets on
  // every load — nothing is remembered.
  var drag = null, suppressClick = false;

  // Clamp inside the desktop itself so the icon never slides under the
  // menu bar or off screen.
  function place(x, y) {
    var pad = icon.offsetParent || {
      clientWidth: window.innerWidth, clientHeight: window.innerHeight
    };
    x = Math.max(0, Math.min(x, pad.clientWidth - icon.offsetWidth));
    y = Math.max(0, Math.min(y, pad.clientHeight - icon.offsetHeight));
    icon.style.left = Math.round(x) + "px";
    icon.style.top = Math.round(y) + "px";
  }

  // Keep a dragged icon on screen when the window shrinks. A fresh
  // load always starts at the CSS padding spot.
  function fit() {
    if (drag) return;
    var x = parseInt(icon.style.left, 10);
    var y = parseInt(icon.style.top, 10);
    if (isNaN(x) || isNaN(y)) return;
    place(x, y);
  }
  window.addEventListener("resize", fit);

  icon.addEventListener("pointerdown", function (e) {
    drag = {
      dx: e.clientX - icon.offsetLeft,
      dy: e.clientY - icon.offsetTop,
      sx: e.clientX, sy: e.clientY,
      moved: false
    };
    icon.classList.add("selected");
    clickSound(0.25);
    try { icon.setPointerCapture(e.pointerId); } catch (err) { /* mouse */ }
  });
  icon.addEventListener("pointermove", function (e) {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;
    drag.moved = true;
    icon.classList.add("dragging");
    place(e.clientX - drag.dx, e.clientY - drag.dy);
  });
  function endDrag() {
    if (!drag) return;
    icon.classList.remove("dragging");
    if (drag.moved) {
      suppressClick = true;
      clickSound(0.15); // soft set-down tick
    }
    drag = null;
  }
  icon.addEventListener("pointerup", function () { endDrag(); });
  icon.addEventListener("pointercancel", function () { endDrag(); });

  icon.addEventListener("click", function () {
    if (suppressClick) { suppressClick = false; return; }
    open();
  });
})();
