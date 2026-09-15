"use strict";
/**
 * The narrow slice of the host environment this package depends on.
 *
 * Everything below `src/host/` is the only place allowed to touch the `atom`
 * global, Node's `fs`, or `process.env`. The rest of the package takes these
 * interfaces as parameters, which is what makes the interesting logic -
 * interpreter discovery above all - testable without a running editor.
 */
Object.defineProperty(exports, "__esModule", { value: true });
//# sourceMappingURL=types.js.map