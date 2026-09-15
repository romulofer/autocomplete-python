"use strict";
/**
 * Running a Python file and reporting what it produced.
 *
 * The spawn function is injected, so the lifecycle - start, stream, stop, exit -
 * is driven by a fake process in the tests.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PythonRunner = void 0;
const command_1 = require("./command");
/**
 * Owns at most one child process at a time. Starting a run while one is already
 * going stops the old one first: two scripts writing into one output pane is
 * never what the user meant.
 */
class PythonRunner {
    spawnFn;
    child = null;
    startedAt = 0;
    listeners = new Set();
    /** Set while stopping, so the exit that follows is reported as a stop. */
    stopping = false;
    constructor(spawnFn) {
        this.spawnFn = spawnFn;
    }
    onEvent(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    get isRunning() {
        return this.child !== null;
    }
    run(input) {
        if (this.child)
            this.stop();
        const runCommand = (0, command_1.buildRunCommand)(input);
        this.startedAt = Date.now();
        this.stopping = false;
        let child;
        try {
            child = this.spawnFn(runCommand);
        }
        catch (err) {
            this.emit({ type: 'failed', message: String(err) });
            return;
        }
        this.child = child;
        this.emit({
            type: 'started',
            description: (0, command_1.describeRunCommand)(runCommand),
            cwd: runCommand.cwd
        });
        child.onStdout((text) => this.emit({ type: 'stdout', text }));
        child.onStderr((text) => this.emit({ type: 'stderr', text }));
        child.onError((error) => {
            this.child = null;
            const message = error.code === 'ENOENT'
                ? `Could not run ${runCommand.command}. Choose another interpreter with "Select Interpreter".`
                : `Failed to start the script: ${error.message}`;
            this.emit({ type: 'failed', message });
        });
        child.onExit((code) => {
            // A killed process reports a null code; report it as the stop it was.
            const reported = this.stopping ? null : code;
            this.child = null;
            this.stopping = false;
            this.emit({
                type: 'exited',
                code: reported,
                durationMs: Date.now() - this.startedAt
            });
        });
    }
    stop() {
        if (!this.child)
            return;
        this.stopping = true;
        this.child.kill();
    }
    dispose() {
        this.stop();
        this.listeners.clear();
    }
    emit(event) {
        for (const listener of this.listeners)
            listener(event);
    }
}
exports.PythonRunner = PythonRunner;
//# sourceMappingURL=runner.js.map