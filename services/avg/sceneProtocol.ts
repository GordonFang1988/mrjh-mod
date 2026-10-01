/** Read a quoted reference as protocol data, without imposing s1..s99 names. */
export const readAvgSceneMarker = (line: string): string | undefined => {
    const match = line.match(/^<\s*镜头\s+ref\s*=\s*(["'])([^<>\r\n]*?)\1\s*\/\s*>$/);
    const entities: Record<string, string> = { '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>', '&amp;': '&' };
    return match?.[2].replace(/&(?:quot|apos|lt|gt|amp);/g, entity => entities[entity]).trim() || undefined;
};
export const writeAvgSceneMarker = (ref?: string): string => ref
    ? `<镜头 ref="${ref.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}"/>`
    : '<镜头/>';
/** Markers delimit segments even when the model places narrative on the same line. */
export const avgSceneBodyLines = (body: string): string[] => body
    .replace(/\r\n?/g, '\n')
    .replace(/(<\s*\/?\s*镜头(?=\s|\/|>)[^>]*>)/g, '\n$1\n')
    .split('\n');
export const avgSceneSegmentRefs = (logs: Array<{ avgSceneRef?: string }>): Array<string | null> => logs.reduce<Array<string | null>>((refs, log) => {
    const ref = log.avgSceneRef || null;
    if (!refs.length || refs.at(-1) !== ref) refs.push(ref);
    return refs;
}, []);
