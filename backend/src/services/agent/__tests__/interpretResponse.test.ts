import { describe, it, expect } from '@jest/globals';
import { interpretAgentResponse, looksLikeMissedResult } from '../interpretResponse.js';

/**
 * RECONSTRUCTED — NOT a verbatim capture.
 *
 * The only surviving record of the real build reply is the elided excerpt at
 * ai-chat-plan.local/PROBE-FINDINGS.md:33-39 ("..." standing for the middle
 * prose, "<job-id>" substituted into the URL). The head and tail lines below
 * restore what the excerpt records exactly; the middle prose is plausible
 * filler; the probe's real job id is substituted back into the URL. Do not
 * treat the wording as a contract — classification deliberately keys on the
 * s3:// URL alone.
 */
const RECONSTRUCTED_JOB_ID = '39f24779-a09e-4cc9-b901-0cf062c9b853';
const RECONSTRUCTED_URL =
  `s3://iot-query-dashboard-ai-agent-dev-dashboard-artifacts-fe0e8aa7/jobs/${RECONSTRUCTED_JOB_ID}/report_schema.json`;
const RECONSTRUCTED_BUILD_REPLY = [
  'Your dashboard has been built and saved successfully! 🎉',
  '',
  'Here is a summary of what was created:',
  '',
  '- 📊 Title: Vehicle Mileage by Driver — Last 30 Days',
  '- 🧩 Panels: 4 (text, kpi, barchart, table)',
  `- 🆔 Job ID: \`${RECONSTRUCTED_JOB_ID}\``,
  '- 📥 Download URL:',
  `\`${RECONSTRUCTED_URL}\``,
  '',
  'You can preview it against your data and apply it when ready.',
].join('\n');

const FIVE_QUESTIONS = [
  'Happy to build that! A few questions first:',
  '',
  '1. Which vehicles or groups should be included?',
  '2. What time range do you want to cover?',
  '3. Should distances be shown in km or miles?',
  '4. Do you want per-driver or per-vehicle grouping?',
  '5. Any thresholds you want highlighted?',
].join('\n');

describe('interpretAgentResponse — prose heuristic (§3.4.2)', () => {
  it('classifies the reconstructed real build reply as a result and lifts URL and job id', () => {
    const intent = interpretAgentResponse(RECONSTRUCTED_BUILD_REPLY);
    expect(intent.type).toBe('result');
    expect(intent.via).toBe('heuristic');
    expect(intent.artifactUrl).toBe(RECONSTRUCTED_URL);
    expect(intent.jobId).toBe(RECONSTRUCTED_JOB_ID);
    // The heuristic never synthesizes or strips: the bubble shows the prose verbatim.
    expect(intent.message).toBe(RECONSTRUCTED_BUILD_REPLY);
  });

  it('classifies a five-question numbered markdown list with no URL as a question, verbatim', () => {
    const intent = interpretAgentResponse(FIVE_QUESTIONS);
    expect(intent).toEqual({ type: 'question', via: 'heuristic', message: FIVE_QUESTIONS });
    expect(intent.artifactUrl).toBeUndefined();
  });

  it('strips wrapping backticks and trailing punctuation from the extracted URL', () => {
    const wrapped = interpretAgentResponse('Saved to `s3://bucket/jobs/a/report_schema.json`');
    expect(wrapped.artifactUrl).toBe('s3://bucket/jobs/a/report_schema.json');

    const period = interpretAgentResponse('Download s3://bucket/jobs/a/report_schema.json.');
    expect(period.artifactUrl).toBe('s3://bucket/jobs/a/report_schema.json');

    const comma = interpretAgentResponse('See s3://bucket/jobs/a/report_schema.json, then apply.');
    expect(comma.artifactUrl).toBe('s3://bucket/jobs/a/report_schema.json');

    // Legitimate dots inside the key survive; only trailing punctuation goes.
    expect(period.artifactUrl?.endsWith('.json')).toBe(true);
  });

  it('strips the full trailing-punctuation family the URL character class lets through (MR !57 review)', () => {
    // Each of these reached parseS3Url polluted before the fix, turning a
    // SUCCESSFUL build into a NoSuchKey "no longer available" error.
    const clean = 's3://bucket/jobs/a/report_schema.json';
    for (const punct of ['!', ';', '?', ':', '...', '!?', '~']) {
      const intent = interpretAgentResponse(`Saved to ${clean}${punct} enjoy.`);
      expect(intent.artifactUrl).toBe(clean);
    }
    // Markdown emphasis wrapping: the leading ** is outside the match, the
    // trailing ** must be stripped.
    expect(interpretAgentResponse(`Saved to **${clean}**`).artifactUrl).toBe(clean);
  });

  it('flags a job id with no URL as a possible missed result, still classified as question', () => {
    const prose = 'Your dashboard has been built! Job ID: `1b7f3c3a-0000-4abc-9def-123456789abc`.';
    const intent = interpretAgentResponse(prose);
    expect(intent.type).toBe('question');
    expect(looksLikeMissedResult(prose)).toBe(true);
    // An ordinary clarifying question carries none of the markers.
    expect(looksLikeMissedResult(FIVE_QUESTIONS)).toBe(false);
  });

  it('returns question with the input verbatim for empty and whitespace-only prose', () => {
    expect(interpretAgentResponse('')).toEqual({ type: 'question', via: 'heuristic', message: '' });
    expect(interpretAgentResponse('  \n\t ')).toEqual({
      type: 'question',
      via: 'heuristic',
      message: '  \n\t ',
    });
  });
});

describe('interpretAgentResponse — trailer (§3.4.4, proposed and NOT agreed)', () => {
  const PROSE = 'Your dashboard is ready to preview.';

  it('takes a result trailer, stripping the fence from the message', () => {
    const raw = `${PROSE}\n\n\`\`\`json\n{"type":"result","job_id":"j-1","artifact":"s3://b/k.json"}\n\`\`\``;
    const intent = interpretAgentResponse(raw);
    expect(intent.type).toBe('result');
    expect(intent.via).toBe('trailer');
    expect(intent.artifactUrl).toBe('s3://b/k.json');
    expect(intent.jobId).toBe('j-1');
    // The trailer is machinery; the user must never see it.
    expect(intent.message).toBe(PROSE);
  });

  it('takes a question trailer', () => {
    const raw = `${PROSE}\n\n\`\`\`json\n{"type":"question"}\n\`\`\``;
    const intent = interpretAgentResponse(raw);
    expect(intent).toEqual({ type: 'question', via: 'trailer', message: PROSE });
  });

  it('uses the LAST fenced block, so a code sample in the prose cannot be mistaken for the trailer', () => {
    const raw = [
      'Here is the SQL I used:',
      '```sql',
      'SELECT device_id FROM processed_common_data.trips',
      '```',
      'All done.',
      '```json',
      '{"type":"question"}',
      '```',
    ].join('\n');
    const intent = interpretAgentResponse(raw);
    expect(intent.type).toBe('question');
    expect(intent.via).toBe('trailer');
    // Only the trailer block is stripped; the code sample stays in the bubble.
    expect(intent.message).toContain('SELECT device_id');
    expect(intent.message).not.toContain('"type"');
  });

  it('falls through to the heuristic on any unusable trailer, and never throws', () => {
    // Malformed JSON.
    expect(interpretAgentResponse('Prose.\n```json\n{not json}\n```').via).toBe('heuristic');
    // Non-object bodies.
    expect(interpretAgentResponse('Prose.\n```json\nnull\n```').via).toBe('heuristic');
    expect(interpretAgentResponse('Prose.\n```json\n[1,2]\n```').via).toBe('heuristic');
    // type:'error' is OURS — an agent-emitted one is a contract violation.
    expect(interpretAgentResponse('Prose.\n```json\n{"type":"error"}\n```').via).toBe('heuristic');
    // A result with no artifact is not a result.
    expect(interpretAgentResponse('Prose.\n```json\n{"type":"result"}\n```').via).toBe('heuristic');
    // ...nor with an implausible one.
    expect(
      interpretAgentResponse('Prose.\n```json\n{"type":"result","artifact":"https://x/y"}\n```').via,
    ).toBe('heuristic');
    expect(
      interpretAgentResponse('Prose.\n```json\n{"type":"result","artifact":"s3://bucketonly"}\n```')
        .via,
    ).toBe('heuristic');

    // Fallthrough keeps the heuristic's own classification power: a malformed
    // trailer NEXT TO a plain-prose URL still classifies as a result.
    const mixed = interpretAgentResponse(
      'Saved to s3://bucket/jobs/a/report_schema.json\n```json\n{broken\n```',
    );
    expect(mixed).toMatchObject({ type: 'result', via: 'heuristic' });
  });
});
