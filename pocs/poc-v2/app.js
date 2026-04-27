/* ============================================================
   Component Usage Atlas — POC v2 "Console Operator"
   Screen routing + CI-style segmented progress + theme toggle
   + drawer toggling. Vanilla JS, no framework.
   ============================================================ */

(function () {
  "use strict";

  /* ---------- Theme ---------- */

  var html = document.documentElement;
  var themeBtn = document.getElementById("theme-toggle");
  var themeLabel = document.getElementById("theme-toggle-label");

  function applyTheme(mode) {
    if (mode === "dark") {
      html.setAttribute("data-theme", "dark");
      html.classList.add("dark");
    } else {
      html.setAttribute("data-theme", "light");
      html.classList.remove("dark");
    }
    if (themeLabel) {
      themeLabel.textContent = mode === "dark" ? "Light" : "Dark";
    }
    if (themeBtn) {
      themeBtn.setAttribute("aria-pressed", mode === "dark" ? "true" : "false");
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

  var SCREENS = [
    { id: "screen-1", label: "1 · Widget · Scan running"   },
    { id: "screen-2", label: "2 · Widget · Scan complete"  },
    { id: "screen-3", label: "3 · Widget · Row drawer"     },
    { id: "screen-4", label: "4 · Panel · Page context"    },
    { id: "screen-5", label: "5 · Panel · Counter drawer"  },
    { id: "screen-6", label: "6 · Skipped pages report"    }
  ];

  function showScreen(id) {
    var screens = document.querySelectorAll(".screen");
    var i;
    for (i = 0; i < screens.length; i++) {
      if (screens[i].id === id) {
        screens[i].setAttribute("data-active", "true");
      } else {
        screens[i].removeAttribute("data-active");
      }
    }
    var navItems = document.querySelectorAll(".screen-nav__item");
    for (i = 0; i < navItems.length; i++) {
      if (navItems[i].getAttribute("data-target") === id) {
        navItems[i].setAttribute("aria-current", "true");
      } else {
        navItems[i].removeAttribute("aria-current");
      }
    }
    if (location.hash !== "#" + id) {
      try { history.replaceState(null, "", "#" + id); } catch (e) { /* file:// */ }
    }

    if (id === "screen-1") {
      startFakeScan();
    } else {
      stopFakeScan();
    }
  }

  // wire navigator buttons
  var navItems = document.querySelectorAll(".screen-nav__item");
  for (var n = 0; n < navItems.length; n++) {
    navItems[n].addEventListener("click", function (e) {
      var target = e.currentTarget.getAttribute("data-target");
      if (target) showScreen(target);
    });
  }

  // Open from hash on load (default to screen-2 — the canonical hero shot)
  var initial = (location.hash || "").replace("#", "");
  var validIds = SCREENS.map(function (s) { return s.id; });
  if (validIds.indexOf(initial) === -1) initial = "screen-2";
  showScreen(initial);

  /* ---------- Fake scan loop (Screen 1) — CI-style segmented progress ---------- */

  var scanTimer = null;
  var scanStart = null;
  var scanCancelled = false;

  // Three sequential phases: sites → pages → components.
  // Each phase has its own duration; advancing to the next means the prior
  // segment locks to "completed" (success-tinted).
  var PHASES = [
    { key: "sites",      label: "Surveying sites…",        total: 38,   durationMs: 2400, unit: "sites" },
    { key: "pages",      label: "Mapping pages…",          total: 1247, durationMs: 5200, unit: "pages" },
    { key: "components", label: "Indexing components…",    total: 1247, durationMs: 4400, unit: "pages" }
  ];

  function pad2(n) { return n < 10 ? "0" + n : "" + n; }

  function fmtElapsed(ms) {
    var s = Math.floor(ms / 1000);
    var m = Math.floor(s / 60);
    s = s % 60;
    return pad2(m) + ":" + pad2(s);
  }

  function pickPhase(elapsed) {
    var acc = 0;
    for (var i = 0; i < PHASES.length; i++) {
      if (elapsed < acc + PHASES[i].durationMs) {
        return {
          index: i,
          phase: PHASES[i],
          intoPhaseMs: elapsed - acc
        };
      }
      acc += PHASES[i].durationMs;
    }
    // After all phases, loop the active state on the last phase to keep
    // the clickdummy demo lively until the user hits Cancel.
    return {
      index: PHASES.length - 1,
      phase: PHASES[PHASES.length - 1],
      intoPhaseMs: PHASES[PHASES.length - 1].durationMs - 1
    };
  }

  function tickScan() {
    if (scanCancelled) return;
    var elapsed = Date.now() - scanStart;
    var picked = pickPhase(elapsed);
    var phaseIdx = picked.index;
    var phase = picked.phase;

    var phaseEl = document.getElementById("lv-phase");
    var counterEl = document.getElementById("lv-counter");
    var elapsedEl = document.getElementById("lv-elapsed");
    var kpiPagesEl = document.getElementById("lv-kpi-pages");
    var stops = document.querySelectorAll("#screen-1 .lv-stop");
    var labels = document.querySelectorAll("#screen-1 .scan-status__seg-labels > span");

    if (phaseEl) phaseEl.textContent = phase.label;

    var pct = Math.min(1, picked.intoPhaseMs / phase.durationMs);
    var current = Math.floor(phase.total * pct);
    if (counterEl) {
      counterEl.textContent = current + " / " + phase.total + " " + phase.unit;
    }
    if (elapsedEl) elapsedEl.textContent = fmtElapsed(elapsed);

    if (kpiPagesEl && phase.key !== "sites") {
      kpiPagesEl.textContent = String(current);
    } else if (kpiPagesEl && phase.key === "sites") {
      kpiPagesEl.textContent = "0";
    }

    for (var i = 0; i < stops.length; i++) {
      var stopIdx = parseInt(stops[i].getAttribute("data-phase-index"), 10);
      var state;
      if (stopIdx < phaseIdx) state = "completed";
      else if (stopIdx === phaseIdx) state = "active";
      else state = "pending";
      stops[i].setAttribute("data-state", state);
    }

    var labelTexts = [
      (phaseIdx > 0 ? "SITES 38/38" : (phaseIdx === 0 ? "SITES " + current + "/38" : "SITES —")),
      (phaseIdx > 1 ? "PAGES 1247/1247" : (phaseIdx === 1 ? "PAGES " + current + "/1247" : "PAGES —")),
      (phaseIdx === 2 ? "COMPONENTS " + current + "/1247" : (phaseIdx > 2 ? "COMPONENTS 1247/1247" : "COMPONENTS —"))
    ];
    for (var k = 0; k < labels.length; k++) {
      var lblIdx = parseInt(labels[k].getAttribute("data-state") ? k : k, 10);
      // index by position, not data-state
      labels[k].textContent = labelTexts[k];
      var lblState;
      if (k < phaseIdx) lblState = "completed";
      else if (k === phaseIdx) lblState = "active";
      else lblState = "pending";
      labels[k].setAttribute("data-state", lblState);
    }
  }

  function startFakeScan() {
    if (scanTimer) return;
    scanCancelled = false;
    scanStart = Date.now();
    tickScan();
    scanTimer = setInterval(tickScan, 200);
  }

  function stopFakeScan() {
    if (scanTimer) {
      clearInterval(scanTimer);
      scanTimer = null;
    }
  }

  var cancelBtn = document.getElementById("lv-cancel");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", function () {
      scanCancelled = true;
      stopFakeScan();
      // Cancel jumps to the canonical scan-complete view.
      showScreen("screen-2");
    });
  }

  /* ---------- Screen 2 — table row → screen 3 ---------- */

  var s2 = document.getElementById("screen-2");
  if (s2) {
    var s2Rows = s2.querySelectorAll("table.table tbody tr");
    for (var r = 0; r < s2Rows.length; r++) {
      s2Rows[r].addEventListener("click", function () {
        showScreen("screen-3");
      });
      s2Rows[r].addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          showScreen("screen-3");
        }
      });
    }
    var s2Skipped = s2.querySelectorAll(".skipped-link");
    for (var sk = 0; sk < s2Skipped.length; sk++) {
      s2Skipped[sk].addEventListener("click", function (e) {
        e.stopPropagation();
        showScreen("screen-6");
      });
    }
  }

  /* ---------- Screen 3 — drawer close → screen 2 ---------- */

  var s3 = document.getElementById("screen-3");
  if (s3) {
    var s3Closers = s3.querySelectorAll("[data-close-drawer]");
    for (var c = 0; c < s3Closers.length; c++) {
      s3Closers[c].addEventListener("click", function () {
        showScreen("screen-2");
      });
    }
    // Allow other rows to be "selected" — visual cue only.
    var s3Rows = s3.querySelectorAll("table.table tbody tr");
    for (var r3 = 0; r3 < s3Rows.length; r3++) {
      s3Rows[r3].addEventListener("click", function (e) {
        for (var x = 0; x < s3Rows.length; x++) {
          s3Rows[x].removeAttribute("aria-current");
        }
        e.currentTarget.setAttribute("aria-current", "true");
      });
    }
  }

  /* ---------- Screen 4 — counter row → screen 5 ---------- */

  var s4 = document.getElementById("screen-4");
  if (s4) {
    var s4Counters = s4.querySelectorAll(".counter-row[data-jump-counter]");
    for (var x4 = 0; x4 < s4Counters.length; x4++) {
      s4Counters[x4].addEventListener("click", function () {
        showScreen("screen-5");
      });
      s4Counters[x4].addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          showScreen("screen-5");
        }
      });
    }
  }

  /* ---------- Screen 5 — drawer close → screen 4 ---------- */

  var s5 = document.getElementById("screen-5");
  if (s5) {
    var s5Closers = s5.querySelectorAll("[data-close-drawer]");
    for (var d = 0; d < s5Closers.length; d++) {
      s5Closers[d].addEventListener("click", function () {
        showScreen("screen-4");
      });
    }
  }

  /* ---------- Screen 6 — close → screen 2 ---------- */

  var s6 = document.getElementById("screen-6");
  if (s6) {
    var s6Closers = s6.querySelectorAll("[data-close-drawer]");
    for (var z = 0; z < s6Closers.length; z++) {
      s6Closers[z].addEventListener("click", function () {
        showScreen("screen-2");
      });
    }
  }

  /* ---------- Toggle-group (density) — visual-only ---------- */

  var toggleGroups = document.querySelectorAll(".toggle-group");
  for (var tg = 0; tg < toggleGroups.length; tg++) {
    var tgBtns = toggleGroups[tg].querySelectorAll(".toggle-group__btn");
    (function (group) {
      for (var b = 0; b < group.length; b++) {
        group[b].addEventListener("click", function (e) {
          for (var bb = 0; bb < group.length; bb++) {
            group[bb].setAttribute("aria-checked", "false");
          }
          e.currentTarget.setAttribute("aria-checked", "true");
        });
      }
    })(tgBtns);
  }

  /* ---------- Esc closes drawer screens ---------- */

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var current = document.querySelector('.screen[data-active="true"]');
    if (!current) return;
    if (current.id === "screen-3") showScreen("screen-2");
    else if (current.id === "screen-5") showScreen("screen-4");
    else if (current.id === "screen-6") showScreen("screen-2");
  });
})();
