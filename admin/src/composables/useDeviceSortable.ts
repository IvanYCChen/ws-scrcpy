import { onBeforeUnmount, watch, type Ref } from 'vue';
import Sortable from 'sortablejs';
import { toast } from 'vue-sonner';
import { useDeviceTracker } from '@/composables/useDeviceTracker';

export interface DeviceSortableOptions {
    /**
     * `handle`: drag only by the grip (mouse, table rows); the row itself moves through the list while dragging.
     * `press`: long-press anywhere on the item (touch, cards); a lifted copy follows the finger.
     */
    mode: Ref<'handle' | 'press'>;
    disabled?: Ref<boolean>;
}

// Sortable only accepts single class names, so the visuals live in assets/index.css.
const CHOSEN_CLASS = 'device-sort-chosen';
const GHOST_CLASS = 'device-sort-ghost';
const DRAG_CLASS = 'device-sort-drag';
const DRAGGING_BODY_CLASS = 'device-sorting';
const DRAGGING_TOUCH_BODY_CLASS = 'device-sorting-touch';
const LONG_PRESS_MS = 300;

/**
 * Drag-to-reorder for the device list. Items must carry `data-udid`, and only remembered devices
 * (`data-sortable`) can be dragged; they always come first in the list, so Sortable's draggable index
 * equals the position in the saved order.
 */
export function useDeviceSortable(container: Ref<HTMLElement | null | undefined>, options: DeviceSortableOptions): void {
    const { reorderDevice } = useDeviceTracker();
    let sortable: Sortable | null = null;

    function destroy(): void {
        sortable?.destroy();
        sortable = null;
        document.body.classList.remove(DRAGGING_BODY_CLASS, DRAGGING_TOUCH_BODY_CLASS);
    }

    function create(el: HTMLElement): void {
        const press = options.mode.value === 'press';
        // `supportPointer` is a real Sortable option that @types/sortablejs does not declare.
        const sortableOptions: Sortable.Options & { supportPointer?: boolean } = {
            draggable: '[data-sortable]',
            handle: press ? undefined : '[data-drag-handle]',
            // Taps on buttons and links keep working, and never start a drag (the grip itself may).
            filter: press ? 'button:not([data-drag-handle]), a, input' : undefined,
            preventOnFilter: false,
            delay: press ? LONG_PRESS_MS : 0,
            delayOnTouchOnly: true,
            touchStartThreshold: 5,
            // With pointer events, moving a lifted card makes Android Chrome start scrolling the page, which fires
            // `pointercancel` and drops the card mid-drag. Touch events let Sortable cancel the scroll instead.
            supportPointer: !press,
            // Scroll the page when the card is dragged near the top/bottom edge.
            scrollSensitivity: 80,
            scrollSpeed: 14,
            animation: 220,
            easing: 'cubic-bezier(0.2, 0, 0, 1)',
            forceFallback: true,
            fallbackOnBody: true,
            fallbackTolerance: 3,
            chosenClass: CHOSEN_CLASS,
            ghostClass: GHOST_CLASS,
            fallbackClass: DRAG_CLASS,
            disabled: options.disabled?.value ?? false,
            onChoose() {
                if (press) {
                    navigator.vibrate?.(15);
                }
            },
            onStart() {
                document.body.classList.add(DRAGGING_BODY_CLASS);
                if (press) {
                    document.body.classList.add(DRAGGING_TOUCH_BODY_CLASS);
                }
            },
            onEnd(event) {
                document.body.classList.remove(DRAGGING_BODY_CLASS, DRAGGING_TOUCH_BODY_CLASS);
                if (press && event.oldIndex !== event.newIndex) {
                    navigator.vibrate?.(10);
                }
                const { item, from, oldIndex, newIndex, newDraggableIndex } = event;
                if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) {
                    return;
                }
                // Put the node back where Vue rendered it; the list re-renders from the new order instead.
                item.remove();
                from.insertBefore(item, from.children[oldIndex] ?? null);
                const udid = item.dataset.udid;
                if (udid && newDraggableIndex !== undefined) {
                    reorderDevice(udid, newDraggableIndex).catch((error: Error) => {
                        toast.error('排序失敗', { description: error.message });
                    });
                }
            },
        };
        sortable = Sortable.create(el, sortableOptions);
    }

    watch(
        [container, options.mode],
        ([el]) => {
            destroy();
            if (el) {
                create(el);
            }
        },
        { flush: 'post' },
    );

    if (options.disabled) {
        watch(options.disabled, (value) => sortable?.option('disabled', value));
    }

    onBeforeUnmount(destroy);
}
