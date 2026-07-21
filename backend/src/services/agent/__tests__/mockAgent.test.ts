import { describe, it, expect } from '@jest/globals';
import { mockAgentService, scoreEntry, MENU_MESSAGE, CLARIFY_MESSAGE } from '../mockAgent.js';
import { AGENT_CORPUS } from '../corpus.generated.js';
import type { CorpusEntry } from '../corpus.generated.js';
import type { AgentChatResult, AgentContext, AgentTurn, AgentTurnResult } from '../types.js';

// Every case is a direct mockAgentService.chat(input, ctx) with a hand-built ctx —
// no DI seam, no mocking, no database.
const ctx = (overrides: Partial<AgentContext> = {}): AgentContext => ({
  userId: 'u1',
  role: 'admin',
  sessionId: '00000000-1111-2222-3333-444444444444',
  signal: new AbortController().signal,
  ...overrides,
});

const user = (content: string): AgentTurn => ({ role: 'user', content });
const assistant = (content: string): AgentTurn => ({ role: 'assistant', content });

const chat = (message: string, history: AgentTurn[] = [], c: AgentContext = ctx()) =>
  mockAgentService.chat({ message, history }, c);

/** Narrows a turn to its result arm; throws (failing the test) on anything else. */
function resultOf(turn: AgentTurnResult): AgentChatResult {
  if (turn.type !== 'result') {
    throw new Error(`expected a result turn, got ${turn.type}: ${turn.message}`);
  }
  return turn.result;
}

function corpusEntry(id: string): CorpusEntry {
  const entry = AGENT_CORPUS.find((e) => e.id === id);
  if (!entry) throw new Error(`corpus entry ${id} missing`);
  return entry;
}

const titleOf = (id: string): string => corpusEntry(id).schema.title as string;

/** A history that reaches the result state without contributing any keyword. */
const warmHistory: AgentTurn[] = [user('hello'), assistant(MENU_MESSAGE)];

describe('mockAgentService', () => {
  it('satisfies the seam: kind is mock', () => {
    expect(mockAgentService.kind).toBe('mock');
  });

  // 1
  it('cold session with no keyword match returns the menu', async () => {
    const turn = await chat('hello');
    expect(turn.type).toBe('question');
    expect(turn.message).toBe(MENU_MESSAGE);
    expect(turn.result).toBeNull();
  });

  // 2
  it('cold session with a keyword match asks one clarifying question', async () => {
    const turn = await chat('I want to track vehicle mileage');
    expect(turn.type).toBe('question');
    expect(turn.message).toBe(CLARIFY_MESSAGE);
    expect(turn.result).toBeNull();
  });

  // 3
  it('turn 2 produces a result from the combined history', async () => {
    const history = [user('I want to track vehicle mileage'), assistant(CLARIFY_MESSAGE)];
    const turn = await chat('last 30 days', history);
    const result = resultOf(turn);
    expect((result.report_schema.panels as unknown[]).length).toBeGreaterThan(0);
    expect(result.title).toBe(titleOf('vehicle-mileage'));
  });

  // 4 — turn-1 non-redundancy: the clarifying wording must not re-ask what the
  // user just said (scope and period are both in this message).
  it('clarifying question does not re-ask fleet or period', async () => {
    const turn = await chat('show me vehicle mileage for the whole fleet over the last 30 days');
    expect(turn.type).toBe('question');
    expect(turn.message).toBe(CLARIFY_MESSAGE);
    expect(turn.message).not.toContain('whole fleet');
    expect(turn.message).not.toContain('specific period');
  });

  // 5
  it.each([
    ['mileage', 'vehicle-mileage'],
    ['leasing', 'leasing'],
    ['driver score', 'driver-performance'],
    ['map', 'fleet-reports'],
    ['engine', 'engine-operation'],
    ['anomalies', 'fleet-anomaly'],
  ])('routes "%s" to %s', async (message, id) => {
    const result = resultOf(await chat(message, warmHistory));
    expect(result.title).toBe(titleOf(id));
  });

  // 6 — requires the combined-history fallback: the new message has no keyword.
  it('refinement with no new keyword keeps the fixture', async () => {
    const history = [user('I want to track vehicle mileage'), assistant('here it is')];
    const result = resultOf(await chat('across the whole fleet, last 30 days', history));
    expect(result.title).toBe(titleOf('vehicle-mileage'));
  });

  // 7 — THE MR2-C2 REGRESSION TEST. Combined-text scoring makes this a 1-1 tie
  // that array order resolves back to vehicle-mileage — the dashboard the user
  // just asked to replace. Newest-message-first must win here.
  it('MR2-C2: a switch message changes the fixture', async () => {
    const history = [user('I want to track vehicle mileage'), assistant('here it is')];
    const result = resultOf(await chat('actually show driver performance instead', history));
    expect(result.title).toBe(titleOf('driver-performance'));
  });

  // 7b — the MR !56 review regression: the COMPOSITION of 6 and 7. After a
  // switch, a keyword-free refinement must stay on the switched-to fixture. A
  // concatenated fallback re-ties mileage against driver 1-1 and array order
  // reverts to the abandoned fixture; the newest-signal-bearing-user-turn walk
  // must win here.
  it('MR !56: a keyword-free refinement after a switch keeps the switched-to fixture', async () => {
    const history = [
      user('I want to track vehicle mileage'),
      assistant(CLARIFY_MESSAGE),
      user('actually show driver performance instead'),
      assistant('built driver performance'),
    ];
    const result = resultOf(await chat('narrow it to last 7 days', history));
    expect(result.title).toBe(titleOf('driver-performance'));
  });

  // 7c — pins the user-turns-only filter in the fallback walk (MR !56 review:
  // deleting the role filter used to pass the whole suite). Assistant turns
  // routinely carry keywords — MENU_MESSAGE names all six topics — and must
  // never outvote the user's own words.
  it('fallback ignores assistant turns even when they carry keywords', async () => {
    const history = [user('I want to track vehicle mileage'), assistant(MENU_MESSAGE)];
    const result = resultOf(await chat('looks good, build it', history));
    expect(result.title).toBe(titleOf('vehicle-mileage'));
  });

  // 8
  it('zero matches anywhere falls back to the default entry', async () => {
    const cold = await chat('asdf qwerty');
    expect(cold.type).toBe('question');
    expect(cold.message).toBe(MENU_MESSAGE);

    const history = [user('asdf qwerty'), assistant(MENU_MESSAGE)];
    const result = resultOf(await chat('asdf qwerty', history));
    expect(result.title).toBe(titleOf('fleet-anomaly'));
  });

  // 9
  describe('error branch (deliberately not a model of real agent behaviour)', () => {
    it.each(['stop', 'cancel', '  Cancel me'])(
      'fires on %j on a cold session', async (message) => {
        const turn = await chat(message);
        expect(turn.type).toBe('error');
        expect(turn.result).toBeNull();
      });

    it('fires at any depth', async () => {
      const deep = [
        user('I want to track vehicle mileage'),
        assistant(CLARIFY_MESSAGE),
        user('last 30 days'),
        assistant('here it is'),
      ];
      const turn = await chat('cancel', deep);
      expect(turn.type).toBe('error');
      expect(turn.result).toBeNull();
    });

    it.each(['nobody', 'cancellation policy', 'stopwatch report'])(
      'does not fire on %j', async (message) => {
        const turn = await chat(message);
        expect(turn.type).toBe('question');
      });

    // The MR !56 review regression: CLARIFY_MESSAGE invites "no" as the build-it
    // answer. A leading "no"/"nothing" must fall through to the result path, not
    // dead-end the dialogue as an error.
    it.each(["No, that's all", 'nothing to narrow, just build it', 'no thanks, build it'])(
      '%j after the clarify beat builds the dashboard', async (message) => {
        const history = [user('I want to track vehicle mileage'), assistant(CLARIFY_MESSAGE)];
        const result = resultOf(await chat(message, history));
        expect(result.title).toBe(titleOf('vehicle-mileage'));
      });
  });

  // 10 — both halves: the second response is pristine AND the corpus singleton
  // itself is untouched. A missing structuredClone corrupts every later request
  // in the process and only manifests on the second call.
  it('structuredClone isolation: mutating one result leaks nowhere', async () => {
    const pristine = structuredClone(corpusEntry('vehicle-mileage').schema);

    const first = resultOf(await chat('mileage', warmHistory));
    const firstPanels = first.report_schema.panels as Array<Record<string, unknown>>;
    (firstPanels[0] as Record<string, unknown>).title = 'MUTATED';
    delete (first.report_schema as Record<string, unknown>).time;

    const second = resultOf(await chat('mileage', warmHistory));
    const secondPanels = second.report_schema.panels as Array<Record<string, unknown>>;
    expect((secondPanels[0] as Record<string, unknown>).title).not.toBe('MUTATED');
    expect(second.report_schema.time).toBeDefined();

    expect(corpusEntry('vehicle-mileage').schema).toEqual(pristine);
  });

  // 11
  it('stamps id: null, a session-derived uid, version 1, and the fixture title on all six', async () => {
    const phrases: Array<[string, string]> = [
      ['anomalies', 'fleet-anomaly'],
      ['map', 'fleet-reports'],
      ['engine', 'engine-operation'],
      ['leasing', 'leasing'],
      ['mileage', 'vehicle-mileage'],
      ['driver score', 'driver-performance'],
    ];
    for (const [message, id] of phrases) {
      const result = resultOf(await chat(message, warmHistory));
      expect(result.report_schema.id).toBeNull(); // vehicle-mileage ships "id": 1 in the fixture
      expect(result.report_schema.uid).toBe('ai-00000000-2');
      expect(result.report_schema.version).toBe(1);
      expect(result.title).toBe(result.report_schema.title);
      expect(result.title).toBe(titleOf(id));
    }
  });

  // 12
  it('uid varies with turn index and with ctx.sessionId', async () => {
    const longer = [...warmHistory, user('more'), assistant('and more')];
    const atDepth2 = resultOf(await chat('mileage', warmHistory));
    const atDepth4 = resultOf(await chat('mileage', longer));
    expect(atDepth2.report_schema.uid).toBe('ai-00000000-2');
    expect(atDepth4.report_schema.uid).toBe('ai-00000000-4');

    const otherSession = resultOf(await chat('mileage', warmHistory,
      ctx({ sessionId: 'deadbeef-1111-2222-3333-444444444444' })));
    expect(otherSession.report_schema.uid).toBe('ai-deadbeef-2');
  });

  // 12b — MR !56 review pin: the mock is a pure function of (input, ctx), so the
  // same input must replay to a deep-equal turn (persisted history has to render
  // exactly as the live session did), and the result message must be tied to the
  // dashboard it announces — a timestamp or random component in either would
  // pass every other test.
  it('is deterministic: same input twice yields deep-equal turns', async () => {
    const first = await chat('mileage', warmHistory);
    const second = await chat('mileage', warmHistory);
    expect(first).toEqual(second);
    expect(first.message).toContain(resultOf(first).title);
  });

  // 13
  it('never throws', async () => {
    const resultNullTurn: AgentTurn = { role: 'assistant', content: 'x', result: null };
    const cases: Array<[string, AgentTurn[]]> = [
      ['', []],
      ['a'.repeat(4000), []],
      ['?!.,;:', []],
      ['mileage', [resultNullTurn]],
      ['mileage', [assistant('only'), assistant('assistant'), assistant('turns')]],
    ];
    for (const [message, history] of cases) {
      const turn = await chat(message, history);
      expect(['question', 'result', 'error']).toContain(turn.type);
      expect(typeof turn.message).toBe('string');
    }
  });

  // The tie-break block. Each phrase is labelled with which matcher it survives;
  // the labelling is what stops a "simplification" back to \b<kw>\b going
  // unnoticed.
  describe('tie-break: first corpus row wins at equal score', () => {
    it.each([
      // plural matcher ONLY — the MR2-C1 regression test: with \b<kw>\b, "alerts"
      // scores zero and the tie never happens; engine-operation wins outright.
      ['idling alerts', 'fleet-anomaly'],
      // both matchers — regression-proof either way.
      ['idle alert', 'fleet-anomaly'],
      // both matchers.
      ['lease mileage', 'leasing'],
    ])('"%s" resolves to %s', async (message, id) => {
      const result = resultOf(await chat(message, warmHistory));
      expect(result.title).toBe(titleOf(id));
    });

    // Score alone — NOT tie-break cases: two distinct keywords beat one.
    it.each([
      ['safety incidents by driver', 'driver-performance'],
      ['rental contract mileage', 'leasing'],
    ])('"%s" resolves to %s on score alone', async (message, id) => {
      const result = resultOf(await chat(message, warmHistory));
      expect(result.title).toBe(titleOf(id));
    });
  });

  // Plural tolerance is a correction (MR2-C1) and invisible in every other test:
  // these assert the score lands on the INTENDED row, which routing alone cannot
  // isolate (a plural on one row can tie with a singular on another).
  describe('plural tolerance', () => {
    it.each([
      ['show me the alerts', 'fleet-anomaly', 1],
      ['any incidents?', 'fleet-anomaly', 1],
      ['engine faults', 'fleet-anomaly', 1],
      ['excavator problems', 'fleet-anomaly', 1],
      ['lease contracts', 'leasing', 2],
      ['driver scores', 'driver-performance', 2],
    ])('"%s" scores %s at %i', (phrase, id, score) => {
      expect(scoreEntry(corpusEntry(id), phrase)).toBe(score);
    });

    it('stays word-boundary anchored: no substring matches', () => {
      expect(scoreEntry(corpusEntry('engine-operation'), 'idleness')).toBe(0);
      expect(scoreEntry(corpusEntry('fleet-reports'), 'mapping')).toBe(0);
    });

    it('"kilometers" matches kilometer in its own row only', () => {
      expect(scoreEntry(corpusEntry('vehicle-mileage'), 'kilometers')).toBeGreaterThanOrEqual(1);
      for (const entry of AGENT_CORPUS) {
        if (entry.id !== 'vehicle-mileage') {
          expect({ id: entry.id, score: scoreEntry(entry, 'kilometers') })
            .toEqual({ id: entry.id, score: 0 });
        }
      }
    });
  });
});
