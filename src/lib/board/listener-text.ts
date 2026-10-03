// Listener text (design.md Decision 4, "Listener text"). The one place a
// lane's `ListenerState` becomes header copy. The interval line appears only
// for a configured listener; a delayed listener is told apart from a healthy
// one by its words, with `degraded` available as color reinforcement only.
// Every duration goes through `formatRelativeTime` against the board's
// `generatedAt`, so none is negative or in the future.
import { formatRelativeTime } from "../time/format-relative-time";
import type { ListenerState } from "./board-view-model";

export interface ListenerText {
  /** "Listening every N min" or the delayed wording; null when no listener is configured. */
  intervalLine: string | null;
  heardLine: string;
  /** True only for a delayed listener. Reinforces the text; never replaces it. */
  degraded: boolean;
}

export function formatListenerState(state: ListenerState, now: string | Date): ListenerText {
  switch (state.status) {
    case "not-configured":
      return { intervalLine: null, heardLine: "Listener not configured", degraded: false };
    case "never-heard":
      return { intervalLine: intervalLine(state.intervalMinutes), heardLine: "Not heard yet", degraded: false };
    case "healthy":
      return {
        intervalLine: intervalLine(state.intervalMinutes),
        heardLine: `Last heard ${formatRelativeTime(state.lastHeardAt, now)}`,
        degraded: false,
      };
    case "delayed":
      return {
        intervalLine: state.retrying ? "Listening delayed · retrying" : "Listening delayed",
        heardLine:
          state.lastSuccessAt === null
            ? "No successful listen yet"
            : `Last successful listen ${formatRelativeTime(state.lastSuccessAt, now)}`,
        degraded: true,
      };
    default:
      return assertNever(state);
  }
}

function intervalLine(minutes: number): string {
  return `Listening every ${minutes} min`;
}

function assertNever(value: never): never {
  throw new Error(`Unknown listener state: ${JSON.stringify(value)}`);
}
