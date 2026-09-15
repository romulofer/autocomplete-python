"use strict";
/**
 * The real spawn adapter for {@link PythonRunner}, backed by `child_process`.
 * This is the only file in `src/run/` that touches Node's process API.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.spawnPythonProcess = void 0;
const child_process_1 = require("child_process");
/** How long a stopped process gets to exit before it is killed outright. */
const SIGKILL_GRACE_MS = 2000;
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
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    let killTimer = null;
    const clearKillTimer = () => {
        if (killTimer) {
            clearTimeout(killTimer);
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
        kill() {
            if (child.exitCode !== null || child.signalCode !== null)
                return;
            child.kill('SIGTERM');
            // A script that traps SIGTERM, or one blocked in C code, would otherwise
            // keep the pane busy forever.
            killTimer = setTimeout(() => {
                if (child.exitCode === null && child.signalCode === null) {
                    child.kill('SIGKILL');
                }
            }, SIGKILL_GRACE_MS);
        }
    };
};
exports.spawnPythonProcess = spawnPythonProcess;
//# sourceMappingURL=spawn.js.map