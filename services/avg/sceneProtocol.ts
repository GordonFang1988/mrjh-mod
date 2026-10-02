// A single scanner owns camera boundaries across parsing, polish, saved logs and
// diagnostics. Models sometimes mix Chinese brackets with XML closing syntax.
const markerStart = /(?:[<＜〈][ \t]*\/?[ \t]*镜头(?=\s|[\/／>＞〉])|[【\[][ \t]*镜头(?=[ \t]+ref[ \t]*[=＝]))/gi;
const quoteEnds: Record<string, string> = { '"': '"', "'": "'", '“': '”', '‘': '’' };
export const scanAvgSceneMarkers = (body: string) => {
    const tokens: Array<{ text: string; index: number; ref?: string }> = [];
    let consumed = 0;
    for (const match of body.matchAll(markerStart)) {
        const index = match.index!;
        if (index < consumed) continue;
        let end = index + match[0].length;
        let quote: string | undefined;
        for (; end < body.length; end++) {
            const char = body[end];
            if (char === '\r' || char === '\n') break;
            if (quote) { if (char === quote) quote = undefined; continue; }
            if (quoteEnds[char]) { quote = quoteEnds[char]; continue; }
            if ('>＞〉】]'.includes(char)) { end++; break; }
            if ('<＜〈【['.includes(char)) break;
        }
        const text = body.slice(index, end);
        tokens.push({ text, index, ref: readAvgSceneMarker(text) });
        consumed = end;
    }
    return tokens;
};
export const isAvgSceneMarker = (line: string): boolean => {
    const tokens = scanAvgSceneMarkers(line.trim());
    return tokens.length === 1 && tokens[0].text.length === line.trim().length;
};

/** Read references without imposing s1..s99 names; punctuation is transport syntax. */
export const readAvgSceneMarker = (line: string): string | undefined => {
    const match = line.trim().match(/^[<＜〈【\[]\s*镜头\s+ref\s*[=＝]\s*(?:"([^"\r\n]*)"|'([^'\r\n]*)'|“([^”\r\n]*)”|‘([^’\r\n]*)’|([^\s"'“”‘’<＜〈【\[>＞〉】\]\/／]+))\s*[\/／]?\s*[>＞〉】\]]$/i);
    const entities: Record<string, string> = { '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>', '&amp;': '&' };
    const ref = match?.slice(1).find(value => value !== undefined);
    return ref?.replace(/&(?:quot|apos|lt|gt|amp);/g, entity => entities[entity]).trim() || undefined;
};
export const writeAvgSceneMarker = (ref?: string): string => ref
    ? `<镜头 ref="${ref.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}"/>`
    : '<镜头/>';
/** Markers delimit segments even when the model places narrative on the same line. */
export const avgSceneBodyLines = (body: string): string[] => {
    const source = body.replace(/\r\n?/g, '\n');
    const pieces: string[] = [];
    let offset = 0;
    for (const token of scanAvgSceneMarkers(source)) {
        pieces.push(source.slice(offset, token.index), '\n', token.text, '\n');
        offset = token.index + token.text.length;
    }
    pieces.push(source.slice(offset));
    return pieces.join('').split('\n');
};

/** Recover metadata in JSON/old log text while preserving speaker and story text. */
export const normalizeAvgSceneLogs = <T extends { text: string; avgSceneRef?: string }>(logs: T[]): T[] => {
    if (!logs.some(log => scanAvgSceneMarkers(log.text).length)) return logs;
    const result: T[] = [];
    let activeRef: string | undefined;
    let boundarySeen = false;
    for (const log of logs) {
        let ref = log.avgSceneRef ?? (boundarySeen ? activeRef : undefined);
        const tokens = scanAvgSceneMarkers(log.text);
        let offset = 0;
        const append = (text: string) => {
            if (text.trim()) result.push(text === log.text && ref === log.avgSceneRef ? log : { ...log, text, avgSceneRef: ref });
        };
        for (const token of tokens) {
            append(log.text.slice(offset, token.index));
            activeRef = ref = token.ref;
            boundarySeen = true;
            offset = token.index + token.text.length;
        }
        append(log.text.slice(offset));
        if (log.avgSceneRef && !tokens.length) activeRef = log.avgSceneRef;
    }
    return result;
};
export const avgSceneSegmentRefs = (logs: Array<{ avgSceneRef?: string }>): Array<string | null> => logs.reduce<Array<string | null>>((refs, log) => {
    const ref = log.avgSceneRef || null;
    if (!refs.length || refs.at(-1) !== ref) refs.push(ref);
    return refs;
}, []);
