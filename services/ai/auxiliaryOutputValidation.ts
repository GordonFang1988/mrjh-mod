export const AUXILIARY_FORMAT_ISSUES = ['unclosed-thinking', 'unclosed-explanation', 'unclosed-commands',
    'unexpected-tag', 'invalid-json'] as const;
export type AuxiliaryFormatIssue = typeof AUXILIARY_FORMAT_ISSUES[number];
export type AuxiliaryFormatRepair = 'closed-thinking' | 'closed-explanation';

export class AuxiliaryOutputStructureError extends Error {
    constructor(public readonly issue: AuxiliaryFormatIssue) {
        const descriptions: Record<AuxiliaryFormatIssue, string> = {
            'unclosed-thinking': '思考块未结束且无法确认正式输出边界',
            'unclosed-explanation': '说明块未结束且没有完整命令块',
            'unclosed-commands': '命令块缺少结束标签',
            'unexpected-tag': '输出标签嵌套或顺序异常',
            'invalid-json': 'JSON 命令未完整结束或格式无效'
        };
        super('辅助任务输出结构不完整：' + descriptions[issue] + '，本次结果不写入存档');
        this.name = 'AuxiliaryOutputStructureError';
    }
}

// Ignore literal examples and quoted JSON values when locating protocol boundaries.
// Masking preserves offsets so repairs only insert delimiters, never change values.
const protocolTokens = (source: string) => {
    // Native reasoning can contain imagined final blocks; completed thoughts are opaque.
    const withoutThoughtContents = source.replace(/(<\s*(think|thinking)\s*>)([\s\S]*?)(<\s*\/\s*\2\s*>)/gi,
        (_match, open: string, _tag: string, body: string, close: string) => open + ' '.repeat(body.length) + close);
    const masked = withoutThoughtContents.replace(/"(?:\\.|[^"\\])*"|`[^`\r\n]*`/g, match => ' '.repeat(match.length));
    return [...masked.matchAll(/<\s*(\/?)\s*(thinking|think|说明|命令)\s*>/gi)]
        .map(match => ({index: match.index!, tag: match[2].toLowerCase(), close: !!match[1]}));
};

export const stripAuxiliaryThoughts = (source: string): string => {
    const tokens = protocolTokens(source);
    const ranges: Array<{start: number; end: number}> = [];
    for (let i = 0; i < tokens.length - 1; i++) {
        const open = tokens[i], close = tokens[i + 1];
        if (!open.close && /^(think|thinking)$/.test(open.tag) && close.close && close.tag === open.tag) {
            const closing = source.slice(close.index).match(/^<\s*\/\s*(think|thinking)\s*>/i)!;
            ranges.push({start: open.index, end: close.index + closing[0].length});
        }
    }
    let text = source;
    for (const range of ranges.reverse()) text = text.slice(0, range.start) + text.slice(range.end);
    return text;
};

const assertCommandValuesClosed = (source: string) => {
    const stack: string[] = [];
    let quote = '', escaped = false;
    for (const char of source) {
        if (quote) {
            if (escaped) escaped = false;
            else if (char === '\\') escaped = true;
            else if (char === quote) quote = '';
        } else if (char === '"' || char === "'") quote = char;
        else if (char === '{' || char === '[') stack.push(char);
        else if (char === '}' || char === ']') {
            if (stack.pop() !== (char === '}' ? '{' : '[')) throw new AuxiliaryOutputStructureError('invalid-json');
        }
    }
    if (stack.length || quote) throw new AuxiliaryOutputStructureError('invalid-json');
};

export const validateAuxiliaryOutput = (rawText: string, options?: {
    recoverBoundaries?: boolean; allowCommandSequence?: boolean
}): {text: string; repairs: AuxiliaryFormatRepair[]} => {
    const tokens = protocolTokens(rawText);
    const insertions: Array<{index: number; text: string}> = [];
    const repairs: AuxiliaryFormatRepair[] = [];
    let pending: typeof tokens[number] | undefined;
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const completeCommandAhead = tokens.slice(i).some((open, at, rest) =>
            !open.close && open.tag === '命令' && rest[at + 1]?.close && rest[at + 1]?.tag === '命令');
        if (!token.close && pending && options?.recoverBoundaries && completeCommandAhead) {
            if (/^(think|thinking)$/.test(pending.tag) && token.tag === '说明') {
                insertions.push({index: token.index, text: '</' + pending.tag + '>'});
                repairs.push('closed-thinking');
                pending = undefined;
            } else if (pending.tag === '说明' && token.tag === '命令') {
                insertions.push({index: token.index, text: '</说明>'});
                repairs.push('closed-explanation');
                pending = undefined;
            }
        }
        if (token.close) {
            // A closing thought alone can be a continuation of an assistant prefill.
            if (!pending && /^(think|thinking)$/.test(token.tag)) continue;
            if (!pending || pending.tag !== token.tag) throw new AuxiliaryOutputStructureError('unexpected-tag');
            pending = undefined;
        } else {
            if (pending) throw new AuxiliaryOutputStructureError('unexpected-tag');
            pending = token;
        }
    }
    if (pending) throw new AuxiliaryOutputStructureError(pending.tag === '命令' ? 'unclosed-commands'
        : pending.tag === '说明' ? 'unclosed-explanation' : 'unclosed-thinking');
    let text = rawText;
    for (const item of insertions.reverse()) text = text.slice(0, item.index) + item.text + text.slice(item.index);
    const finalTokens = protocolTokens(text);
    for (let i = 0; i < finalTokens.length - 1; i++) {
        const open = finalTokens[i], close = finalTokens[i + 1];
        if (open.tag === '命令' && !open.close && close.tag === '命令' && close.close) {
            const opening = text.slice(open.index).match(/^<\s*命令\s*>/i)!;
            assertCommandValuesClosed(text.slice(open.index + opening[0].length, close.index));
        }
    }
    const body = stripAuxiliaryThoughts(text)
        .replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    if (body.startsWith('{') || body.startsWith('[')) {
        try { JSON.parse(body); } catch {
            // JSON commands may be returned one complete object per line (the NPC protocol).
            const lines = body.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
            const completeSequence = options?.allowCommandSequence && lines.length > 1 && lines.every(line => {
                try {
                    const cmd = JSON.parse(line);
                    return cmd && !Array.isArray(cmd)
                        && ['add','set','push','delete','registerNpc','updateNpcState','pushNpcMemory'].includes(cmd.action)
                        && (typeof cmd.key === 'string' || typeof cmd.npcId === 'string');
                } catch { return false; }
            });
            if (!completeSequence) throw new AuxiliaryOutputStructureError('invalid-json');
        }
    }
    return {text, repairs};
};
