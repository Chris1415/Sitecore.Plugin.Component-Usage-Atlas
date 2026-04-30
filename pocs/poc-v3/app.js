/* ============================================================
   Component Usage Atlas — POC v3 "Editor's Whisper"
   Screen routing + drawer toggling + theme toggle +
   narrated loading line (single-line cycling text + width fill).
   Vanilla JS, no framework. Self-contained.
   ============================================================ */

(function () {
  "use strict";

  /* ---------- Theme ---------- */

  var html = document.documentElement;
  var themeBtn = document.getElementById("theme-toggle");
  var themeLabel = themeBtn ? themeBtn.querySelector(".poc-bar__btn-label") : null;
  var themeGlyph = themeBtn ? themeBtn.querySelector(".poc-bar__btn-glyph") : null;

  function applyTheme(mode) {
    if (mode === "dark") {
      html.setAttribute("data-theme", "dark");
      html.classList.add("dark");
    } else {
      html.setAttribute("data-theme", "light");
      html.classList.remove("dark");
    }
    if (themeLabel) {
      // Label shows the action available, not the current state
      themeLabel.textContent = mode === "dark" ? "Light" : "Dark";
    }
    if (themeGlyph) {
      themeGlyph.textContent = mode === "dark" ? "◑" : "◐";
    }
    if (themeBtn) {
      themeBtn.setAttribute("aria-pressed", mode === "dark" ? "true" : "false");
      themeBtn.setAttribute(
        "aria-label",
        mode === "dark" ? "Switch to light mode" : "Switch to dark mode"
      );
    }
  }

  applyTheme("light");

  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var next = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
    });
  }

  /* ---------- Screen routing ---------- */

  var SCREEN_IDS = [
    "screen-1",
    "screen-2",
    "screen-3",
    "screen-4",
    "screen-5",
    "screen-6"
  ];

  function showScreen(id) {
    if (SCREEN_IDS.indexOf(id) === -1) return;

    var screens = document.querySelectorAll(".screen");
    for (var i = 0; i < screens.length; i++) {
      screens[i].classList.toggle("is-active", screens[i].id === id);
    }

    var navBtns = document.querySelectorAll(".navigator__btn");
    for (var j = 0; j < navBtns.length; j++) {
      var target = "screen-" + navBtns[j].getAttribute("data-goto");
      navBtns[j].classList.toggle("is-active", target === id);
      navBtns[j].setAttribute("aria-current", target === id ? "true" : "false");
    }

    if (location.hash !== "#" + id) {
      try { history.replaceState(null, "", "#" + id); } catch (e) { /* file:// */ }
    }

    if (id === "screen-1") {
      startNarration();
    } else {
      stopNarration();
    }
  }

  // Wire the floating navigator
  var navBtns = document.querySelectorAll(".navigator__btn");
  for (var n = 0; n < navBtns.length; n++) {
    navBtns[n].addEventListener("click", function (e) {
      var goto = e.currentTarget.getAttribute("data-goto");
      if (goto) showScreen("screen-" + goto);
    });
  }

  // Initial screen — read hash, default to screen-1 (loading is the canonical entry for v3)
  var initial = (location.hash || "").replace("#", "");
  if (SCREEN_IDS.indexOf(initial) === -1) initial = "screen-1";
  showScreen(initial);

  /* ---------- Narrated loading line (Screen 1) ----------
     v3's loading visual: a single line of running narration.
     Cycle phrases every ~1.3s; fill bar grows from ~5% to ~95%
     across the cycle. Loop forever (or until Stop is clicked). */

  var NARRATION = [
    "Reading sites\u2026",
    "Now mapping pages on Acme Marketing\u2026",
    "Looking at components on page 47 of 312\u2026",
    "Cataloging datasources\u2026",
    "Almost done. Cross-checking rendering identity\u2026"
  ];

  var PHRASE_INTERVAL_MS = 1300; // within the 1.2s–1.5s spec band
  var FILL_INTERVAL_MS = 80;
  var FILL_MIN = 5;
  var FILL_MAX = 95;
  var FILL_DURATION_MS = NARRATION.length * PHRASE_INTERVAL_MS;

  var narrationPhraseTimer = null;
  var narrationFillTimer = null;
  var narrationStart = null;
  var narrationPhraseIdx = 0;

  var loadingLine = document.getElementById("loading-line");
  var loadingFill = document.getElementById("loading-fill");

  function setNarrationPhrase(idx) {
    if (!loadingLine) return;
    // Update textContent only — do not replace the aria-live container.
    loadingLine.textContent = NARRATION[idx];
  }

  function tickNarrationFill() {
    if (!loadingFill) return;
    var elapsed = Date.now() - narrationStart;
    var pos = (elapsed % FILL_DURATION_MS) / FILL_DURATION_MS; // 0..1
    var width = FILL_MIN + (FILL_MAX - FILL_MIN) * pos;
    loadingFill.style.width = width.toFixed(1) + "%";
  }

  function startNarration() {
    if (narrationPhraseTimer || narrationFillTimer) return;
    narrationStart = Date.now();
    narrationPhraseIdx = 0;
    setNarrationPhrase(narrationPhraseIdx);
    if (loadingFill) loadingFill.style.width = FILL_MIN + "%";

    narrationPhraseTimer = setInterval(function () {
      narrationPhraseIdx = (narrationPhraseIdx + 1) % NARRATION.length;
      setNarrationPhrase(narrationPhraseIdx);
    }, PHRASE_INTERVAL_MS);

    narrationFillTimer = setInterval(tickNarrationFill, FILL_INTERVAL_MS);
  }

  function stopNarration() {
    if (narrationPhraseTimer) {
      clearInterval(narrationPhraseTimer);
      narrationPhraseTimer = null;
    }
    if (narrationFillTimer) {
      clearInterval(narrationFillTimer);
      narrationFillTimer = null;
    }
  }

  // Stop link cancels narration and jumps to the completed view (mirrors F-3 cancel-with-act)
  var loadingStop = document.getElementById("loading-stop");
  if (loadingStop) {
    loadingStop.addEventListener("click", function (e) {
      e.preventDefault();
      stopNarration();
      showScreen("screen-2");
    });
  }

  /* ---------- Drawer interactions ----------
     v3 keeps drawers open in their own dedicated screens (3, 5, 6).
     Closing a drawer routes back to its parent screen. */

  function wireCloseButtons(scopeEl, parentScreenId) {
    if (!scopeEl) return;
    var closers = scopeEl.querySelectorAll(".drawer__close, [data-close-drawer]");
    for (var i = 0; i < closers.length; i++) {
      closers[i].addEventListener("click", function () {
        showScreen(parentScreenId);
      });
    }
  }

  // Screen 2 — clicking the "skipped" link opens the skipped sub-drawer (screen 6).
  // Clicking a result row could open the drawer (screen 3); rail rows are placeholder
  // containers in this clickdummy, so we surface a single trigger via .rail click.
  var s2 = document.getElementById("screen-2");
  if (s2) {
    var skippedLink = document.getElementById("open-skipped-1");
    if (skippedLink) {
      skippedLink.addEventListener("click", function (e) {
        e.preventDefault();
        showScreen("screen-6");
      });
    }
    // Any element flagged with data-jump on screen-2 (future-friendly)
    var s2Jumps = s2.querySelectorAll("[data-jump]");
    for (var j2 = 0; j2 < s2Jumps.length; j2++) {
      s2Jumps[j2].addEventListener("click", function (e) {
        var to = e.currentTarget.getAttribute("data-jump");
        if (to) showScreen("screen-" + to);
      });
    }
  }

  // Screen 3 — drawer is open by default. Close → back to screen 2.
  var s3 = document.getElementById("screen-3");
  wireCloseButtons(s3, "screen-2");

  // Screen 4 — clicking any [data-jump='5'] element opens the panel drawer (screen 5)
  var s4 = document.getElementById("screen-4");
  if (s4) {
    var s4Jumps = s4.querySelectorAll("[data-jump]");
    for (var j4 = 0; j4 < s4Jumps.length; j4++) {
      s4Jumps[j4].addEventListener("click", function (e) {
        var to = e.currentTarget.getAttribute("data-jump");
        if (to) showScreen("screen-" + to);
      });
    }
  }

  // Screen 5 — close → back to screen 4
  var s5 = document.getElementById("screen-5");
  wireCloseButtons(s5, "screen-4");

  // Screen 6 — close → back to screen 2
  var s6 = document.getElementById("screen-6");
  wireCloseButtons(s6, "screen-2");

  /* ---------- Esc closes the active drawer / returns to safe screen ---------- */

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var current = document.querySelector(".screen.is-active");
    if (!current) return;
    if (current.id === "screen-3") showScreen("screen-2");
    else if (current.id === "screen-5") showScreen("screen-4");
    else if (current.id === "screen-6") showScreen("screen-2");
  });

  /* ---------- Number-key shortcuts (1–6) for fast clickdummy review ---------- */

  document.addEventListener("keydown", function (e) {
    // Ignore when typing in an input/textarea
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
      return;
    }
    if (e.key >= "1" && e.key <= "6") {
      showScreen("screen-" + e.key);
    }
  });
})();
