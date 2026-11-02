import { KeyCodeControlMessage } from '../controlMessage/KeyCodeControlMessage';
import KeyEvent from './android/KeyEvent';
import { KeyToCodeMap } from './KeyToCodeMap';
import UIEventsCode from '../UIEventsCode';

export interface KeyEventListener {
    onKeyEvent: (event: KeyCodeControlMessage) => void;
}

// Keys forwarded to the device even when "Capture keyboard" is off
export const ARROW_KEYS: ReadonlySet<string> = new Set([
    UIEventsCode.ArrowUp,
    UIEventsCode.ArrowDown,
    UIEventsCode.ArrowLeft,
    UIEventsCode.ArrowRight,
]);

export class KeyInputHandler {
    private static readonly repeatCounter: Map<number, number> = new Map();
    // listener -> allowed `KeyboardEvent.code` values (undefined = all mapped keys)
    private static readonly listeners: Map<KeyEventListener, ReadonlySet<string> | undefined> = new Map();
    private static isEditable(target: EventTarget | null): boolean {
        if (!(target instanceof HTMLElement)) {
            return false;
        }
        return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
    }
    private static handler = (event: Event): void => {
        const keyboardEvent = event as KeyboardEvent;
        const keyCode = KeyToCodeMap.get(keyboardEvent.code);
        if (!keyCode) {
            return;
        }
        const editable = KeyInputHandler.isEditable(keyboardEvent.target);
        const receivers: KeyEventListener[] = [];
        KeyInputHandler.listeners.forEach((filter, listener) => {
            // filtered listeners leave keys typed into form fields alone
            if (filter && (editable || !filter.has(keyboardEvent.code))) {
                return;
            }
            receivers.push(listener);
        });
        if (!receivers.length) {
            return;
        }
        let action: typeof KeyEvent.ACTION_DOWN | typeof KeyEvent.ACTION_DOWN;
        let repeatCount = 0;
        if (keyboardEvent.type === 'keydown') {
            action = KeyEvent.ACTION_DOWN;
            if (keyboardEvent.repeat) {
                let count = KeyInputHandler.repeatCounter.get(keyCode);
                if (typeof count !== 'number') {
                    count = 1;
                } else {
                    count++;
                }
                repeatCount = count;
                KeyInputHandler.repeatCounter.set(keyCode, count);
            }
        } else if (keyboardEvent.type === 'keyup') {
            action = KeyEvent.ACTION_UP;
            KeyInputHandler.repeatCounter.delete(keyCode);
        } else {
            return;
        }
        const metaState =
            (keyboardEvent.getModifierState('Alt') ? KeyEvent.META_ALT_ON : 0) |
            (keyboardEvent.getModifierState('Shift') ? KeyEvent.META_SHIFT_ON : 0) |
            (keyboardEvent.getModifierState('Control') ? KeyEvent.META_CTRL_ON : 0) |
            (keyboardEvent.getModifierState('Meta') ? KeyEvent.META_META_ON : 0) |
            (keyboardEvent.getModifierState('CapsLock') ? KeyEvent.META_CAPS_LOCK_ON : 0) |
            (keyboardEvent.getModifierState('ScrollLock') ? KeyEvent.META_SCROLL_LOCK_ON : 0) |
            (keyboardEvent.getModifierState('NumLock') ? KeyEvent.META_NUM_LOCK_ON : 0);

        const controlMessage: KeyCodeControlMessage = new KeyCodeControlMessage(
            action,
            keyCode,
            repeatCount,
            metaState,
        );
        receivers.forEach((listener) => {
            listener.onKeyEvent(controlMessage);
        });
        event.preventDefault();
    };
    private static attachListeners(): void {
        document.body.addEventListener('keydown', this.handler);
        document.body.addEventListener('keyup', this.handler);
    }
    private static detachListeners(): void {
        document.body.removeEventListener('keydown', this.handler);
        document.body.removeEventListener('keyup', this.handler);
    }
    public static addEventListener(listener: KeyEventListener, onlyCodes?: ReadonlySet<string>): void {
        if (!this.listeners.size) {
            this.attachListeners();
        }
        this.listeners.set(listener, onlyCodes);
    }
    public static removeEventListener(listener: KeyEventListener): void {
        if (!this.listeners.delete(listener)) {
            return;
        }
        if (!this.listeners.size) {
            this.detachListeners();
        }
    }
}
