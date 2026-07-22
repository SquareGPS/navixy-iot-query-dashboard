/**
 * Tracks which execution run is the latest so a superseded run's async
 * completions can be dropped instead of overwriting newer results.
 *
 * Motivation (DO-352 review): a timezone change re-executes dashboard
 * queries while the first run may still be in flight. Without a gate, the
 * run that *finishes* last wins — if that is the stale run, the UI shows
 * old-zone data again. Runs also read the zone registry per request, so a
 * superseded run left running would produce mixed-zone results; callers
 * check the gate between steps and abandon the run entirely.
 */
export interface RunGate {
  /**
   * Begin a new run, superseding all earlier ones. The returned probe is
   * true while this run is still the latest.
   */
  start(): () => boolean;
  /**
   * Observe the current run without superseding it (e.g. a single-panel
   * refresh that a later full run should invalidate, but that must not
   * itself invalidate an in-flight full run).
   */
  join(): () => boolean;
}

export function createRunGate(): RunGate {
  let current = 0;
  return {
    start() {
      const id = ++current;
      return () => current === id;
    },
    join() {
      const id = current;
      return () => current === id;
    },
  };
}
