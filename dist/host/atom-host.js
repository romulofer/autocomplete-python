"use strict";
/**
 * Real implementations of the host interfaces, backed by Node and the `atom`
 * global. Importing this module is the only way the package reaches either.
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
exports.atomDiscoveryHost = exports.atomNotifier = exports.atomProjectPaths = exports.nodeEnvironment = exports.nodeFileSystem = void 0;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
exports.nodeFileSystem = {
    readDir(dirPath) {
        try {
            return fs.readdirSync(dirPath);
        }
        catch {
            return [];
        }
    },
    readFile(filePath) {
        try {
            return fs.readFileSync(filePath, 'utf8');
        }
        catch {
            return null;
        }
    },
    isFile(filePath) {
        try {
            return fs.statSync(filePath).isFile();
        }
        catch {
            return false;
        }
    },
    isDirectory(dirPath) {
        try {
            return fs.statSync(dirPath).isDirectory();
        }
        catch {
            return false;
        }
    },
    isExecutableFile(filePath) {
        try {
            if (!fs.statSync(filePath).isFile())
                return false;
            fs.accessSync(filePath, fs.constants.X_OK);
            return true;
        }
        catch {
            return false;
        }
    }
};
exports.nodeEnvironment = {
    platform: process.platform,
    homedir: () => os.homedir(),
    get: (name) => process.env[name],
    pathEntries: () => (process.env.PATH ?? '')
        .split(path.delimiter)
        .filter((entry) => entry.length > 0)
};
exports.atomProjectPaths = {
    getPaths: () => atom.project.getPaths()
};
exports.atomNotifier = {
    info: (message, options) => atom.notifications.addInfo(message, options),
    success: (message, options) => atom.notifications.addSuccess(message, options),
    warning: (message, options) => atom.notifications.addWarning(message, options),
    error: (message, options) => atom.notifications.addError(message, options)
};
exports.atomDiscoveryHost = {
    fs: exports.nodeFileSystem,
    env: exports.nodeEnvironment,
    project: exports.atomProjectPaths
};
//# sourceMappingURL=atom-host.js.map