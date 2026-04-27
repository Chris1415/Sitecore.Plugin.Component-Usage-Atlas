// T013 — Domain types for the Component Usage Atlas.
//
// The types below split into TWO layers:
//
//   1. SDK-shaped raw types — derived directly from the Marketplace SDK's
//      `.d.ts` files (cited inline). These describe what the wrappers in
//      `lib/sdk/queries.ts` (T015, M3) actually receive from `client.query`.
//
//   2. Atlas-shaped domain types — what the rest of the app (core/,
//      components/) consumes after the wrappers normalize the SDK shapes.
//      These match § 4c-6 of the task breakdown's prose contract.
//
// Per `40-sdk-contracts.mdc` (always-on): every SDK shape below cites the
// `.d.ts` path it came from. Mock fixtures used in RED tests must match the
// declared types; if a `.d.ts` field is `string | null | undefined`, our
// fixtures cover both. T005 (this file's pair) verified the divergence
// between § 4c-6 prose and what the SDK actually ships — see the friction
// log entry dated 2026-04-27 / T005 for the diff.
//
// No `any`. No `as never`. No `as any`.

// ---------------------------------------------------------------------------
// Branded ID aliases (§ 4c-6, ADR-0005)
// ---------------------------------------------------------------------------

export type RenderingId = string;
export type DatasourceId = string;
export type PageId = string;
export type SiteId = string;
export type CollectionId = string;

// ---------------------------------------------------------------------------
// SDK-shaped raw types — sourced from the installed `.d.ts`
// ---------------------------------------------------------------------------
//
// `xmc.agent.pagesGetComponentsOnPage` returns a wrapper response — NOT a
// flat `ComponentRecord[]`. The components live at `.components`.
// Source: `node_modules/@sitecore-marketplace-sdk/xmc/dist/xmc/src/client-agent/types.gen.d.ts`
//   declare namespace Agent {
//     type ComponentModel = {
//       id: string;
//       componentId: string;
//       componentName: string;
//       dataSource?: string | null;
//       placeholder?: string | null;
//       parameters?: ComponentParametersModel | null;
//       deviceId?: string | null;
//       layoutId?: string | null;
//       componentDetails?: ComponentDetailsModel | null;
//     };
//     type GetPageComponentsResponse = {
//       pageId: string; pageName: string; pagePath: string;
//       version: number; language: string;
//       components?: Array<ComponentModel> | null;
//       /* + route, layoutEditingKind, template */
//     };
//   }
//
// OQ-A1 finding: the SDK uses `componentId` / `componentName` / `dataSource`
// (string ID, not an object) / `placeholder` (not `placeholderKey`). The
// `parameters` field is a structured `ComponentParametersModel` with named
// keys, not the open-ended `Record<string, unknown>` § 4c-6.6 expected.
// Inherited / token / personalized bindings are NOT inferable from this
// shape — they are a server-side concept; the SDK only returns the literal
// `dataSource` ID for the placement, which is exactly the "direct binding"
// per ADR-0006. This makes ADR-0006's "v1 = direct only" alignment
// straightforward.

export type SdkComponentParameters = {
  GridParameters?: string | null;
  FieldNames?: string | null;
  Styles?: string | null;
  RenderingIdentifier?: string | null;
  CSSStyles?: string | null;
  DynamicPlaceholderId?: string | null;
};

export type SdkComponentModel = {
  id: string;
  componentId: string;
  componentName: string;
  dataSource?: string | null;
  placeholder?: string | null;
  parameters?: SdkComponentParameters | null;
  deviceId?: string | null;
  layoutId?: string | null;
};

export type SdkGetPageComponentsResponse = {
  pageId: string;
  pageName: string;
  pagePath: string;
  version: number;
  language: string;
  route?: string | null;
  layoutEditingKind?: string | null;
  components?: ReadonlyArray<SdkComponentModel> | null;
};

// `xmc.agent.sitesGetSitesList` returns `ListSitesResponse = { sites: SiteBasicModel[] }`.
// Source: `node_modules/@sitecore-marketplace-sdk/xmc/dist/xmc/src/client-agent/types.gen.d.ts`
//   type SiteBasicModel = { id: string; name: string; targetHostname: string; rootPath: string; };
//   type ListSitesResponse = { sites: Array<SiteBasicModel>; }; // (response payload)
//
// OQ-A1 finding: the agent-side site list is LEAN — no `displayName`, no
// `collectionId`, no `defaultLanguage`. To get those we need
// `xmc.sites.listSites` (sites module) which returns a richer `Site[]`.
// `targetHostname` carries some display-worthy info — keep it.

export type SdkAgentSiteBasic = {
  id: string;
  name: string;
  targetHostname: string;
  rootPath: string;
};

// `xmc.sites.listSites` and `xmc.sites.retrieveSite` return the rich `Site` shape.
// Source: `node_modules/@sitecore-marketplace-sdk/xmc/dist/xmc/src/client-sites/types.gen.d.ts`
//   type Site = {
//     id?: string | null; name?: string | null; description?: string | null;
//     displayName?: string | null; collectionId?: string | null;
//     languages?: Array<string> | null; supportedLanguages?: Array<string> | null;
//     hosts?: Array<Host> | null; /* + thumbnail, permissions, errorPages, etc. */
//   };
//
// OQ-A1 finding: NO `defaultLanguage` field on `Site`. § 4c-6.4 prose
// expected one. The site-language-resolver (T021, M3) will fall back to
// `languages?.[0]` then to the v1 hardcoded `'en'` per architect's note.
// All fields are `?: T | null` — extreme defensiveness required.

export type SdkSite = {
  id?: string | null;
  name?: string | null;
  description?: string | null;
  displayName?: string | null;
  collectionId?: string | null;
  languages?: ReadonlyArray<string> | null;
  supportedLanguages?: ReadonlyArray<string> | null;
};

// `xmc.sites.listCollections` returns `Sites.SiteCollection[]`.
// Source: `node_modules/@sitecore-marketplace-sdk/xmc/dist/xmc/src/client-sites/types.gen.d.ts`
//   type SiteCollection = {
//     id?: string | null; name?: string | null; description?: string | null;
//     displayName?: string | null; sortOrder?: number | null; /* etc. */
//   };
// Note the SDK type does NOT carry a `siteIds` reverse-link — the mapping
// is done via `Site.collectionId` instead.

export type SdkSiteCollection = {
  id?: string | null;
  name?: string | null;
  displayName?: string | null;
};

// `xmc.agent.sitesGetAllPagesBySite` returns flat `Array<PageModel>` (no pagination).
// Source: `node_modules/@sitecore-marketplace-sdk/xmc/dist/xmc/src/client-agent/types.gen.d.ts`
//   type PageModel = { id: string; path: string; };
//
// OQ-A2 finding: response is a FLAT ARRAY, no pagination, no continuation token.
// OQ-A1 finding: the agent-side page model is EXTREMELY lean — only `id`
// and `path`. No `pageName`, no `siteId`, no `siteName`, no `language`,
// no `collectionId` per § 4c-6.5 prose. The wrapper (T015, M3) will need to
// enrich each `PageModel` with the calling site's metadata.

export type SdkAgentPageModel = {
  id: string;
  path: string;
};

// ---------------------------------------------------------------------------
// Atlas-shaped domain types — consumed by `core/` and `components/`.
// These match § 4c-6 prose; the wrappers in `lib/sdk/queries.ts` translate
// from SDK shapes to these.
// ---------------------------------------------------------------------------

// One unique site in the atlas. Built by `sites-enumerator.ts` (T020) by
// combining the agent-side basic info with the sites-module rich info.
export type Site = {
  readonly siteId: SiteId;
  readonly siteName: string;
  readonly displayName: string;
  readonly collectionId?: CollectionId;
  readonly defaultLanguage?: string;
};

// Lean variant returned from a single `sitesGetSitesList` call.
export type SiteSummary = {
  readonly siteId: SiteId;
  readonly siteName: string;
  readonly targetHostname: string;
  readonly rootPath: string;
};

// Full site detail used by `site-language-resolver.ts` (T021).
export type SiteDetails = {
  readonly siteId: SiteId;
  readonly siteName: string;
  readonly displayName?: string;
  readonly collectionId?: CollectionId;
  readonly languages: ReadonlyArray<string>;
};

export type Collection = {
  readonly collectionId: CollectionId;
  readonly name: string;
  readonly displayName: string;
};

// One page (route) inside a site. Enriched from the agent's lean `PageModel`
// with the calling-site context. Editor-visible name falls back to the path
// segment when the SDK doesn't provide one.
export type PageStub = {
  readonly pageId: PageId;
  readonly pageName: string;
  readonly sitePath: string;
  readonly siteId: SiteId;
  readonly siteName: string;
  readonly language: string;
  readonly collectionId?: CollectionId;
};

// One placement of a component on a page. Normalized from `SdkComponentModel`
// by the wrapper in `lib/sdk/queries.ts`. ADR-0005 / FR-8.1 / FR-8.2
// identity rules are enforced here:
//   - `renderingId` = `componentId` (the rendering definition item ID).
//   - When `componentId` is missing, the index-builder synthesizes
//     `unknown:<page-id>:<placeholder>:<index>` and sets `isUnknown: true`.
//   - `datasourceId` = `dataSource` string when present (a content item ID).
export type ComponentRecord = {
  readonly placementId: string; // ComponentModel.id — the placement-level ID
  readonly renderingId?: RenderingId; // ComponentModel.componentId
  readonly renderingName?: string; // ComponentModel.componentName
  readonly placeholderKey?: string; // ComponentModel.placeholder
  readonly datasourceId?: DatasourceId; // ComponentModel.dataSource (string)
};

// ---------------------------------------------------------------------------
// Atlas index entries
// ---------------------------------------------------------------------------

// One row in the "where is this rendering used" view.
export type RenderingUsage = {
  readonly renderingId: RenderingId;
  readonly displayName: string;
  readonly isUnknown: boolean;
  readonly pages: ReadonlyArray<PageRef>;
  readonly datasources: ReadonlyArray<DatasourceId>;
  readonly totalUsages: number;
};

// One row in the "where is this datasource used" view.
export type DatasourceUsage = {
  readonly datasourceId: DatasourceId;
  readonly displayName: string;
  readonly isMissing: boolean;
  readonly pages: ReadonlyArray<PageRef>;
  readonly renderings: ReadonlyArray<RenderingId>;
};

// A reference to a page-level usage of a rendering or datasource.
// Embeds the placement metadata needed to render drawer rows.
export type PageRef = {
  readonly pageId: PageId;
  readonly pageName: string;
  readonly sitePath: string;
  readonly siteId: SiteId;
  readonly siteName: string;
  readonly placeholderKey?: string;
};

// ---------------------------------------------------------------------------
// Skip / failure tracking (FR-7.2, ADR-0012)
// ---------------------------------------------------------------------------

export type SkipReason =
  | 'forbidden'
  | 'timeout'
  | 'not_found'
  | 'network_error'
  | 'other';

export type Skipped = {
  readonly pageId: PageId;
  readonly pageName?: string;
  readonly siteId?: SiteId;
  readonly siteName?: string;
  readonly reason: SkipReason;
  readonly cause?: string;
};

// ---------------------------------------------------------------------------
// Atlas root + state machine (architecture § 4.1, § 4.2)
// ---------------------------------------------------------------------------

export type AtlasScope =
  | { readonly kind: 'all-collections' }
  | { readonly kind: 'collection'; readonly collectionId: CollectionId };

export type AtlasTotals = {
  readonly sites: number;
  readonly pages: number;
  readonly renderings: number;
  readonly datasources: number;
  readonly skipped: number;
};

export type Atlas = {
  readonly scope: AtlasScope;
  readonly scannedAt: number; // epoch ms
  readonly isPartial: boolean;
  readonly renderingIndex: ReadonlyMap<RenderingId, RenderingUsage>;
  readonly datasourceIndex: ReadonlyMap<DatasourceId, DatasourceUsage>;
  readonly skipped: ReadonlyArray<Skipped>;
  readonly totals: AtlasTotals;
};

export type ScanPhase = 'sites' | 'pages' | 'components';

export type ScanProgress = {
  readonly phase: ScanPhase;
  readonly current: number;
  readonly total: number;
  readonly elapsedMs: number;
};

// Reasons the scan terminated in `error` state (architecture § 4.1).
export type AtlasErrorReason =
  | { readonly kind: 'no-context' }
  | { readonly kind: 'sites-fetch-failed'; readonly cause: string }
  | { readonly kind: 'unexpected'; readonly cause: string };

// Atlas state machine union. Exactly one tag carries the atlas payload.
// Transitions are validated by `core/scan-state-machine.ts` (T025).
export type AtlasState =
  | { readonly kind: 'idle' }
  | {
      readonly kind: 'scanning';
      readonly scope: AtlasScope;
      readonly progress: ScanProgress;
      readonly priorAtlas?: Atlas; // shown during refresh per FR-2.5 / AC-3.2
    }
  | { readonly kind: 'completed'; readonly atlas: Atlas }
  | { readonly kind: 'canceled'; readonly atlas: Atlas }
  | { readonly kind: 'error'; readonly reason: AtlasErrorReason; readonly priorAtlas?: Atlas };
