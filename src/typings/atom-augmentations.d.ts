/**
 * `@types/atom` stopped being updated during the Atom sunset and is missing a
 * few members that Pulsar still exposes. Declare them here rather than casting
 * at each call site.
 */
import 'atom';

declare module 'atom' {
  interface TextEditor {
    /** Present on every editor, including the mini editors used in panels. */
    destroy(): void;
  }
}
