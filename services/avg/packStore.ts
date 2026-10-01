import { strFromU8, Unzip, UnzipInflate } from 'fflate';
import type { AvgPortraitAsset, AvgSceneAsset } from '../../models/avg';
import { parseAvgManifest } from './manifest';

const DB_NAME = 'MRJHAvgArtPacks';
const PACKS = 'packs';
const FILES = 'files';
const ACTIVE = 'active';
const PACK_IMAGE_PREFIX = 'avgpack://';
type PackRecord = { key: string; packId: string; packVersion: string; namespace: string; manifest: unknown; installedAt: number };
type FileRecord = { key: string; namespace: string; path: string; blob: Blob };

let catalog: { scenes: AvgSceneAsset[]; portraits: AvgPortraitAsset[] } = { scenes: [], portraits: [] };
let loading: Promise<void> | undefined;
let loaded = false;

const request = <T,>(value: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () => reject(value.error || new Error('AVG 图包存储失败'));
});
const transactionDone = (tx: IDBTransaction): Promise<void> => new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('AVG 图包存储失败'));
    tx.onabort = () => reject(tx.error || new Error('AVG 图包存储中断'));
});
const openDb = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
    const opening = indexedDB.open(DB_NAME, 1);
    opening.onupgradeneeded = () => {
        const db = opening.result;
        db.createObjectStore(PACKS, { keyPath: 'key' });
        const files = db.createObjectStore(FILES, { keyPath: 'key' });
        files.createIndex('namespace', 'namespace');
        db.createObjectStore(ACTIVE, { keyPath: 'packId' });
    };
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => reject(opening.error || new Error('无法打开 AVG 图包存储'));
});
const safePath = (path: string): boolean => /^[a-zA-Z0-9][a-zA-Z0-9/_-]*\.(?:png|webp|jpe?g)$/i.test(path)
    && !path.split('/').includes('..');
const packKey = (packId: string, version: string): string => `${packId}@${version}`;
const packImage = (key: string, path: string): string => `${PACK_IMAGE_PREFIX}${key}/${path}`;

export const isAvgPackImage = (value: unknown): value is string =>
    typeof value === 'string' && value.startsWith(PACK_IMAGE_PREFIX);

export const namespaceAvgPortraits = (portraits: AvgPortraitAsset[], key: string): AvgPortraitAsset[] =>
    portraits.map(asset => ({ ...asset, id: `${key}:${asset.id}`,
        baseAssetId: asset.baseAssetId ? `${key}:${asset.baseAssetId}` : undefined }));

/** Exact source mapping is used only to restore a missing saved asset, never for first matching. */
export const findUniqueLegacyAvgAsset = <T extends {legacyAssetIds?: string[]}>(id: string | undefined, assets: T[]): T | undefined => {
    if (!id) return undefined;
    const matches = assets.filter(asset => asset.legacyAssetIds?.includes(id));
    return matches.length === 1 ? matches[0] : undefined;
};
export const getAvgPackCatalog = (): { scenes: AvgSceneAsset[]; portraits: AvgPortraitAsset[] } => catalog;
export const getAvgArtThemes = (): string[] => [...new Set([...catalog.scenes, ...catalog.portraits]
    .map(asset => asset.themeId).filter((id): id is string => !!id))].sort();

export const loadAvgPackCatalog = async (refresh = false): Promise<void> => {
    if (loaded && !refresh) return;
    if (loading && !refresh) return loading;
    if (loading) await loading;
    loading = (async () => {
        const db = await openDb();
        try {
            const tx = db.transaction([PACKS, ACTIVE], 'readonly');
            const done = transactionDone(tx);
            const [packs, active] = await Promise.all([
                request(tx.objectStore(PACKS).getAll() as IDBRequest<PackRecord[]>),
                request(tx.objectStore(ACTIVE).getAll() as IDBRequest<Array<{ packId: string; key: string }>>)
            ]);
            await done;
            const activeKeys = new Set(active.map(item => item.key));
            const scenes: AvgSceneAsset[] = [];
            const portraits: AvgPortraitAsset[] = [];
            for (const record of packs.filter(item => activeKeys.has(item.key))) {
                const parsed = parseAvgManifest(record.manifest, file => packImage(record.key, file));
                scenes.push(...parsed.scenes.map(asset => ({ ...asset, id: `${record.key}:${asset.id}` })));
                portraits.push(...namespaceAvgPortraits(parsed.portraits, record.key));
            }
            catalog = { scenes, portraits };
            loaded = true;
        } finally {
            db.close();
        }
    })();
    try { await loading; } finally { loading = undefined; }
};

export const listAvgArtPacks = async (): Promise<Array<{ key: string; active: boolean; scenes: number; portraits: number }>> => {
    const db = await openDb();
    try {
        const tx = db.transaction([PACKS, ACTIVE], 'readonly');
        const done = transactionDone(tx);
        const [packs, active] = await Promise.all([
            request(tx.objectStore(PACKS).getAll() as IDBRequest<PackRecord[]>),
            request(tx.objectStore(ACTIVE).getAll() as IDBRequest<Array<{ packId: string; key: string }>>)
        ]);
        await done;
        const activeKeys = new Set(active.map(item => item.key));
        return packs.map(item => {
            const parsed = parseAvgManifest(item.manifest);
            return { key: item.key, active: activeKeys.has(item.key), scenes: parsed.scenes.length, portraits: parsed.portraits.length };
        });
    } finally {
        db.close();
    }
};

/** Removes one installed version; saved game data is untouched. */
export const uninstallAvgArtPack = async (key: string): Promise<void> => {
    const db = await openDb();
    let namespace: string | undefined;
    try {
        const tx = db.transaction([PACKS, ACTIVE], 'readwrite');
        const done = transactionDone(tx);
        const record = await request(tx.objectStore(PACKS).get(key) as IDBRequest<PackRecord | undefined>);
        if (record) {
            namespace = record.namespace;
            const active = await request(tx.objectStore(ACTIVE).get(record.packId) as IDBRequest<{packId:string;key:string} | undefined>);
            tx.objectStore(PACKS).delete(key);
            if (active?.key === key) {
                const records = await request(tx.objectStore(PACKS).getAll() as IDBRequest<PackRecord[]>);
                const fallback = records.filter(item => item.packId === record.packId && item.key !== key)
                    .sort((a,b) => b.installedAt - a.installedAt)[0];
                if (fallback) tx.objectStore(ACTIVE).put({packId:record.packId,key:fallback.key});
                else tx.objectStore(ACTIVE).delete(record.packId);
            }
        }
        await done;
    } finally { db.close(); }
    if (namespace) await removeFiles(namespace);
    await loadAvgPackCatalog(true);
};

export const getAvgPackImageBlob = async (image: string): Promise<Blob | undefined> => {
    if (!isAvgPackImage(image)) return undefined;
    const relative = image.slice(PACK_IMAGE_PREFIX.length);
    const slash = relative.indexOf('/');
    if (slash < 1) return undefined;
    const key = relative.slice(0, slash);
    const path = relative.slice(slash + 1);
    if (!safePath(path)) return undefined;
    const db = await openDb();
    try {
        const tx = db.transaction([PACKS, FILES], 'readonly');
        const done = transactionDone(tx);
        const record = await request(tx.objectStore(PACKS).get(key) as IDBRequest<PackRecord | undefined>);
        const file = record
            ? await request(tx.objectStore(FILES).get(`${record.namespace}:${path}`) as IDBRequest<FileRecord | undefined>)
            : undefined;
        await done;
        return file?.blob;
    } finally {
        db.close();
    }
};

const writeFile = async (namespace: string, path: string, blob: Blob): Promise<void> => {
    const db = await openDb();
    try {
        const tx = db.transaction(FILES, 'readwrite');
        const done = transactionDone(tx);
        tx.objectStore(FILES).put({ key: `${namespace}:${path}`, namespace, path, blob } satisfies FileRecord);
        await done;
    } finally {
        db.close();
    }
};
const removeFiles = async (namespace: string): Promise<void> => {
    const db = await openDb();
    try {
        const tx = db.transaction(FILES, 'readwrite');
        const done = transactionDone(tx);
        const cursor = tx.objectStore(FILES).index('namespace').openCursor(IDBKeyRange.only(namespace));
        cursor.onsuccess = () => {
            const row = cursor.result;
            if (row) { row.delete(); row.continue(); }
        };
        await done;
    } finally {
        db.close();
    }
};

/** ZIP image bytes stay in a separate database; saves contain only stable pack references. */
export const importAvgArtPack = async (archive: Blob): Promise<{ key: string; scenes: number; portraits: number }> => {
    if (archive.size > 4 * 1024 * 1024 * 1024) throw new Error('AVG 图包 ZIP 超过 4 GB');
    const namespace = globalThis.crypto?.randomUUID?.() || `stage-${Date.now()}`;
    const paths = new Set<string>();
    const writes = new Set<Promise<void>>();
    let manifestBytes: Uint8Array | undefined;
    let expanded = 0;
    let count = 0;
    let failure: Error | undefined;
    let committed = false;
    const fail = (error: unknown) => { failure ||= error instanceof Error ? error : new Error(String(error)); };
    const unzipper = new Unzip(file => {
        if (failure) return;
        try {
            if (file.name.endsWith('/')) { file.ondata = () => undefined; file.start(); return; }
            count += 1;
            const path = file.name;
            if (count > 10000 || (!safePath(path) && path !== 'manifest.json' && path !== 'PROVENANCE.json') || paths.has(path)) {
                throw new Error(`AVG 图包文件名无效或重复：${path}`);
            }
            if (file.compression !== 0 && file.compression !== 8) throw new Error(`不支持的 ZIP 压缩方式：${path}`);
            paths.add(path);
            const chunks: Uint8Array[] = [];
            let size = 0;
            file.ondata = (error, chunk, final) => {
                if (error) { fail(error); return; }
                size += chunk.byteLength;
                expanded += chunk.byteLength;
                if (size > 100 * 1024 * 1024 || expanded > 8 * 1024 * 1024 * 1024) {
                    file.terminate(); fail(new Error(`AVG 图包文件过大：${path}`)); return;
                }
                if (chunk.byteLength) chunks.push(chunk.slice());
                if (!final || failure) return;
                const bytes = new Uint8Array(size);
                let offset = 0;
                chunks.forEach(part => { bytes.set(part, offset); offset += part.byteLength; });
                if (path === 'manifest.json') { manifestBytes = bytes; return; }
                // Optional provenance is documentation, never an image resource.
                if (path === 'PROVENANCE.json') return;
                const mime = path.toLowerCase().endsWith('.png') ? 'image/png'
                    : path.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/jpeg';
                const write = writeFile(namespace, path, new Blob([bytes.buffer as ArrayBuffer], { type: mime }));
                writes.add(write);
                void write.catch(fail).finally(() => writes.delete(write));
            };
            file.start();
        } catch (error) { fail(error); }
    });
    unzipper.register(UnzipInflate);
    try {
        const reader = archive.stream().getReader();
        for (;;) {
            const next = await reader.read();
            if (next.done) break;
            if (failure) throw failure;
            unzipper.push(next.value, false);
            if (writes.size) await Promise.all([...writes]);
        }
        unzipper.push(new Uint8Array(0), true);
        if (writes.size) await Promise.all([...writes]);
        if (failure) throw failure;
        if (!manifestBytes) throw new Error('AVG 图包缺少 manifest.json');
        const manifest = JSON.parse(strFromU8(manifestBytes)) as Record<string, unknown>;
        const packId = manifest.packId;
        const packVersion = manifest.packVersion;
        if (typeof packId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,79}$/.test(packId)
            || typeof packVersion !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,39}$/.test(packVersion)) {
            throw new Error('AVG 图包须声明 packId 和 packVersion');
        }
        const parsed = parseAvgManifest(manifest);
        if (parsed.errors.length) throw new Error(`AVG 图包清单错误：${parsed.errors[0]}`);
        if (parsed.scenes.length + parsed.portraits.length === 0) throw new Error('AVG 图包没有可用素材');
        const expected = [...(Array.isArray(manifest.scenes) ? manifest.scenes : []),
            ...(Array.isArray(manifest.portraits) ? manifest.portraits : [])]
            .map((item: any) => item?.file).filter((item): item is string => typeof item === 'string');
        for (const path of expected) if (!paths.has(path)) throw new Error(`AVG 图包缺少图片：${path}`);
        const key = packKey(packId, packVersion);
        const db = await openDb();
        try {
            const tx = db.transaction([PACKS, ACTIVE], 'readwrite');
            const done = transactionDone(tx);
            const exists = await request(tx.objectStore(PACKS).get(key));
            if (exists) throw new Error(`AVG 图包版本已安装：${key}`);
            tx.objectStore(PACKS).put({ key, packId, packVersion, namespace, manifest, installedAt: Date.now() } satisfies PackRecord);
            tx.objectStore(ACTIVE).put({ packId, key });
            await done;
            committed = true;
        } finally { db.close(); }
        await loadAvgPackCatalog(true);
        return { key, scenes: parsed.scenes.length, portraits: parsed.portraits.length };
    } catch (error) {
        await Promise.allSettled([...writes]);
        if (!committed) await removeFiles(namespace);
        throw error;
    }
};
