# ADR-0015: Export as v1 feature — supersedes PRD-000 OS-15

## Status

Accepted

## Context

PRD-000 OS-15 explicitly deferred *"Sort/export controls in the widget for IA / dev personas (sort by usage, CSV export, etc.)"* to Phase 2, with the rationale *"not useful for IA in v1"*. The deferral was correct under PRD-000's framing — IA / dev personas were Secondary (PRD-000 § 4) and v1 optimized for the Primary (Content Editor) persona.

PRD-001 discovery (2026-05-03) reframed the export job. The user's framing — *"see changes over time, export, use it somewhere else, share it"* — established two new editor-driven jobs that PRD-000 did not anticipate:

1. **Snapshot-over-time** — editors download today, again in two weeks, diff externally.
2. **Hand-off / share** — editors send a snapshot to a colleague, agency, or stakeholder without granting them XM Cloud access.

These are first-class Primary-persona jobs (A-PAIN-1, A-PAIN-2 in PRD-001 § 2), not IA-secondary niceties. The OS-15 framing — "IA wants CSV export" — was correct but under-scoped: every editor-driven persona benefits from export, not just IA.

PRD-001 ships **JSON + CSV + HTML** export from BOTH surfaces in v1. This is a load-bearing reversal of the PRD-000 OS-15 deferral. The reversal needs an explicit ADR so:

- `/document` and `/ship` produce a coherent CHANGELOG that names the supersession instead of contradicting PRD-000.
- Future agents reading both PRDs can resolve the apparent conflict to a single, sourced decision.
- The boundary of the supersession is precise — only the **export** half of OS-15 is rescued; the **sort-controls** half stays deferred.

## Decision

PRD-001 introduces atlas export (JSON + CSV + HTML, both surfaces) as a v1 feature.

This **supersedes the export half of PRD-000 OS-15**. The sort-controls half (per-rendering "sort by usage" et al.) remains deferred to Phase 2 unchanged.

PRD-000 OS-15 is edited in place to carry a back-reference to PRD-001 + ADR-0015. PRD-001 § 5 carries a "Cross-PRD supersession note" stating the same.

## Consequences

### Easier

- Editors get a first-class snapshot/share workflow in v1 instead of waiting for Phase 2.
- The atlas becomes useful as an **audit artifact** (snapshots can outlive the iframe session) without breaking the no-persistence ADR (snapshots live in the editor's downloads folder, not in the app).
- IA / dev personas get incidentally served — the JSON/CSV outputs satisfy their needs without a separate UX track.

### Harder

- Two PRDs to keep coherent. Future readers must understand that PRD-001 supersedes a piece of PRD-000. Mitigation: explicit cross-references in both PRDs + this ADR.
- The Phase 2 backlog now needs to clearly distinguish "drawer exports" (still TBD per PRD-001 OS-1) from "atlas exports" (shipped v1). Without that, future PRDs may re-invent OS-15 confusion.
- Bundle size budget tightens: PRD-001 NFR-1.4 caps the addition at 20KB gzipped. No client-side PDF library can fit; HTML→print-dialog is the only PDF path in v1.

### Neutral

- Architecture posture (ADR-0002, ADR-0003) is unchanged. Export adds a leaf module that reads existing atlas state and produces a Blob. No new SDK calls, no new extension points, no backend.

## Date

2026-05-03
