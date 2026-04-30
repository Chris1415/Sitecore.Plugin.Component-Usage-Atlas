'use client';

// T074 — `<DebugPanel />`. Optional in-iframe diagnostics view.
//
// Rendered only when the URL carries `?debug=1`. Reads the telemetry
// ring buffer (M2 / T072) and exposes "Copy to clipboard" so the
// editor can paste the JSON into a friction log.
//
// No PII rule is enforced at the call sites of `track()`; this panel
// just displays what's in the buffer. Per ADR-0013, the buffer is
// in-memory only — no network, no storage, no cookies.

import { useEffect, useState, useSyncExternalStore } from 'react';
import type * as React from 'react';
import { getBuffer, type TelemetryEvent } from '@/core/telemetry';
import { Button } from '@/components/ui/button';

// Per ADR-0010 / lint rule `react-hooks/set-state-in-effect`, we read
// the debug flag through `useSyncExternalStore` — same pattern as
// atlas state — instead of a `useState`+`useEffect(setState)` pair.
function subscribeNoop(): () => void {
  return () => undefined;
}

function getDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('debug') === '1';
  } catch {
    return false;
  }
}

export function DebugPanel(): React.ReactElement | null {
  const enabled = useSyncExternalStore(
    subscribeNoop,
    getDebugEnabled,
    () => false,
  );
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1_000);
    return () => window.clearInterval(id);
  }, [enabled]);

  if (!enabled) return null;

  const buffer: ReadonlyArray<TelemetryEvent> = getBuffer();

  const handleCopy = async () => {
    if (typeof navigator === 'undefined') return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(buffer, null, 2));
    } catch {
      // best-effort; clipboard may be unavailable in some sandboxes.
    }
  };

  return (
    <aside
      data-testid="debug-panel"
      data-tick={tick}
      className="debug-panel fixed bottom-4 right-4 z-50 max-h-[60vh] w-96 overflow-auto rounded-lg border border-border bg-card p-3 text-xs shadow-lg"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-muted-foreground font-mono uppercase tracking-wide">
          telemetry · {buffer.length}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          data-testid="debug-panel-copy"
        >
          Copy
        </Button>
      </div>
      <ul className="font-mono">
        {buffer.slice(-50).map((event, idx) => (
          <li key={idx} className="border-b border-border py-1">
            <span className="text-muted-foreground">{event.kind}</span>
            <span className="text-muted-foreground"> · </span>
            <span>{event.surface}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
