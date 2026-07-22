import { describe, it, expect } from 'vitest';
import { createRunGate } from '../runGate';

describe('createRunGate', () => {
  it('marks earlier runs stale once a newer run starts', () => {
    const gate = createRunGate();
    const first = gate.start();
    expect(first()).toBe(true);
    const second = gate.start();
    expect(first()).toBe(false);
    expect(second()).toBe(true);
  });

  it('join() observes the current run without superseding it', () => {
    const gate = createRunGate();
    const run = gate.start();
    const observer = gate.join();
    // Joining must not invalidate the in-flight run.
    expect(run()).toBe(true);
    expect(observer()).toBe(true);
    // A later full run invalidates both.
    gate.start();
    expect(run()).toBe(false);
    expect(observer()).toBe(false);
  });

  it('drops out-of-order completions: the run that finishes last does not win', async () => {
    // Models the DO-352 race: run A (old zone) is still in flight when run B
    // (new zone) starts; A completes AFTER B. Gate-guarded writes must keep
    // B's result and drop A's.
    const gate = createRunGate();
    const applied: string[] = [];

    let releaseA!: () => void;
    let releaseB!: () => void;
    const responseA = new Promise<void>((resolve) => { releaseA = resolve; });
    const responseB = new Promise<void>((resolve) => { releaseB = resolve; });

    const run = (label: string, response: Promise<void>) => {
      const isCurrent = gate.start();
      return response.then(() => {
        if (!isCurrent()) return;
        applied.push(label);
      });
    };

    const runA = run('old-zone', responseA);
    const runB = run('new-zone', responseB);

    // Out-of-order completion: B (the newer run) finishes first, then A.
    releaseB();
    await runB;
    releaseA();
    await runA;

    expect(applied).toEqual(['new-zone']);
  });

  it('applies the newest run even when completions arrive in order', async () => {
    const gate = createRunGate();
    const applied: string[] = [];

    const run = async (label: string) => {
      const isCurrent = gate.start();
      await Promise.resolve();
      if (isCurrent()) applied.push(label);
    };

    await run('first');
    await run('second');
    expect(applied).toEqual(['first', 'second']);
  });
});
