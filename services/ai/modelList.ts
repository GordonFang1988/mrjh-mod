import { getOpenCodeUrl, requestApi, type ApiRequestContext } from './apiTransport';

export const modelListUrls = (baseUrl: string): string[] => {
    const base = baseUrl.replace(/\/+$/, '');
    const openCode = getOpenCodeUrl(base);
    const root = openCode?.pathname.match(/^(\/zen\/(?:go\/)?v1)(?:\/(?:chat\/completions|responses|messages|models(?:\/[^/]+)?))?\/?$/)?.[1];
    if (openCode && root) {
        openCode.pathname = `${root}/models`;
        return [openCode.href];
    }
    const normalized = base.replace(/\/v1$/i, '');
    return Array.from(new Set([`${normalized}/v1/models`, `${normalized}/models`, `${base}/models`]));
};

export const fetchApiModels = async (
    baseUrl: string,
    init?: RequestInit,
    context?: ApiRequestContext
): Promise<string[] | null> => {
    for (const url of modelListUrls(baseUrl)) {
        const response = await requestApi(url, init, context);
        if (!response.ok) {
            if (getOpenCodeUrl(url)) throw new Error(`OpenCode 代理请求失败（HTTP ${response.status}）。`);
            continue;
        }
        const data = await response.json();
        if (data && Array.isArray(data.data)) return data.data.map((model: any) => model?.id).filter(Boolean);
    }
    return null;
};
