"use strict";
/**
 * The child-process seam.
 *
 * {@link JediDaemon} talks to this interface rather than to Pulsar's
 * `BufferedProcess`, so the request/response bookkeeping can be driven by a
 * fake process in the tests.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.spawnBufferedProcess = void 0;
const atom_1 = require("atom");
/** The real factory, backed by Pulsar's `BufferedProcess`. */
const spawnBufferedProcess = (options) => {
    const process = new atom_1.BufferedProcess({
        command: options.command,
        args: options.args,
        stdout: options.onStdout,
        stderr: options.onStderr,
        exit: options.onExit
    });
    process.onWillThrowError(({ error, handle }) => {
        options.onSpawnError(error);
        // Always handled: an unhandled spawn error surfaces to the user as an
        // editor-level crash dialog, which tells them nothing useful.
        handle();
    });
    // A closed stdin arrives here rather than as an uncaught exception.
    process.process?.stdin?.on('error', () => {
        /* reported through the failed write instead */
    });
    return {
        write(data) {
            const stdin = process.process?.stdin;
            if (!stdin || stdin.destroyed)
                return false;
            try {
                stdin.write(data);
                return true;
            }
            catch {
                return false;
            }
        },
        kill() {
            try {
                process.kill();
            }
            catch {
                /* already gone */
            }
        },
        isAlive() {
            const child = process.process;
            if (!child)
                return false;
            return child.exitCode === null && child.signalCode === null;
        }
    };
};
exports.spawnBufferedProcess = spawnBufferedProcess;
//# sourceMappingURL=process.js.map