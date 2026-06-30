export const normalizeBodyPartVitals = (
    currentRaw: unknown,
    maxRaw: unknown,
    statusRaw: unknown
): { current: number; max: number; status: string } => {
    const max = Math.max(0, Number.isFinite(Number(maxRaw)) ? Number(maxRaw) : 0);
    const status = typeof statusRaw === 'string' ? statusRaw.trim() : '';
    const rawCurrent = Number.isFinite(Number(currentRaw)) ? Number(currentRaw) : max;

    if (max <= 0) {
        return { current: 0, max, status };
    }

    const normalizedStatus = status || '正常';
    const shouldRecoverNormalZero = rawCurrent <= 0 && (!status || status === '正常');
    const current = shouldRecoverNormalZero
        ? max
        : Math.max(0, Math.min(rawCurrent, max));

    return {
        current,
        max,
        status: normalizedStatus
    };
};
