"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.debug = debug;
exports.warning = warning;
exports.error = error;
const PREFIX = 'autocomplete-python-pulsar:';
/** Only emitted when the `outputDebug` setting is on; it is very chatty. */
function debug(...message) {
    if (atom.config.get('autocomplete-python-pulsar.outputDebug')) {
        console.debug(PREFIX, ...message);
    }
}
function warning(...message) {
    console.warn(PREFIX, ...message);
}
function error(...message) {
    console.error(PREFIX, ...message);
}
//# sourceMappingURL=log.js.map