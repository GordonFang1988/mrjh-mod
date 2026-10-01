import { useSyncExternalStore } from 'react';

export type AvgDisplayPreferences = {
    scale: number;
    offsetX: number;
    offsetY: number;
    recededScale: number;
    recededOpacity: number;
};
export const DEFAULT_AVG_DISPLAY: AvgDisplayPreferences = {
    scale: 100, offsetX: 0, offsetY: 0, recededScale: 76, recededOpacity: 60
};
const KEY = 'mrjh-avg-display-v1';
const EVENT = 'mrjh-avg-display-changed';
const clamp = (value: unknown, fallback: number, min: number, max: number) =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
export const normalizeAvgDisplay = (value: Partial<AvgDisplayPreferences> = {}): AvgDisplayPreferences => ({
    scale: clamp(value.scale, 100, 50, 150),
    offsetX: clamp(value.offsetX, 0, -40, 60),
    offsetY: clamp(value.offsetY, 0, -40, 40),
    recededScale: clamp(value.recededScale, 76, 40, 100),
    recededOpacity: clamp(value.recededOpacity, 60, 0, 100)
});
let cachedRaw: string | null | undefined;
let cached = DEFAULT_AVG_DISPLAY;
export const readAvgDisplay = (): AvgDisplayPreferences => {
    let raw: string | null = null;
    try { raw = localStorage.getItem(KEY); } catch { return cached; }
    if (raw !== cachedRaw) {
        cachedRaw = raw;
        try {
            const parsed = raw ? JSON.parse(raw) : {};
            cached = normalizeAvgDisplay(parsed && typeof parsed === 'object' ? parsed : {});
        } catch { cached = DEFAULT_AVG_DISPLAY; }
    }
    return cached;
};
export const saveAvgDisplay = (value: AvgDisplayPreferences): void => {
    localStorage.setItem(KEY, JSON.stringify(normalizeAvgDisplay(value)));
    window.dispatchEvent(new Event(EVENT));
};
const subscribe = (callback: () => void) => {
    window.addEventListener(EVENT, callback);
    window.addEventListener('storage', callback);
    return () => { window.removeEventListener(EVENT, callback); window.removeEventListener('storage', callback); };
};
export const useAvgDisplay = () => useSyncExternalStore(subscribe, readAvgDisplay, () => DEFAULT_AVG_DISPLAY);
export const avgDisplayStyle = (value: AvgDisplayPreferences) => ({
    '--avg-user-scale': value.scale / 100,
    '--avg-user-x': `${value.offsetX}%`,
    '--avg-user-y': `${-value.offsetY}%`,
    '--avg-receded-scale': value.recededScale / 100,
    '--avg-receded-opacity': value.recededOpacity / 100
}) as React.CSSProperties;
