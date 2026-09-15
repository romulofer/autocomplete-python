"use strict";
/**
 * Wire format shared with `python/acp_jedi/protocol.py`, plus the pure pieces of
 * the conversation: request identity and line framing.
 *
 * Both ends speak newline-delimited JSON over the daemon's stdin/stdout. Every
 * request carries an `id` that the daemon echoes back, which is how responses
 * are matched to their callers and how the response cache is keyed.
 *
 * Nothing here spawns or talks to a process, so it is all directly testable.
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
exports.LineFramer = exports.FATAL_ERROR_ID = exports.HANDSHAKE_ID = void 0;
exports.generateRequestId = generateRequestId;
exports.parseResponseLine = parseResponseLine;
exports.emptyResponse = emptyResponse;
const crypto = __importStar(require("crypto"));
/**
 * Reserved response ids. The daemon uses these instead of a request id to
 * report on its own state, so startup problems surface as a readable
 * notification rather than as a raw Python traceback on stderr.
 */
exports.HANDSHAKE_ID = '__ready__';
exports.FATAL_ERROR_ID = '__error__';
/**
 * Request ids are a hash of everything that can change the answer, which makes
 * them double as the response cache key.
 *
 * SHA-256 rather than MD5: MD5 is unavailable when the host runs OpenSSL in
 * FIPS mode, which used to break the package outright. Upstream issue #432.
 */
function generateRequestId(lookup, filePath, source, line, column) {
    return crypto
        .createHash('sha256')
        .update([filePath ?? '', source, line, column, lookup].join(' '))
        .digest('hex');
}
/**
 * Reassembles newline-delimited messages from arbitrary stdout chunks.
 *
 * A chunk boundary has nothing to do with a message boundary. The old code
 * parsed each chunk as it arrived and threw `Failed to parse JSON from ...`
 * whenever a response straddled two of them. Upstream issues #354, #366.
 */
class LineFramer {
    buffer = '';
    /** Feed a chunk; get back whatever complete, non-empty lines it completed. */
    push(chunk) {
        this.buffer += chunk;
        const lines = [];
        let newlineIndex = this.buffer.indexOf('\n');
        while (newlineIndex >= 0) {
            const line = this.buffer.slice(0, newlineIndex).trim();
            this.buffer = this.buffer.slice(newlineIndex + 1);
            if (line.length > 0)
                lines.push(line);
            newlineIndex = this.buffer.indexOf('\n');
        }
        return lines;
    }
    /** Drop anything buffered but incomplete, e.g. after the process died. */
    reset() {
        this.buffer = '';
    }
    /** The incomplete tail, exposed for debugging. */
    get pending() {
        return this.buffer;
    }
}
exports.LineFramer = LineFramer;
/**
 * Parse one response line. Returns `null` for anything that is not JSON: that
 * is almost always a project module printing on import, which must not take
 * down the response stream.
 */
function parseResponseLine(line) {
    try {
        const parsed = JSON.parse(line);
        return parsed && typeof parsed.id === 'string' ? parsed : null;
    }
    catch {
        return null;
    }
}
/** An empty answer, used whenever a request cannot be served. */
function emptyResponse(id) {
    return { id, results: [] };
}
//# sourceMappingURL=protocol.js.map