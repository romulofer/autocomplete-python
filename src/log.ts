const PREFIX = 'autocomplete-python:';

/** Only emitted when the `outputDebug` setting is on; it is very chatty. */
export function debug(...message: unknown[]): void {
  if (atom.config.get('autocomplete-python.outputDebug')) {
    console.debug(PREFIX, ...message);
  }
}

export function warning(...message: unknown[]): void {
  console.warn(PREFIX, ...message);
}

export function error(...message: unknown[]): void {
  console.error(PREFIX, ...message);
}
