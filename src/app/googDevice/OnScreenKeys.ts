import KeyEvent from './android/KeyEvent';
import { KeyCodeControlMessage } from '../controlMessage/KeyCodeControlMessage';
import { ControlMessage } from '../controlMessage/ControlMessage';

const KEYS = [
    { name: 'up', title: 'Up', code: KeyEvent.KEYCODE_DPAD_UP },
    { name: 'left', title: 'Left', code: KeyEvent.KEYCODE_DPAD_LEFT },
    { name: 'right', title: 'Right', code: KeyEvent.KEYCODE_DPAD_RIGHT },
    { name: 'down', title: 'Down', code: KeyEvent.KEYCODE_DPAD_DOWN },
    { name: 'space', title: 'Space', code: KeyEvent.KEYCODE_SPACE },
];

// Pointing up; CSS rotates it for the other directions. SVG, not ▲/▶ text, which some phones draw as emoji
const ARROW_SVG = '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M12 6l7 10H5z" fill="currentColor"/></svg>';

// Same feel as a held physical key: first repeat after a pause, then a steady rate
const REPEAT_DELAY = 400;
const REPEAT_INTERVAL = 50;

export interface KeySender {
    sendMessage(message: ControlMessage): void;
}

// Arrow keys and space drawn over the video, for touch screens without a keyboard
export class OnScreenKeys {
    private readonly holder: HTMLElement;
    private readonly timers: Map<number, ReturnType<typeof setTimeout>> = new Map();

    constructor(private readonly sender: KeySender) {
        const holder = (this.holder = document.createElement('div'));
        holder.className = 'on-screen-keys';
        const dpad = document.createElement('div');
        dpad.className = 'on-screen-dpad';
        holder.appendChild(dpad);
        KEYS.forEach((key) => {
            const button = document.createElement('button');
            button.className = `on-screen-key on-screen-key-${key.name}`;
            button.title = key.title;
            if (key.code === KeyEvent.KEYCODE_SPACE) {
                button.textContent = key.title;
            } else {
                button.innerHTML = ARROW_SVG;
            }
            this.bind(button, key.code);
            (key.code === KeyEvent.KEYCODE_SPACE ? holder : dpad).appendChild(button);
        });
    }

    // Sensible default: shown where there is probably no physical keyboard
    public static isTouchScreen(): boolean {
        return window.matchMedia('(pointer: coarse)').matches;
    }

    public getElement(): HTMLElement {
        return this.holder;
    }

    public setVisible(visible: boolean): void {
        this.holder.style.display = visible ? '' : 'none';
        if (!visible) {
            this.releaseAll();
        }
    }

    public release(): void {
        this.releaseAll();
        this.holder.parentElement?.removeChild(this.holder);
    }

    private bind(button: HTMLButtonElement, code: number): void {
        const down = (event: PointerEvent): void => {
            event.preventDefault();
            if (this.timers.has(code)) {
                return;
            }
            button.setPointerCapture(event.pointerId);
            button.classList.add('active');
            let repeat = 0;
            this.send(KeyEvent.ACTION_DOWN, code, repeat);
            const tick = (): void => {
                this.send(KeyEvent.ACTION_DOWN, code, ++repeat);
                this.timers.set(code, setTimeout(tick, REPEAT_INTERVAL));
            };
            this.timers.set(code, setTimeout(tick, REPEAT_DELAY));
        };
        const up = (event: PointerEvent): void => {
            event.preventDefault();
            button.classList.remove('active');
            this.stop(code);
        };
        button.addEventListener('pointerdown', down);
        button.addEventListener('pointerup', up);
        button.addEventListener('pointercancel', up);
        button.addEventListener('lostpointercapture', up);
        // long press on mobile would otherwise open the context menu
        button.addEventListener('contextmenu', (event) => event.preventDefault());
    }

    private stop(code: number): void {
        const timer = this.timers.get(code);
        if (timer === undefined) {
            return;
        }
        clearTimeout(timer);
        this.timers.delete(code);
        this.send(KeyEvent.ACTION_UP, code, 0);
    }

    private releaseAll(): void {
        Array.from(this.timers.keys()).forEach((code) => this.stop(code));
        this.holder.querySelectorAll('.active').forEach((el) => el.classList.remove('active'));
    }

    private send(action: number, code: number, repeat: number): void {
        this.sender.sendMessage(new KeyCodeControlMessage(action, code, repeat, 0));
    }
}
