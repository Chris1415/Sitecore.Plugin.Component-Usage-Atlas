// T026 — Atlas deep-freeze utility (ADR-0010 immutability contract).
//
// `Object.freeze` only freezes one level of properties — it doesn't
// recurse into Maps, Sets, or nested objects. Maps in particular cannot
// be naturally frozen: `Object.freeze(new Map())` only locks the
// instance's own properties, NOT the entries the map holds (`set` /
// `delete` / `clear` still work). To enforce ADR-0010's "atlas is
// immutable past the engine boundary" contract, this module replaces
// the mutating Map methods with throwing stubs and locks every nested
// container.
//
// Defensive behavior matrix:
//   - Maps        → `set`, `delete`, `clear` throw; `Object.freeze` on the instance.
//   - Arrays      → frozen via `Object.freeze` (push/pop/shift/splice throw in strict mode).
//   - Plain objs  → `Object.freeze`. Recurse into nested objects.
//   - Primitives  → no-op (already immutable).
//
// The frozen atlas is returned in-place (same reference). UI selectors
// rely on referential identity for `useSyncExternalStore` bail-out
// semantics, so cloning here would invalidate the bail-out and force
// every subscriber to re-render after each freeze pass.

import type { Atlas } from '@/lib/sdk/types';

const lockMap = <K, V>(map: Map<K, V>): void => {
  const throwImmutable = () => {
    throw new TypeError('Atlas state is immutable past the engine boundary (ADR-0010)');
  };
  // Replace mutators with throwing stubs. We type the override loosely
  // because Map's method signatures vary by lib.dom version; the
  // contract under test is "calling these throws", not "the override
  // matches the signature precisely".
  Object.defineProperty(map, 'set', { value: throwImmutable, configurable: false, writable: false });
  Object.defineProperty(map, 'delete', { value: throwImmutable, configurable: false, writable: false });
  Object.defineProperty(map, 'clear', { value: throwImmutable, configurable: false, writable: false });
  Object.freeze(map);
};

const deepFreezeValue = (value: unknown): void => {
  if (value === null) return;
  if (typeof value !== 'object') return;
  if (Object.isFrozen(value)) return;

  if (value instanceof Map) {
    for (const entry of value.values()) {
      deepFreezeValue(entry);
    }
    lockMap(value);
    return;
  }

  if (value instanceof Set) {
    for (const entry of value.values()) {
      deepFreezeValue(entry);
    }
    Object.freeze(value);
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      deepFreezeValue(entry);
    }
    Object.freeze(value);
    return;
  }

  // Plain object — freeze own enumerable values, then the object itself.
  for (const key of Object.keys(value)) {
    deepFreezeValue((value as Record<string, unknown>)[key]);
  }
  Object.freeze(value);
};

export function freezeAtlas(atlas: Atlas): Atlas {
  deepFreezeValue(atlas);
  return atlas;
}
