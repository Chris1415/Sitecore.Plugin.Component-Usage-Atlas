/* ============================================================
   Component Usage Atlas — POC v1 "Atlas Cartographer"
   Screen routing + drawer toggling + theme toggle + fake scan loop.
   Vanilla JS, no framework.
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
      html.classList.add("dark"); // shadcn convention also supported
    } else {
      html.setAttribute("data-theme", "light");
      html.classList.remove("dark");
    }
    if (themeLabel) {
      themeLabel.textContent = mode === "dark" ? "Dark" : "Light";
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
    { id: "screen-1", label: "1 · Widget · Initial scan",        kind: "widget" },
    { id: "screen-2", label: "2 · Widget · Scan complete",        kind: "widget" },
    { id: "screen-3", label: "3 · Widget · Drawer open",          kind: "widget" },
    { id: "screen-4", label: "4 · Panel · Page context",          kind: "panel"  },
    { id: "screen-5", label: "5 · Panel · Counter drawer",        kind: "panel"  },
    { id: "screen-6", label: "6 · Skipped pages sub-drawer",      kind: "widget" }
  ];

  function showScreen(id) {
    var screens = document.querySelectorAll(".screen");
    for (var i = 0; i < screens.length; i++) {
      screens[i].classList.toggle("is-active", screens[i].id === id);
    }
    var navItems = document.querySelectorAll(".screen-nav__item");
    for (var j = 0; j < navItems.length; j++) {
      navItems[j].classList.toggle(
        "is-active",
        navItems[j].getAttribute("data-target") === id
      );
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
  for (var i = 0; i < navItems.length; i++) {
    navItems[i].addEventListener("click", function (e) {
      var target = e.currentTarget.getAttribute("data-target");
      if (target) showScreen(target);
    });
  }

  // Open from hash on load (default to screen-2 — the canonical hero shot)
  var initial = (location.hash || "").replace("#", "");
  var validIds = SCREENS.map(function (s) { return s.id; });
  if (validIds.indexOf(initial) === -1) initial = "screen-2";
  showScreen(initial);

  /* ---------- Fake scan loop (Screen 1) ---------- */

  var scanTimer = null;
  var scanStart = null;
  var scanCancelled = false;

  var PHASES = [
    { key: "sites",      label: "Surveying sites…",   activeIndex: 0, total: 38 },
    { key: "pages",      label: "Mapping pages…",     activeIndex: 1, total: 1247 },
    { key: "components", label: "Indexing components…", activeIndex: 2, total: 1247 }
  ];

  function pad2(n) { return n < 10 ? "0" + n : "" + n; }

  function fmtElapsed(ms) {
    var s = Math.floor(ms / 1000);
    var m = Math.floor(s / 60);
    s = s % 60;
    return pad2(m) + ":" + pad2(s);
  }

  function tickScan() {
    if (scanCancelled) return;
    var elapsed = Date.now() - scanStart;
    var phaseIdx = Math.floor((elapsed / 2000) % PHASES.length);
    var phase = PHASES[phaseIdx];

    var phaseEl = document.getElementById("lv-phase");
    var counterEl = document.getElementById("lv-counter");
    var elapsedEl = document.getElementById("lv-elapsed");
    var stops = document.querySelectorAll("#screen-1 .lv-stop");

    if (phaseEl) phaseEl.textContent = phase.label;

    // counter advances during pages/components phases
    if (counterEl) {
      var current = 0;
      if (phase.key === "sites") {
        current = Math.min(38, Math.floor((elapsed % 2000) / 50));
        counterEl.textContent = current + " / " + phase.total + " sites";
      } else if (phase.key === "pages") {
        current = Math.min(phase.total, 80 + Math.floor((elapsed % 2000) / 4));
        counterEl.textContent = current + " / " + phase.total + " pages";
      } else {
        current = Math.min(phase.total, 412 + Math.floor((elapsed % 2000) / 4));
        counterEl.textContent = current + " / " + phase.total + " pages";
      }
    }

    if (elapsedEl) elapsedEl.textContent = fmtElapsed(elapsed);

    for (var i = 0; i < stops.length; i++) {
      stops[i].setAttribute(
        "data-active",
        stops[i].getAttribute("data-phase-index") === String(phase.activeIndex)
          ? "true"
          : "false"
      );
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
      // Jump to the completed view (mirrors F-3 cancel-with-act flow)
      showScreen("screen-2");
    });
  }

  /* ---------- Drawer / sub-drawer toggling ---------- */

  function setDrawer(rootEl, open, sub) {
    if (!rootEl) return;
    if (sub) {
      rootEl.classList.toggle("is-subdrawer-open", !!open);
    } else {
      rootEl.classList.toggle("is-drawer-open", !!open);
      if (!open) {
        rootEl.classList.remove("is-subdrawer-open");
      }
    }
  }

  // Screen 3 — clicking any row opens the drawer (it's already open by default)
  var s3 = document.getElementById("screen-3");
  if (s3) {
    var s3Rows = s3.querySelectorAll(".widget-table tbody tr");
    for (var r = 0; r < s3Rows.length; r++) {
      s3Rows[r].addEventListener("click", function (e) {
        for (var k = 0; k < s3Rows.length; k++) {
          s3Rows[k].classList.remove("is-active");
        }
        e.currentTarget.classList.add("is-active");
        setDrawer(s3, true, false);
      });
    }
    var s3Closers = s3.querySelectorAll("[data-close-drawer]");
    for (var c = 0; c < s3Closers.length; c++) {
      s3Closers[c].addEventListener("click", function () {
        // In screen 3 we keep the drawer open by default; clicking close
        // sends us back to the canonical scan-complete view (screen 2).
        showScreen("screen-2");
      });
    }
  }

  // Screen 5 — panel counter drawer; close goes back to screen 4
  var s5 = document.getElementById("screen-5");
  if (s5) {
    var s5Closers = s5.querySelectorAll("[data-close-drawer]");
    for (var d = 0; d < s5Closers.length; d++) {
      s5Closers[d].addEventListener("click", function () {
        showScreen("screen-4");
      });
    }
  }

  // Screen 4 → 5 — clicking any coord-badge opens the drawer screen
  var s4 = document.getElementById("screen-4");
  if (s4) {
    var s4Counters = s4.querySelectorAll(".coord-badge[data-jump='5']");
    for (var x = 0; x < s4Counters.length; x++) {
      s4Counters[x].addEventListener("click", function () {
        showScreen("screen-5");
      });
    }
  }

  // Screen 2 — "Skipped 3 pages" link opens the sub-drawer screen (6)
  var s2 = document.getElementById("screen-2");
  if (s2) {
    var skippedTriggers = s2.querySelectorAll(".skipped-link");
    for (var t = 0; t < skippedTriggers.length; t++) {
      skippedTriggers[t].addEventListener("click", function () {
        showScreen("screen-6");
      });
    }
    var s2Rows = s2.querySelectorAll(".widget-table tbody tr");
    for (var rr = 0; rr < s2Rows.length; rr++) {
      s2Rows[rr].addEventListener("click", function () {
        showScreen("screen-3");
      });
    }
  }

  // Screen 6 — close goes back to screen 2
  var s6 = document.getElementById("screen-6");
  if (s6) {
    var s6Closers = s6.querySelectorAll("[data-close-drawer]");
    for (var z = 0; z < s6Closers.length; z++) {
      s6Closers[z].addEventListener("click", function () {
        showScreen("screen-2");
      });
    }
    // Reason chips toggle pressed state (visual only)
    var chips = s6.querySelectorAll(".reason-chip");
    for (var cc = 0; cc < chips.length; cc++) {
      chips[cc].addEventListener("click", function (e) {
        var ch = e.currentTarget;
        var pressed = ch.getAttribute("aria-pressed") === "true";
        ch.setAttribute("aria-pressed", pressed ? "false" : "true");
      });
    }
  }

  /* ---------- Esc closes the active drawer / returns to safe screen ---------- */

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var current = document.querySelector(".screen.is-active");
    if (!current) return;
    if (current.id === "screen-3") showScreen("screen-2");
    else if (current.id === "screen-5") showScreen("screen-4");
    else if (current.id === "screen-6") showScreen("screen-2");
  });
})();
