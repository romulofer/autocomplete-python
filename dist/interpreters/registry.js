"use strict";
/**
 * Caching in front of {@link discoverInterpreters}.
 *
 * Discovery touches a lot of directories, and completions ask for the
 * interpreter constantly, so the result is memoized until something that could
 * change it - a setting, a project root - actually changes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.InterpreterRegistry = void 0;
const locators_1 = require("./locators");
class InterpreterRegistry {
    host;
    readOptions;
    cached = null;
    constructor(host, 
    /** Re-read each time, so settings changes are picked up on invalidation. */
    readOptions) {
        this.host = host;
        this.readOptions = readOptions;
    }
    /** Discard the memoized result. */
    invalidate() {
        this.cached = null;
    }
    /** Every interpreter, highest priority first. */
    all() {
        this.cached ??= (0, locators_1.discoverInterpreters)(this.host, this.readOptions());
        return this.cached;
    }
    /** The interpreter to run the daemon with, or `null` when there is none. */
    best() {
        return this.all()[0] ?? null;
    }
    /** Convenience for the many callers that only need the executable path. */
    bestPath() {
        return this.best()?.filePath ?? null;
    }
    describe(interpreter) {
        return (0, locators_1.describeInterpreter)(interpreter);
    }
}
exports.InterpreterRegistry = InterpreterRegistry;
//# sourceMappingURL=registry.js.map