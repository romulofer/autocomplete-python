"use strict";
/**
 * Building the command line for "run this file".
 *
 * Pure: it takes an interpreter, a file and the settings, and returns what to
 * spawn. No process, no editor, no filesystem.
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
exports.splitArguments = splitArguments;
exports.projectRootFor = projectRootFor;
exports.resolveWorkingDirectory = resolveWorkingDirectory;
exports.buildRunCommand = buildRunCommand;
exports.describeRunCommand = describeRunCommand;
const path = __importStar(require("path"));
/**
 * Split a settings string into arguments the way a shell splits a command line,
 * minus the parts that only make sense with a shell.
 *
 * A quote can open partway through a word and the two halves stay one argument,
 * so `--json='{"a": 1}'` and `--name="a b"` survive as single arguments rather
 * than being cut at the space. Only the quote characters are removed; nothing is
 * treated as a shell operator and backslashes are literal, because these
 * arguments are handed straight to `spawn` with no shell in between.
 */
function splitArguments(value) {
    const args = [];
    let current = '';
    // `null` outside a quoted run, otherwise the quote character we are inside.
    let quote = null;
    // Distinguishes a real (possibly empty, e.g. `""`) argument from the gaps
    // between arguments, so trailing whitespace does not push an empty string.
    let started = false;
    for (const char of value) {
        if (quote) {
            if (char === quote)
                quote = null;
            else
                current += char;
            continue;
        }
        if (char === '"' || char === "'") {
            quote = char;
            started = true;
            continue;
        }
        if (/\s/.test(char)) {
            if (started) {
                args.push(current);
                current = '';
                started = false;
            }
            continue;
        }
        current += char;
        started = true;
    }
    if (started)
        args.push(current);
    return args;
}
/**
 * The project root containing `filePath`, or `null` when it sits outside every
 * open project. The longest matching root wins, so a nested project root is
 * preferred over its parent.
 */
function projectRootFor(filePath, projectPaths) {
    const matches = projectPaths.filter((projectPath) => filePath === projectPath ||
        filePath.startsWith(projectPath.endsWith(path.sep) ? projectPath : projectPath + path.sep));
    if (matches.length === 0)
        return null;
    return matches.reduce((longest, candidate) => candidate.length > longest.length ? candidate : longest);
}
/**
 * Where the script should run from.
 *
 * `file` mode matches what `python script.py` does in a terminal, which is what
 * relative paths inside the script expect. `project` mode matches how the code
 * usually runs in production, where the repository root is the working
 * directory. Falls back to the file's directory when the file is outside every
 * open project.
 */
function resolveWorkingDirectory(filePath, projectPaths, mode) {
    if (mode === 'project') {
        const root = projectRootFor(filePath, projectPaths);
        if (root)
            return root;
    }
    return path.dirname(filePath);
}
function buildRunCommand(input) {
    const { interpreter, filePath, scriptArguments = [], projectPaths = [], workingDirectory = 'file' } = input;
    return {
        command: interpreter,
        // `-u` keeps stdout unbuffered, so output appears as the script produces it
        // rather than all at once when it exits.
        args: ['-u', filePath, ...scriptArguments],
        cwd: resolveWorkingDirectory(filePath, projectPaths, workingDirectory)
    };
}
/** A short, readable form of the command, shown in the output header. */
function describeRunCommand(runCommand) {
    return [path.basename(runCommand.command), ...runCommand.args]
        .map((token) => (token.includes(' ') ? `"${token}"` : token))
        .join(' ');
}
//# sourceMappingURL=command.js.map