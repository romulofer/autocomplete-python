"use strict";
/**
 * The real spawn adapter for {@link PythonRunner}, backed by `child_process`.
 * This is the only file in `src/run/` that touches Node's process API.
 *
 * The wiring from a child process to a {@link RunProcessLike} lives in
 * {@link createRunProcess}, which takes the child and its timers as parameters
 * so the stop-then-kill escalation can be driven by a fake in the tests.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.spawnPythonProcess = void 0;
exports.createRunProcess = createRunProcess;
const child_process_1 = require("child_process");
/** How long a stopped process gets to exit before it is killed outright. */
const SIGKILL_GRACE_MS = 2000;
const realTimers = {
    set: (callback, ms) => setTimeout(callback, ms),
    clear: (handle) => clearTimeout(handle)
};
/** Wrap a spawned child in the shape {@link PythonRunner} drives. */
function createRunProcess(child, timers = realTimers) {
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    let killTimer = null;
    const clearKillTimer = () => {
        if (killTimer !== null) {
            timers.clear(killTimer);
            killTimer = null;
        }
    };
    child.on('exit', clearKillTimer);
    child.on('close', clearKillTimer);
    return {
        onStdout(listener) {
            child.stdout?.on('data', (chunk) => listener(String(chunk)));
        },
        onStderr(listener) {
            child.stderr?.on('data', (chunk) => listener(String(chunk)));
        },
        onExit(listener) {
            child.on('close', (code) => listener(code));
        },
        onError(listener) {
            child.on('error', (error) => listener(error));
        },
        write(text) {
            // A script that never reads stdin leaves the pipe with no reader; guard
            // so a stray keystroke in the pane cannot throw EPIPE at us.
            try {
                child.stdin?.write(text);
            }
            catch {
                // The script has closed its end; nothing to do.
            }
        },
        closeStdin() {
            try {
                child.stdin?.end();
            }
            catch {
                // Already closed.
            }
        },
        kill() {
            if (child.exitCode !== null || child.signalCode !== null)
                return;
            child.kill('SIGTERM');
            // A script that traps SIGTERM, or one blocked in C code, would otherwise
            // keep the pane busy forever.
            killTimer = timers.set(() => {
                if (child.exitCode === null && child.signalCode === null) {
                    child.kill('SIGKILL');
                }
            }, SIGKILL_GRACE_MS);
        }
    };
}
const spawnPythonProcess = (options) => {
    const child = (0, child_process_1.spawn)(options.command, options.args, {
        cwd: options.cwd,
        env: {
            ...process.env,
            // Belt and braces alongside `-u`: some runtimes re-enable buffering when
            // stdout is a pipe rather than a terminal.
            PYTHONUNBUFFERED: '1'
        }
    });
    return createRunProcess(child);
};
exports.spawnPythonProcess = spawnPythonProcess;
//# sourceMappingURL=spawn.js.map