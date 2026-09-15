/**
 * Caching in front of {@link discoverInterpreters}.
 *
 * Discovery touches a lot of directories, and completions ask for the
 * interpreter constantly, so the result is memoized until something that could
 * change it - a setting, a project root - actually changes.
 */

import {
  describeInterpreter,
  discoverInterpreters,
  type DiscoveredInterpreter,
  type DiscoveryOptions
} from './locators';
import type { DiscoveryHost } from '../host/types';

export class InterpreterRegistry {
  private cached: DiscoveredInterpreter[] | null = null;

  constructor(
    private readonly host: DiscoveryHost,
    /** Re-read each time, so settings changes are picked up on invalidation. */
    private readonly readOptions: () => DiscoveryOptions
  ) {}

  /** Discard the memoized result. */
  invalidate(): void {
    this.cached = null;
  }

  /** Every interpreter, highest priority first. */
  all(): DiscoveredInterpreter[] {
    this.cached ??= discoverInterpreters(this.host, this.readOptions());
    return this.cached;
  }

  /** The interpreter to run the daemon with, or `null` when there is none. */
  best(): DiscoveredInterpreter | null {
    return this.all()[0] ?? null;
  }

  /** Convenience for the many callers that only need the executable path. */
  bestPath(): string | null {
    return this.best()?.filePath ?? null;
  }

  describe(interpreter: DiscoveredInterpreter): string {
    return describeInterpreter(interpreter);
  }
}
