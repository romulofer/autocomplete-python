"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RunPanel = exports.RUN_PANEL_URI = void 0;
exports.RUN_PANEL_URI = 'atom://autocomplete-python-pulsar/output';
/**
 * Beyond this many lines the pane is trimmed from the top. A script in a loop
 * can produce output faster than anyone can read it, and an unbounded pane
 * eventually takes the window down with it.
 */
const MAX_LINES = 5000;
/**
 * The bottom-dock pane showing a script's output.
 *
 * A dock item rather than a modal panel: output is something you read while
 * editing, and the dock remembers its size between runs.
 */
class RunPanel {
    onStopRequested;
    onInput;
    onEndInput;
    element;
    outputElement;
    statusElement;
    commandElement;
    stopButton;
    inputRow;
    inputField;
    lineCount = 0;
    constructor(onStopRequested, onInput, onEndInput) {
        this.onStopRequested = onStopRequested;
        this.onInput = onInput;
        this.onEndInput = onEndInput;
        this.element = document.createElement('div');
        this.element.classList.add('autocomplete-python-run-panel');
        const header = document.createElement('div');
        header.classList.add('autocomplete-python-run-header');
        this.commandElement = document.createElement('span');
        this.commandElement.classList.add('command');
        this.statusElement = document.createElement('span');
        this.statusElement.classList.add('status');
        this.stopButton = document.createElement('button');
        this.stopButton.classList.add('btn', 'btn-error', 'stop');
        this.stopButton.textContent = 'Stop';
        this.stopButton.style.display = 'none';
        this.stopButton.addEventListener('click', () => this.onStopRequested());
        const clearButton = document.createElement('button');
        clearButton.classList.add('btn', 'clear');
        clearButton.textContent = 'Clear';
        clearButton.addEventListener('click', () => this.clear());
        header.append(this.commandElement, this.statusElement, this.stopButton, clearButton);
        this.outputElement = document.createElement('pre');
        this.outputElement.classList.add('autocomplete-python-run-output');
        // Input row: hidden until a script is running, so it does not invite typing
        // when nothing would read it.
        this.inputRow = document.createElement('div');
        this.inputRow.classList.add('autocomplete-python-run-input');
        this.inputRow.style.display = 'none';
        this.inputField = document.createElement('input');
        this.inputField.type = 'text';
        this.inputField.classList.add('input-text', 'native-key-bindings');
        this.inputField.setAttribute('placeholder', 'stdin: type and press Enter');
        this.inputField.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.submitInput();
            }
        });
        const eofButton = document.createElement('button');
        eofButton.classList.add('btn', 'eof');
        eofButton.textContent = 'EOF';
        eofButton.setAttribute('title', 'Close stdin (Ctrl+D)');
        eofButton.addEventListener('click', () => this.onEndInput());
        this.inputRow.append(this.inputField, eofButton);
        this.element.append(header, this.outputElement, this.inputRow);
    }
    submitInput() {
        // A newline is what a terminal sends on Enter and what `input()` waits for.
        this.onInput(this.inputField.value + '\n');
        this.inputField.value = '';
    }
    // --- Pulsar dock item contract -----------------------------------------
    /**
     * Pulsar resolves a pane item's view through `atom.views.getView`, which
     * needs this method. Without it the item is opened but never rendered, so
     * the dock stays empty.
     */
    getElement() {
        return this.element;
    }
    getTitle() {
        return 'Python Output';
    }
    getURI() {
        return exports.RUN_PANEL_URI;
    }
    getDefaultLocation() {
        return 'bottom';
    }
    getAllowedLocations() {
        return ['bottom', 'right', 'left'];
    }
    getIconName() {
        return 'terminal';
    }
    serialize() {
        return { deserializer: 'AutocompletePythonRunPanel' };
    }
    destroy() {
        this.element.remove();
    }
    // --- content ------------------------------------------------------------
    clear() {
        this.outputElement.textContent = '';
        this.lineCount = 0;
    }
    /**
     * Set the output and input font size in pixels. `0` clears the override, so
     * the pane goes back to inheriting the editor font size from the stylesheet.
     */
    setFontSize(pixels) {
        const value = pixels > 0 ? `${pixels}px` : '';
        this.outputElement.style.fontSize = value;
        this.inputField.style.fontSize = value;
    }
    handle(event) {
        switch (event.type) {
            case 'started':
                this.commandElement.textContent = event.description;
                this.setStatus(`running in ${event.cwd}`, 'running');
                this.stopButton.style.display = '';
                this.inputRow.style.display = '';
                break;
            case 'stdout':
                this.append(event.text, 'stdout');
                break;
            case 'stderr':
                this.append(event.text, 'stderr');
                break;
            case 'stdin':
                this.append(event.text, 'stdin');
                break;
            case 'exited': {
                this.stopButton.style.display = 'none';
                this.inputRow.style.display = 'none';
                const seconds = (event.durationMs / 1000).toFixed(2);
                if (event.code === null) {
                    this.setStatus(`stopped after ${seconds}s`, 'stopped');
                }
                else if (event.code === 0) {
                    this.setStatus(`finished in ${seconds}s`, 'ok');
                }
                else {
                    this.setStatus(`exited with ${event.code} after ${seconds}s`, 'error');
                }
                break;
            }
            case 'failed':
                this.stopButton.style.display = 'none';
                this.inputRow.style.display = 'none';
                this.setStatus('failed to start', 'error');
                this.append(`${event.message}\n`, 'stderr');
                break;
        }
    }
    setStatus(text, state) {
        this.statusElement.textContent = text;
        this.statusElement.dataset.state = state;
    }
    append(text, stream) {
        const wasAtBottom = this.isScrolledToBottom();
        const span = document.createElement('span');
        span.classList.add(stream);
        span.textContent = text;
        this.outputElement.append(span);
        this.lineCount += countLines(text);
        this.trimIfTooLong();
        // Follow the output, unless the user has scrolled up to read something.
        if (wasAtBottom)
            this.outputElement.scrollTop = this.outputElement.scrollHeight;
    }
    isScrolledToBottom() {
        const { scrollTop, scrollHeight, clientHeight } = this.outputElement;
        return scrollHeight - scrollTop - clientHeight < 20;
    }
    trimIfTooLong() {
        if (this.lineCount <= MAX_LINES)
            return;
        while (this.outputElement.firstChild && this.lineCount > MAX_LINES) {
            const first = this.outputElement.firstChild;
            this.lineCount -= countLines(first.textContent ?? '');
            first.remove();
        }
    }
}
exports.RunPanel = RunPanel;
function countLines(text) {
    let count = 0;
    for (const character of text)
        if (character === '\n')
            count += 1;
    return count;
}
//# sourceMappingURL=run-panel.js.map