# ADR-0018: No client-side PDF library in v1; HTML + browser print is the only PDF route

## Status

Accepted

## Context

PRD-001 ships three export formats: JSON, CSV, HTML. The HTML format includes a `<style media="print">` stylesheet so editors can use the browser's native "Save as PDF" print dialog to produce a shareable PDF (PRD-001 IS-9, IS-10, AC-3.1, AC-3.4).

The alternative — embedding a client-side PDF library like `jsPDF`, `pdfmake`, or `pdf-lib` — was deliberately rejected during /create-prd (IS-10, OS-3, R-bullet on bundle size). The two reasons:

1. **Bundle budget.** PRD-001 NFR-1.4 caps the export-feature bundle delta at **20 KB gzipped**. `jsPDF` minified+gzipped is ≈100 KB; `pdfmake` is ≈300 KB; `pdf-lib` is ≈80 KB. Any of these blows the budget by 4-15×.
2. **Output quality.** Client-side PDF libraries fight the browser's native typography and pagination. They produce passable PDFs for trivial layouts but require significant per-document tuning for anything involving long tables, tenant-specific font scaling, or multilingual content. The atlas exports include hundreds of rendering rows with arbitrary display names — exactly the scenario where a JS PDF lib's output drifts from the on-screen design. The browser's own print engine, by contrast, handles pagination, repeated headers, page breaks, and font fallback for free.

PRD-001 OS-3 explicitly defers `jsPDF`/`pdfmake` to **Phase 2 if S8 metric shows the HTML/PDF path is meaningfully under-used due to print-dialog friction**. The default assumption is that editors who want a PDF will tolerate one extra click (Ctrl+P → Save as PDF). If the metric refutes that, the override goes through a future ADR.

This ADR captures the decision so future agents (and reviewers of any "we should add jsPDF for nicer PDFs" PR) see the explicit rejection and the metric-gate that would justify revisiting it.

## Decision

The atlas-export module v1 ships **zero PDF dependencies**. The HTML format is the only PDF route. PDF production is delegated to the browser's print dialog.

The HTML adapter (FR-2.3) emits a single self-contained HTML document with:
- Inlined CSS (no external stylesheet links, no remote fonts — per AC-3.2 / NFR-4.3).
- A `<style media="print">` block that:
  - Sets a print-friendly typography stack (`system-ui, sans-serif`, 11pt body).
  - Repeats `<thead>` across paginated pages (`thead { display: table-header-group; }`).
  - Avoids row splitting (`tr { page-break-inside: avoid; }`).
  - Hides interactive chrome (none in v1, but the rule stands).
- Cross-browser fidelity targeted at the latest two stable Chromium-based browsers, Firefox, and Safari (AC-3.3); pixel-exact equivalence is not required.

The Definition of Done audit (DoD-5) is **bundle delta ≤20 KB gzipped**, measured by `npm run build` size diff against the PRD-000 baseline. The HTML adapter's CSS payload is ~2-3 KB; the format adapters and filename builder together are well under the cap. There is no other surprise in the budget.

### Override conditions for Phase 2

This ADR is overturned **only** when one of:
- S8 metric shows fewer than 10% of HTML downloads are followed by a print-dialog action within the same session, AND editor interviews surface explicit friction with the print flow.
- A stakeholder concretely cannot use the HTML+print path (regulatory PDF/A requirement, signed-PDF requirement, etc.) — at which point the override drives a *server-side* PDF rendering path, not a client-side library, because at that scale the bundle-size argument compounds with the quality argument.

Either path requires a new ADR superseding this one. Adding a client-side PDF library opportunistically — "while we're touching the export code" — is **not** a sufficient justification.

## Consequences

### Easier

- Bundle stays small and predictable. PRD-001 NFR-1.4 (≤20 KB delta) is comfortably achievable. The size delta is dominated by the JSON serializer and the HTML adapter's prose template, neither of which has a heavy dependency.
- Test surface is small. The HTML adapter's tests are pure-string assertions; no PDF parser, no rasterization, no font-rendering snapshot to maintain.
- Print quality is the browser's problem, not ours. When Chromium ships better print-pagination logic, our output improves for free.
- The "what if a library introduces a CVE" attack surface is one library narrower.

### Harder

- Editors **must** open the HTML and trigger the print dialog manually. This is one extra step compared to "click to download a PDF directly." The friction is real but quantifiable — S8 measures it.
- Stakeholders who expect a PDF artifact in their inbox cannot get one in a single click. They get an HTML attachment they may not know how to convert. PRD-001 R7 / OQ-5 acknowledge this; the mitigation is *clearly labeling* the format option ("HTML — printable / shareable") so the expectation is set at the picker, not at the recipient's inbox.
- The HTML output's CSS print stylesheet is the *only* thing standing between a clean PDF and a broken one. If the print stylesheet regresses (unintended dark backgrounds, table overflow, font collapse), the PDF route quietly degrades. AC-3.4 + DoD-4 (UI Designer signs off on print preview at A4 + Letter) is the gate that catches this.

### Neutral

- The browser's print dialog is a minor inconsistency across editors — some editors land in Save As PDF by default, others in Print. The atlas can't paper over OS-level dialog differences. This is consistent with PRD-001 OQ-6 (recipient experience deferred).

## Date

2026-05-03
