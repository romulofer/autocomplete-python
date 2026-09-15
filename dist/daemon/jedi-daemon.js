"use strict";
/**
 * The long-lived Python process and the conversation with it.
 *
 * Everything above this layer works in promises and never sees a child process.
 * The process itself, the notifier and the interpreter registry are all injected
 * so the request bookkeeping can be driven without spawning anything.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.JediDaemon = exports.RESPONSE_CACHE_SIZE = exports.REQUEST_TIMEOUT_MS = exports.MAX_PENDING_REQUESTS = void 0;
const log = __importStar(require("../log"));
const protocol_1 = require("./protocol");
const process_1 = require("./process");
/**
 * Beyond this many in-flight requests the user is typing faster than Jedi can
 * answer. Everything queued is stale by then, so the queue is dropped rather
 * than worked through.
 */
exports.MAX_PENDING_REQUESTS = 10;
/** A request unanswered after this long is assumed lost. */
exports.REQUEST_TIMEOUT_MS = 15_000;
/** Responses kept for reuse while the buffer and cursor are unchanged. */
exports.RESPONSE_CACHE_SIZE = 20;
class JediDaemon {
    options;
    process = null;
    pending = new Map();
    responseCache = new Map();
    framer = new protocol_1.LineFramer();
    processFactory;
    idleTimer = null;
    disposed = false;
    reportedNoInterpreter = false;
    reportedFatalError = false;
    /** Populated from the handshake; useful in bug reports and the status bar. */
    runtime = null;
    constructor(options) {
        this.options = options;
        this.processFactory = options.processFactory ?? process_1.spawnBufferedProcess;
    }
    /** @see generateRequestId */
    requestId(lookup, filePath, source, line, column) {
        return (0, protocol_1.generateRequestId)(lookup, filePath, source, line, column);
    }
    /** A previously received response for `id`, if it is still cached. */
    cachedResponse(id) {
        const cached = this.responseCache.get(id);
        if (!cached)
            return null;
        // Re-parse through JSON so callers can mutate their copy freely.
        return JSON.parse(JSON.stringify(cached));
    }
    /**
     * Send a request and resolve with the daemon's answer.
     *
     * Failures - no interpreter, a dead process, a timeout - resolve with an
     * empty result set rather than rejecting, because every caller's fallback is
     * "no suggestions".
     */
    send(request) {
        if (this.disposed)
            return Promise.resolve((0, protocol_1.emptyResponse)(request.id));
        if (this.pending.size > exports.MAX_PENDING_REQUESTS) {
            log.debug('Request queue overflowed; dropping it and restarting');
            this.resolveAllPending();
            this.restart();
        }
        const payload = `${JSON.stringify(request)}\n`;
        if (!this.deliver(payload)) {
            return Promise.resolve((0, protocol_1.emptyResponse)(request.id));
        }
        this.resetIdleTimer();
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                log.warning(`Timed out waiting for Jedi (${request.lookup})`);
                this.pending.delete(request.id);
                resolve((0, protocol_1.emptyResponse)(request.id));
            }, exports.REQUEST_TIMEOUT_MS);
            this.pending.set(request.id, {
                resolve: resolve,
                timer
            });
        });
    }
    /**
     * Write `payload`, spawning or respawning as needed. One respawn attempt:
     * if the process dies again immediately, the request is given up on.
     */
    deliver(payload) {
        if (!this.ensureProcess())
            return false;
        if (this.process?.write(payload))
            return true;
        log.debug('Write failed; respawning the daemon once');
        this.restart();
        if (!this.ensureProcess())
            return false;
        return this.process?.write(payload) ?? false;
    }
    /** Kill the daemon; the next request spawns a fresh one. */
    restart() {
        this.killProcess();
        this.framer.reset();
        this.runtime = null;
        this.reportedFatalError = false;
    }
    /** Forget the cached interpreter and every response. For settings changes. */
    reload() {
        this.options.interpreters.invalidate();
        this.responseCache.clear();
        this.reportedNoInterpreter = false;
        this.restart();
    }
    dispose() {
        this.disposed = true;
        this.resolveAllPending();
        this.killProcess();
        this.clearIdleTimer();
        this.responseCache.clear();
    }
    // --- process management -------------------------------------------------
    ensureProcess() {
        if (this.process?.isAlive())
            return true;
        const interpreter = this.options.interpreters.bestPath();
        if (!interpreter) {
            this.reportNoInterpreter();
            return false;
        }
        log.debug('Spawning Jedi daemon with', interpreter);
        this.framer.reset();
        this.process = this.processFactory({
            command: interpreter,
            // `-u` keeps Python from block-buffering stdout when it is a pipe, which
            // is what makes the request/response round trip feel instant.
            args: ['-u', this.options.scriptPath],
            onStdout: (chunk) => this.handleStdout(chunk),
            onStderr: (chunk) => this.handleStderr(chunk),
            onExit: (code) => {
                log.debug('Jedi daemon exited with code', code);
                this.resolveAllPending();
            },
            onSpawnError: (error) => {
                if (error.code === 'ENOENT') {
                    this.reportNoInterpreter(String(error));
                }
                else {
                    log.error('Jedi daemon failed to spawn', error);
                }
                this.killProcess();
            }
        });
        this.resetIdleTimer();
        return true;
    }
    killProcess() {
        this.process?.kill();
        this.process = null;
    }
    clearIdleTimer() {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }
    }
    /**
     * Shut the daemon down after a spell of inactivity, so an idle editor is not
     * holding an interpreter and Jedi's caches in memory all day. The old code
     * set one unconditional 10-minute kill timer per spawn, which also killed
     * daemons that were in active use.
     */
    resetIdleTimer() {
        this.clearIdleTimer();
        const minutes = this.options.idleTimeoutMinutes();
        if (!Number.isFinite(minutes) || minutes <= 0)
            return;
        this.idleTimer = setTimeout(() => {
            if (this.pending.size > 0) {
                this.resetIdleTimer();
                return;
            }
            log.debug('Shutting down idle Jedi daemon');
            this.killProcess();
        }, minutes * 60 * 1000);
    }
    // --- protocol -----------------------------------------------------------
    handleStdout(chunk) {
        for (const line of this.framer.push(chunk)) {
            const response = (0, protocol_1.parseResponseLine)(line);
            if (!response) {
                // Anything a project module prints on import lands here. It is not ours
                // to interpret, and it must not take down the response stream.
                log.warning('Ignoring non-JSON output from the Jedi daemon:', line);
                continue;
            }
            this.handleResponse(response);
        }
    }
    handleResponse(response) {
        if (response.id === protocol_1.HANDSHAKE_ID) {
            const handshake = response;
            this.runtime = { python: handshake.python, jedi: handshake.jedi };
            log.debug('Jedi daemon ready', this.runtime);
            return;
        }
        if (response.id === protocol_1.FATAL_ERROR_ID) {
            this.reportFatalError(response);
            return;
        }
        this.cacheResponse(response);
        const pendingRequest = this.pending.get(response.id);
        if (!pendingRequest) {
            log.debug('Received a response nobody is waiting for', response.id);
            return;
        }
        clearTimeout(pendingRequest.timer);
        this.pending.delete(response.id);
        pendingRequest.resolve(response);
    }
    handleStderr(chunk) {
        log.debug('Jedi daemon stderr:', chunk);
        if (chunk.includes("No module named 'jedi'")) {
            this.reportFatalError({
                id: protocol_1.FATAL_ERROR_ID,
                results: [],
                error: 'jedi-missing',
                message: 'autocomplete-python-pulsar could not import Jedi.',
                detail: chunk
            });
            return;
        }
        if (!this.options.reportProviderErrors())
            return;
        const fromJedi = chunk.includes('jedi');
        this.options.notifier.warning(fromJedi
            ? 'autocomplete-python-pulsar: error raised inside Jedi'
            : 'autocomplete-python-pulsar: traceback from the completion daemon', {
            description: fromJedi
                ? 'Report this to the Jedi issue tracker rather than to autocomplete-python-pulsar. Turn off `Output Provider Errors` to stop seeing these.'
                : 'Turn off `Output Provider Errors` to stop seeing these.',
            detail: chunk,
            dismissable: true
        });
    }
    cacheResponse(response) {
        // Map preserves insertion order, so the first key is the oldest entry.
        if (this.responseCache.size >= exports.RESPONSE_CACHE_SIZE) {
            const oldest = this.responseCache.keys().next();
            if (!oldest.done)
                this.responseCache.delete(oldest.value);
        }
        this.responseCache.set(response.id, response);
    }
    resolveAllPending() {
        for (const [id, pendingRequest] of this.pending) {
            clearTimeout(pendingRequest.timer);
            pendingRequest.resolve((0, protocol_1.emptyResponse)(id));
        }
        this.pending.clear();
    }
    // --- user-facing errors -------------------------------------------------
    settingsButton() {
        const openSettings = this.options.openSettings;
        return openSettings ? [{ text: 'Open settings', onDidClick: openSettings }] : [];
    }
    reportNoInterpreter(detail) {
        if (this.reportedNoInterpreter)
            return;
        this.reportedNoInterpreter = true;
        log.warning('No python interpreter found', detail);
        this.options.notifier.warning('autocomplete-python-pulsar could not find a Python interpreter.', {
            description: 'Run **Autocomplete Python Pulsar: Select Interpreter**, or set `Python Executable Paths` in the package settings.',
            detail: detail ?? '',
            dismissable: true,
            buttons: this.settingsButton()
        });
    }
    reportFatalError(error) {
        if (this.reportedFatalError)
            return;
        this.reportedFatalError = true;
        const interpreter = this.options.interpreters.bestPath() ?? 'python3';
        const descriptions = {
            'jedi-missing': `Install it for the interpreter in use:\n\n    ${interpreter} -m pip install --upgrade "jedi>=0.19"`,
            'jedi-too-old': `autocomplete-python-pulsar needs Jedi 0.19 or newer:\n\n    ${interpreter} -m pip install --upgrade "jedi>=0.19"`,
            'python-too-old': 'autocomplete-python-pulsar needs Python 3.10 or newer. Choose a newer interpreter with **Autocomplete Python Pulsar: Select Interpreter**.',
            unknown: 'The completion daemon failed to start.'
        };
        log.error(error.message, error.detail);
        this.options.notifier.error(error.message, {
            description: descriptions[error.error] ?? descriptions.unknown,
            detail: error.detail,
            dismissable: true,
            buttons: this.settingsButton()
        });
    }
}
exports.JediDaemon = JediDaemon;
//# sourceMappingURL=jedi-daemon.js.map