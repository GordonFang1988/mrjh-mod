export const OPENCODE_PROXY_URL = 'https://simc-llm-proxy.gordonfang1988.workers.dev/proxy';
const SESSION_STORAGE_PREFIX = 'mrjh-opencode-api-session:v1:';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ApiRequestContext = {
    sessionId?: string;
    apiProfileId?: string;
};

export const getOpenCodeUrl = (url: string | URL): URL | undefined => {
    try {
        const parsed = new URL(url);
        return parsed.hostname === 'opencode.ai' ? parsed : undefined;
    } catch {
        return undefined;
    }
};

// API-profile identity, not save identity. No credentials enter this storage key or value.
const resolveProfileSession = async (profileId?: string): Promise<string> => {
    if (!profileId?.trim()) throw new Error('OpenCode 请求缺少 API 档案标识，无法保存会话。');
    const storageKey = SESSION_STORAGE_PREFIX + encodeURIComponent(profileId.trim());
    const resolve = (): string => {
        try {
            const stored = localStorage.getItem(storageKey);
            if (stored && UUID_PATTERN.test(stored)) return stored;
            const created = crypto.randomUUID();
            localStorage.setItem(storageKey, created);
            if (localStorage.getItem(storageKey) !== created) throw new Error('Session was not persisted');
            return created;
        } catch {
            throw new Error('OpenCode 会话无法持久保存，请允许本站使用本地存储后重试。');
        }
    };
    // Serialize first-use creation across tabs where Web Locks are available.
    return typeof navigator !== 'undefined' && navigator.locks
        ? navigator.locks.request(storageKey, resolve)
        : resolve();
};

export const requestApi = async (
    url: string | URL,
    init?: RequestInit,
    context?: ApiRequestContext
): Promise<Response> => {
    const target = getOpenCodeUrl(url);
    if (!target) return fetch(url, init);
    if (target.protocol !== 'https:') throw new Error('OpenCode API 地址必须使用 HTTPS；请求未发送。');

    const headers = new Headers(init?.headers);
    const session = context?.sessionId?.trim() || headers.get('x-opencode-session')?.trim()
        || await resolveProfileSession(context?.apiProfileId);
    headers.set('X-LLM-Target-URL', target.href);
    headers.set('x-opencode-session', session);
    try {
        // Return the original Response; the existing caller owns status handling and stream reading.
        return await fetch(OPENCODE_PROXY_URL, { ...init, headers });
    } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
            // Keep the error type/status and original retry keywords; there is no direct fallback.
            error.message = `OpenCode 代理请求失败：${error.message}`;
        }
        throw error;
    }
};
