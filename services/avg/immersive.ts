import { useSyncExternalStore } from 'react';

type ImmersiveState = { owner: string; active: boolean; followLatest: boolean };
let current: ImmersiveState = { owner: '', active: false, followLatest: false };
const listeners = new Set<() => void>();
export const setAvgImmersive = (owner: string, active: boolean, followLatest = false) => {
    current = { owner: active ? owner : '', active, followLatest: active && followLatest };
    listeners.forEach(listener => listener());
    if (!active && document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
};
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const useAvgImmersive = () => useSyncExternalStore(subscribe, () => current);
export const exitAvgImmersiveOwner = (owner: string) => {
    window.setTimeout(() => { if (current.owner === owner) setAvgImmersive(owner, false); }, 0);
};

export const isAvgInteractiveTarget = (target: EventTarget | null) => target instanceof Element
    && !!target.closest('button,a,input,textarea,select,option,label,[contenteditable], [data-avg-no-advance]');
