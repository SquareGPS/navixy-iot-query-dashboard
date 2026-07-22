import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '../../utils/logger.js';

/** The FLAT Grafana-compatible dashboard, as the agent actually emits it.
 *  Verified against ai-chat-plan.local/probe/artifact.json: top-level keys are
 *  id, uid, title, description, tags, style, timezone, editable, graphTooltip, time,
 *  refresh, schemaVersion, version, links, panels, x-navixy.
 *  There is NO WRAPPER. doc.report_schema does not exist and must never be looked for. */
export interface DashboardSchema extends Record<string, unknown> {
  title: string;
  panels: unknown[];
}

export interface S3Location {
  bucket: string;
  key: string;
}

const MAX_URL_LEN = 1024;
const BUCKET_RE = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
/** The DOCUMENTED artifact key shape and nothing else (MR !57 review): the agent's
 *  Lambda writes exactly jobs/<uuid v4>/report_schema.json, and with only a bucket pin
 *  every other object in that bucket was still fetchable. Structure is rigid (jobs/
 *  prefix, one UUID segment, one fixed filename), hex casing is not. The `..` and
 *  empty-key rejects the shape rule subsumes are still pinned by tests. */
const KEY_RE = /^jobs\/[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}\/report_schema\.json$/;
/** Default 5 MiB. The observed artifact is 5385 bytes — ~1000x headroom — and this
 *  still bounds a pathological object out of the heap. */
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

/** PURE and TOTAL — never throws; returns null on anything it does not like.
 *  Accepts s3://<bucket>/jobs/<uuid>/report_schema.json ONLY. https:// S3 URLs are
 *  deliberately NOT accepted: the agent does not emit them, and accepting a scheme we
 *  have never observed widens the fetch surface for nothing. */
export function parseS3Url(url: string): S3Location | null {
  if (!url || url.length > MAX_URL_LEN) return null;
  if (!url.startsWith('s3://')) return null;
  const rest = url.slice('s3://'.length);
  const slash = rest.indexOf('/');
  if (slash <= 0) return null;
  const bucket = rest.slice(0, slash);
  // The key CONTAINS slashes (jobs/<job-id>/report_schema.json). Split on the FIRST
  // slash only and never re-split.
  const key = rest.slice(slash + 1);
  if (!BUCKET_RE.test(bucket)) return null;
  if (!KEY_RE.test(key)) return null;
  return { bucket, key };
}

let s3: S3Client | null = null;

function getS3(): S3Client {
  if (s3) return s3;
  // Same region and same DEFAULT CREDENTIAL CHAIN as the Bedrock client (D20). A
  // SEPARATE client because it is a separate service with a different retry profile:
  // GetObject is idempotent, so unlike InvokeAgent (a retry reuses the sessionId and may
  // double-append to Bedrock's server-side memory, R20) it is safe to retry freely.
  // Leave maxAttempts at the SDK default of 3; do NOT copy InvokeAgent's 2 reflexively.
  s3 = new S3Client({
    region: process.env.AWS_REGION ?? 'eu-central-1',
    requestHandler: {
      connectionTimeout: 3_000,
      requestTimeout: 15_000, // measured: 5385 bytes in 235 ms. 15s is ~60x headroom.
      throwOnRequestTimeout: true,
    },
  });
  return s3;
}

/** Test-only. Lets a future integration test swap the client without jest.mock, which is
 *  unusable under ESM + --experimental-vm-modules. Production never calls it. */
export function __resetS3ClientForTests(): void {
  s3 = null;
}

export async function fetchArtifact(loc: S3Location, signal: AbortSignal): Promise<unknown> {
  // SSRF-shaped guard, FAIL CLOSED (MR !57 review). The bucket name arrives inside
  // LLM-GENERATED PROSE. An agent that is confused — or prompt-injected through a
  // dashboard title — could name a different bucket, and GetObject against an arbitrary
  // bucket with our credentials is a real, if small, capability leak. An unset pin used
  // to fail OPEN as a dev convenience; it no longer does: bedrockAgent refuses the whole
  // turn in buildInvokeInput, and this guard keeps the property true for any future
  // caller of this exported function. Nothing outside the pinned bucket is readable.
  const allowed = process.env.BEDROCK_ARTIFACT_BUCKET?.trim();
  if (!allowed) {
    throw namedError('ArtifactBucketUnpinned', 'BEDROCK_ARTIFACT_BUCKET is not set');
  }
  if (loc.bucket !== allowed) {
    logger.error('[Agent] ARTIFACT_BUCKET_MISMATCH', { requested: loc.bucket, allowed });
    throw namedError('ArtifactBucketMismatch', `Artifact bucket not allowed: ${loc.bucket}`);
  }

  const maxBytes = envInt(process.env.AGENT_ARTIFACT_MAX_BYTES, DEFAULT_MAX_BYTES);
  const t0 = Date.now();

  const res = await getS3().send(
    new GetObjectCommand({ Bucket: loc.bucket, Key: loc.key }),
    { abortSignal: signal }, // the SAME ctx.signal — the S3 leg is INSIDE the turn deadline
  );

  if (!res.Body) throw new Error('Empty artifact body');

  // Check ContentLength BEFORE consuming the body. Never transformToString() an unbounded
  // object into the heap.
  if (typeof res.ContentLength === 'number' && res.ContentLength > maxBytes) {
    // Tear the unconsumed body down or the keep-alive socket never returns to
    // the pool (MR !57 review; reproduced against the installed handler).
    (res.Body as unknown as { destroy?: (error?: Error) => void }).destroy?.();
    throw namedError('ArtifactTooLarge', `Artifact too large: ${res.ContentLength} > ${maxBytes}`);
  }

  const text = await res.Body.transformToString();

  // ContentLength is absent on a chunked response. Belt and braces: the string is already
  // in memory here, so this bounds the PARSE rather than the read. It is the weaker of the
  // two checks and it is here on purpose — S3 sets ContentLength in practice.
  if (text.length > maxBytes) {
    throw namedError('ArtifactTooLarge', `Artifact too large: ${text.length} > ${maxBytes}`);
  }

  logger.info('[Agent] Artifact fetched', {
    bucket: loc.bucket,
    key: loc.key,
    bytes: text.length,
    ms: Date.now() - t0,
  });

  try {
    return JSON.parse(text) as unknown; // SyntaxError maps to the malformed message in chat()
  } catch (err) {
    // The only place the raw text exists — chat()'s catch cannot log what it never saw.
    // 2000-char cap mirrors the reference implementation's own payload-logging cap.
    logger.error('[Agent] Artifact is not valid JSON', {
      bucket: loc.bucket,
      key: loc.key,
      rawPreview: text.slice(0, 2000),
    });
    throw err;
  }
}

/**
 * Shape check — DELIBERATELY SHALLOW. Per-panel structure, gridPos sanity and SQL safety
 * are validateDashboard's job (MR 1), which runs on the ROUTE side.
 *
 * READ THIS BEFORE ADDING A RULE HERE. Neither this function nor validateDashboard is a
 * CORRECTNESS gate. The probe's own artifact passed every static check we have and still
 * contained a panel that fails at execution with `42703 column o.employee_id does not
 * exist` — a hallucinated column on a table the agent otherwise knew correctly. No static
 * validator can catch that class; only running the query can. PREVIEW-BEFORE-APPLY is the
 * actual safety mechanism. Rules added here make the output WELL-FORMED, which is a
 * different and much weaker claim than TRUSTWORTHY.
 */
export function assertDashboardShape(doc: unknown): asserts doc is DashboardSchema {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    throw namedError('MalformedArtifact', 'Artifact is not a JSON object');
  }
  const d = doc as Record<string, unknown>;
  if (!Array.isArray(d.panels)) {
    throw namedError('MalformedArtifact', 'Artifact has no panels array');
  }
  if (typeof d.title !== 'string' || !d.title.trim()) {
    throw namedError('MalformedArtifact', 'Artifact has no title');
  }
}

/** Named errors land on safeUserMessage's taxonomy in bedrockAgent.ts; a bare
 *  Error would fall to the generic default and lose the actionable wording. */
function namedError(name: string, message: string): Error {
  const e = new Error(message);
  e.name = name;
  return e;
}

/** Shared with bedrockAgent.ts, which reads its own tuning knobs the same way. */
export function envInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
