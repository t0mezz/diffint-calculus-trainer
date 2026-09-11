/* app.js — wiring for Differentiator 1.0 (platinum).
 * Same trainer brain as before: random pool, numeric equivalence
 * checking (any equal form counts), streaks, tickets, tiny sounds.
 */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    problem: $("problem"), rule: $("ruleTag"), hint: $("hint"), no: $("probNo"),
    range: $("range"), answer: $("answer"), feedback: $("feedback"),
    stats: $("stats"), ticket: $("ticket"), ticketBody: $("ticketBody"),
    check: $("check"), next: $("next"), reveal: $("reveal"), sound: $("sound"),
    help: $("help"), helpbox: $("helpbox")
  };

  var state = { problem: null, count: 0, streak: 0, solved: 0, locked: false };

  // --- tiny sounds, no assets ---
  var audio = null;
  function blip(freq, dur, type, gain) {
    if (!els.sound.checked) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      var o = audio.createOscillator(), g = audio.createGain();
      o.type = type || "square"; o.frequency.value = freq;
      g.gain.setValueAtTime(gain || 0.05, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
      o.connect(g); g.connect(audio.destination);
      o.start(); o.stop(audio.currentTime + dur);
    } catch (e) { /* silent machine */ }
  }

  function stats() {
    els.stats.textContent = "Streak " + state.streak + " · Solved " + state.solved;
  }

  function say(msg, cls) {
    els.feedback.textContent = msg;
    els.feedback.className = "feedback" + (cls ? " " + cls : "");
  }

  function math(src) { return '<span class="math">' + src + "</span>"; }

  function newProblem() {
    blip(2200, 0.05, "square", 0.03);
    state.problem = Problems.generate(els.range.value);
    state.count++;
    state.locked = false;
    els.problem.innerHTML = Tex.ofSource(state.problem.source);
    els.rule.textContent = state.problem.rule;
    els.hint.textContent = state.problem.hint;
    els.no.textContent = "No. " + String(state.count).padStart(3, "0");
    els.answer.value = "";
    els.ticket.hidden = true;
    say("");
    stats();
    els.answer.focus();
  }

  function check() {
    if (state.locked) { newProblem(); return; }
    var raw = els.answer.value.trim();
    if (!raw) { say("Type an answer first, then press Check."); els.answer.focus(); return; }
    var ok;
    try {
      ok = Algebra.equivalentSrc(raw, state.problem.expected);
    } catch (e) {
      say("That does not parse — see the notation below.", "bad");
      blip(140, 0.18, "sawtooth", 0.07);
      return;
    }
    if (ok) {
      state.streak++;
      state.solved++;
      state.locked = true;
      blip(660, 0.09, "triangle", 0.09);
      setTimeout(function () { blip(990, 0.12, "triangle", 0.09); }, 90);
      say(state.streak >= 5 ? "Correct — " + state.streak + " in a row."
        : state.streak >= 3 ? "Correct — three straight."
        : "Correct.", "good");
    } else {
      state.streak = 0;
      blip(140, 0.18, "sawtooth", 0.07);
      say("Not quite. Hint: " + state.problem.hint, "bad");
    }
    stats();
  }

  function reveal() {
    blip(2200, 0.05, "square", 0.03);
    els.ticketBody.innerHTML = math(Tex.ofSource(state.problem.source)) +
      " &nbsp;→&nbsp; " + math(Tex.render(state.problem.expected)) +
      "<br>Any equal form is accepted.";
    els.ticket.hidden = false;
    state.streak = 0;
    stats();
  }

  els.check.addEventListener("click", check);
  els.next.addEventListener("click", newProblem);
  els.reveal.addEventListener("click", reveal);
  els.help.addEventListener("click", function () {
    blip(2200, 0.05, "square", 0.03);
    els.helpbox.hidden = !els.helpbox.hidden;
  });
  els.range.addEventListener("change", newProblem);
  els.answer.addEventListener("keydown", function (e) {
    if (e.key === "Enter") check();
  });

  newProblem();
})();
