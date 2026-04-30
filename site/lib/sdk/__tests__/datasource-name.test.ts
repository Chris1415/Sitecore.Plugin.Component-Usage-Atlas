// Coverage for the marketer-readable datasource display-name helper (S8).

import { describe, it, expect } from 'vitest';
import {
  deriveDatasourceDisplayName,
  isDatasourceGuidOnly,
} from '@/lib/sdk/datasource-name';

describe('deriveDatasourceDisplayName', () => {
  it('extracts last path segment from `local:/Data/<Name>` paths', () => {
    expect(deriveDatasourceDisplayName('local:/Data/Home Content Top Banner'))
      .toBe('Home Content Top Banner');
    expect(deriveDatasourceDisplayName('local:/Data/Home Top News'))
      .toBe('Home Top News');
  });

  it('extracts last path segment from `xpath:/sitecore/...` paths', () => {
    expect(deriveDatasourceDisplayName('xpath:/sitecore/content/Home/Foo Bar'))
      .toBe('Foo Bar');
  });

  it('extracts last segment from a leading-slash path with no scheme', () => {
    expect(deriveDatasourceDisplayName('/sitecore/content/Site/About Us'))
      .toBe('About Us');
  });

  it('falls back to "Item · <short-id>" for bare-hex GUIDs', () => {
    expect(deriveDatasourceDisplayName('1db01d13-2526-4837-ab03-89180e76769e'))
      .toBe('Item · 1db01d13');
  });

  it('falls back to "Item · <short-id>" for braced GUIDs', () => {
    expect(deriveDatasourceDisplayName('{1D626D9D-5302-4741-97FD-882DD0A5016D}'))
      .toBe('Item · 1d626d9d');
  });

  it('decodes URL-encoded segments', () => {
    expect(deriveDatasourceDisplayName('local:/Data/Hello%20World'))
      .toBe('Hello World');
  });

  it('returns the raw string when no path or GUID pattern matches', () => {
    expect(deriveDatasourceDisplayName('opaque-id')).toBe('opaque-id');
  });

  it('returns "Unnamed item" for empty input', () => {
    expect(deriveDatasourceDisplayName('')).toBe('Unnamed item');
  });
});

describe('isDatasourceGuidOnly', () => {
  it('matches bare-hex GUIDs', () => {
    expect(isDatasourceGuidOnly('1db01d13-2526-4837-ab03-89180e76769e')).toBe(true);
  });

  it('matches braced GUIDs', () => {
    expect(isDatasourceGuidOnly('{1D626D9D-5302-4741-97FD-882DD0A5016D}')).toBe(true);
  });

  it('rejects `local:` paths', () => {
    expect(isDatasourceGuidOnly('local:/Data/Foo')).toBe(false);
  });

  it('rejects opaque non-GUID strings', () => {
    expect(isDatasourceGuidOnly('ds-1')).toBe(false);
  });
});
