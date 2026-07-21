import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseS3Url, assertDashboardShape, envInt } from '../artifactStore.js';

// Pure functions only — no S3Client is ever constructed and no network is
// touched. fetchArtifact is deliberately untested here: there is no
// aws-sdk-client-mock / nock / msw in this repo, and adding one is its own
// ticket (MR 3 §6).

/** The REAL artifact the live agent produced on 2026-07-20, vendored
 *  byte-for-byte from ai-chat-plan.local/probe/artifact.json (which is
 *  git-ignored with the rest of the planning workspace). */
const PROBE_ARTIFACT_PATH = fileURLToPath(new URL('./fixtures/artifact.json', import.meta.url));

describe('parseS3Url', () => {
  it('splits bucket from key on the FIRST slash — the key keeps its slashes', () => {
    expect(parseS3Url('s3://bucket/jobs/abc/report_schema.json')).toEqual({
      bucket: 'bucket',
      key: 'jobs/abc/report_schema.json',
    });
  });

  it('accepts the real probe URL shape', () => {
    const url =
      's3://iot-query-dashboard-ai-agent-dev-dashboard-artifacts-fe0e8aa7/jobs/39f24779-a09e-4cc9-b901-0cf062c9b853/report_schema.json';
    expect(parseS3Url(url)).toEqual({
      bucket: 'iot-query-dashboard-ai-agent-dev-dashboard-artifacts-fe0e8aa7',
      key: 'jobs/39f24779-a09e-4cc9-b901-0cf062c9b853/report_schema.json',
    });
  });

  it.each([
    ['an https URL', 'https://bucket.s3.eu-central-1.amazonaws.com/jobs/a/report_schema.json'],
    ['a bucket with no key', 's3://bucket'],
    ['a bare scheme', 's3://'],
    ['an empty bucket', 's3:///key'],
    ['a trailing-slash empty key', 's3://bucket/'],
    ['an uppercase bucket', 's3://Bucket/key'],
    ['a 2-char bucket', 's3://ab/key'],
    ['a bucket with an illegal underscore', 's3://buck_et/key'],
    ['a key containing ..', 's3://bucket/jobs/../secrets.json'],
    ['an empty string', ''],
  ])('rejects %s', (_label, url) => {
    expect(parseS3Url(url)).toBeNull();
  });

  it('rejects a URL over 1024 chars', () => {
    const url = `s3://bucket/${'k'.repeat(1100)}`;
    expect(parseS3Url(url)).toBeNull();
  });

  it('is total — arbitrary junk returns null rather than throwing', () => {
    for (const junk of ['s3:/bucket/key', 'S3://bucket/key', 'file:///etc/passwd', '://', '..']) {
      expect(parseS3Url(junk)).toBeNull();
    }
  });
});

describe('assertDashboardShape', () => {
  it('accepts the real probe artifact', () => {
    const doc: unknown = JSON.parse(readFileSync(PROBE_ARTIFACT_PATH, 'utf8'));
    expect(() => assertDashboardShape(doc)).not.toThrow();
    // After the assertion narrows, the fields the result builder lifts are there.
    assertDashboardShape(doc);
    expect(doc.title).toBe('Fleet Distance & Trip Summary — Last 7 Days');
    expect(Array.isArray(doc.panels)).toBe(true);
  });

  it.each([
    ['null', null],
    ['an array', [{ title: 'x', panels: [] }]],
    ['an empty object', {}],
    ['a panels-only object with no title', { panels: [] }],
    ['a whitespace-only title', { title: '   ', panels: [] }],
    ['a non-array panels', { title: 'x', panels: {} }],
    ['a primitive', 42],
  ])('rejects %s with a MalformedArtifact error', (_label, doc) => {
    expect(() => assertDashboardShape(doc)).toThrow();
    try {
      assertDashboardShape(doc);
    } catch (err) {
      // Named so safeUserMessage maps it to the "malformed dashboard" wording
      // instead of the generic default.
      expect((err as Error).name).toBe('MalformedArtifact');
    }
  });

  it('accepts an EMPTY panels array — MISSING_PANELS is validateDashboard\'s rule, not this one\'s', () => {
    expect(() => assertDashboardShape({ title: 'x', panels: [] })).not.toThrow();
  });
});

describe('envInt — feeds every tuning knob (MR !57 review gap)', () => {
  it('rejects "0" — load-bearing: requestTimeout: 0 means NO timeout in smithy, the exact failure the throwOnRequestTimeout pin exists to prevent', () => {
    expect(envInt('0', 120_000)).toBe(120_000);
  });

  it.each([
    ['undefined', undefined],
    ['an empty string', ''],
    ['a non-number', 'abc'],
    ['a negative number', '-1'],
    ['NaN', 'NaN'],
  ])('falls back on %s', (_label, raw) => {
    expect(envInt(raw, 5_000)).toBe(5_000);
  });

  it('accepts a positive integer string', () => {
    expect(envInt('120000', 5_000)).toBe(120_000);
  });
});
