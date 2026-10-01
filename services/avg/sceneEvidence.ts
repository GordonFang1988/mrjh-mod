import type { GameResponse, 聊天记录结构 } from '../../types';
import type { AvgSceneTrace, AvgSceneFieldSnapshot, AvgResolvedScene } from '../../models/avg';
import { APP_VERSION } from '../../release/version';
import { AVG_VOCABULARY_VERSION, AVG_FULL_PROTOCOL_PROMPT } from './vocabulary';
import { parseStoryRawText } from '../ai/storyResponseParser';
import { parseJsonWithRepair } from '../../utils/jsonRepair';

export const snapshotAvgSceneFields = (response?: GameResponse): AvgSceneFieldSnapshot => ({
    hintCount: response?.avgSceneHints?.length || 0,
    hintRefs: (response?.avgSceneHints || []).map(hint => hint.ref),
    logCount: response?.logs?.length || 0,
    markedLogCount: response?.logs?.filter(log => !!log.avgSceneRef).length || 0,
    sceneRefs: [...new Set((response?.logs || []).map(log => log.avgSceneRef).filter((ref): ref is string => !!ref))]
});

export const captureAvgSceneTrace = (
    enabled: boolean, messages: Array<{ content: string }>, response: GameResponse, source: 'main' | 'opening',
    parserOptions = { enableTagRepair: true, validateTagCompleteness: false }
): AvgSceneTrace => {
    const protocolMessageIndexes = messages.flatMap((message, index) =>
        message.content.includes(AVG_FULL_PROTOCOL_PROMPT) ? [index] : []);
    const registry = messages.map(message => message.content.match(/【AVG已绑定场景】\s*\n([^\n]+)/)?.[1]).find(Boolean);
    const registryPayload = registry ? parseJsonWithRepair<{ 场景?: unknown[] }>(registry).value : null;
    return { schemaVersion: 1, appVersion: APP_VERSION,
        request: { source, enabledAtRequest: enabled, protocolIncluded: protocolMessageIndexes.length > 0,
            protocolVersion: AVG_VOCABULARY_VERSION, protocolMessageIndexes, parserOptions,
            bindingRegistryIncluded: !!registry, bindingRegistrySceneCount: registryPayload?.场景?.length || 0 },
        parsed: snapshotAvgSceneFields(response) };
};

export const redactAvgDiagnosticText = (value: string): string => value
    .replace(/data:image\/[a-z0-9.+-]+(?:;[^,]*)?,[^\s"'<>]+/gi, '[EMBEDDED_IMAGE]')
    .replace(/\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9_.-]+)/gi, '[REDACTED]')
    .replace(/([?&](?:api[_-]?key|token|access[_-]?token|key|signature|sig)=)[^&#\s"']*/gi, '$1[REDACTED]')
    .replace(/((?:["']?(?:api[_-]?key|authorization|access[_-]?token|password|secret)["']?)\s*[:=]\s*)("[^"]*"|'[^']*'|[^,\s}]+)/gi, '$1"[REDACTED]"');

/** Export whitelisted structural values only; malformed blocks get a bounded, redacted excerpt. */
const inspectScenePayload = (value: unknown) => {
    const object = value && typeof value === 'object' ? value as Record<string, unknown> : undefined;
    const entries = Array.isArray(value) ? value : Array.isArray(object?.场景) ? object.场景 : undefined;
    const text = (value: unknown) => typeof value === 'string' ? redactAvgDiagnosticText(value).slice(0, 500) : undefined;
    const fields = ['空间', '地域', '地理环境', '植被', '地表', '水域', '视点', '场所体系', '场所功能', '装潢档次', '完好程度', '空间规模'] as const;
    const scenes = (entries || []).slice(0, 24).map(entry => {
        const scene = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
        const profile = scene.分类 && typeof scene.分类 === 'object' ? scene.分类 as Record<string, unknown> : {};
        const location = scene.地点 && typeof scene.地点 === 'object' ? scene.地点 as Record<string, unknown> : {};
        return { ref: text(scene.ref), refPresent: typeof scene.ref === 'string' && !!scene.ref.trim(),
            sceneId: text(scene.场景ID),
            spacePresent: typeof profile.空间 === 'string' && !!profile.空间.trim(),
            location: Object.fromEntries(['大地点', '中地点', '小地点', '具体地点'].flatMap(key => typeof location[key] === 'string' ? [[key, text(location[key])]] : [])),
            profile: { ...Object.fromEntries(fields.flatMap(key => typeof profile[key] === 'string' ? [[key, text(profile[key])]] : [])),
                ...(Array.isArray(profile.显著要素) ? { 显著要素: profile.显著要素.filter(item => typeof item === 'string').slice(0, 12).map(text) } : {}) } };
    });
    const refs = (entries || []).flatMap(entry => typeof entry?.ref === 'string' ? [entry.ref.trim()] : []);
    return { declaredVocabularyVersion: text(object?.词表版本), sceneArrayPresent: !!entries, sceneCount: entries?.length || 0,
        readableSceneCount: (entries || []).filter(entry => typeof entry?.ref === 'string' && entry.ref.trim()
            && (typeof entry?.分类?.空间 === 'string' && entry.分类.空间.trim()
                || typeof entry?.场景ID === 'string' && entry.场景ID.trim()
                || typeof entry?.地点?.具体地点 === 'string' && entry.地点.具体地点.trim())).length,
        duplicateRefs: [...new Set(refs.filter((ref, index) => ref && refs.indexOf(ref) !== index))],
        scenes, scenesTruncated: (entries?.length || 0) > scenes.length };
};

export const buildAvgSceneSourceEvidence = (turn?: 聊天记录结构) => {
    const raw = typeof turn?.rawJson === 'string' ? turn.rawJson : '';
    // Thought sections can mention output examples; inspect the actual reply outside them.
    const visibleRaw = raw.replace(/<\s*(thinking|think)(?=\s|>)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
    const blocks = [...visibleRaw.matchAll(/<\s*演出场景(?=\s|>)[^>]*>([\s\S]*?)(?:<\s*\/\s*演出场景\s*>|$)/gi)];
    const rawBlocks = blocks.slice(0, 4).map(match => {
        const json = parseJsonWithRepair<unknown>(match[1]);
        return { closed: /<\s*\/\s*演出场景\s*>\s*$/i.test(match[0]), length: match[1].length,
            jsonReadable: json.value !== null, jsonRepaired: json.usedRepair,
            structure: inspectScenePayload(json.value),
            malformedExcerpt: json.value === null ? redactAvgDiagnosticText(match[1]).slice(0, 1500) : undefined };
    });
    let jsonPayload: ReturnType<typeof inspectScenePayload> | undefined;
    let jsonPayloadUnreadable = false;
    if (!blocks.length && raw.trim()) {
        const json = parseJsonWithRepair<Record<string, unknown>>(raw).value;
        if (json && Object.prototype.hasOwnProperty.call(json, 'avgSceneHints')) jsonPayload = inspectScenePayload(json.avgSceneHints);
        jsonPayloadUnreadable = json === null && /["']avgSceneHints["']\s*:/.test(visibleRaw);
    }
    let reparsed: AvgSceneFieldSnapshot | undefined;
    let reparsedWithoutTagRepair: AvgSceneFieldSnapshot | undefined;
    let reparseError = false;
    const reparseOptions = { validateTagCompleteness: false, enableTagRepair: turn?.avgSceneTrace?.request?.parserOptions?.enableTagRepair ?? true };
    if (raw.trim()) {
        try { reparsed = snapshotAvgSceneFields(parseStoryRawText(raw, reparseOptions)); }
        catch { reparseError = true; }
        if (reparseOptions.enableTagRepair && !reparsed?.hintCount && (blocks.length || jsonPayload)) {
            try { reparsedWithoutTagRepair = snapshotAvgSceneFields(parseStoryRawText(raw, { ...reparseOptions, enableTagRepair: false })); }
            catch { /* The comparison is optional; the primary failure is recorded above. */ }
        }
    }
    return {
        rawAvailable: !!raw.trim(), rawLength: raw.length, rawSceneBlockCount: blocks.length, rawBlocks,
        rawSceneMarkerCount: [...visibleRaw.matchAll(/<\s*镜头\s+[^>]*ref\s*=/gi)].length,
        jsonPayload, jsonPayloadUnreadable, reparseOptions, reparseError, reparsed, reparsedWithoutTagRepair,
        // Historic requests cannot be reconstructed from current settings.
        request: turn?.avgSceneTrace?.request || null,
        processing: turn?.avgSceneTrace || null,
        stored: snapshotAvgSceneFields(turn?.structuredResponse),
        originalBeforePolish: turn?.structuredResponse?.body_original_logs
            ? snapshotAvgSceneFields({ logs: turn.structuredResponse.body_original_logs }) : undefined,
        logs: (turn?.structuredResponse?.logs || []).slice(0, 200).map((log, index) => ({
            index: index + 1, sender: redactAvgDiagnosticText(log.sender || '').slice(0, 100),
            sceneRef: log.avgSceneRef, text: redactAvgDiagnosticText(log.text || '').slice(0, 240)
        })),
        logsTruncated: (turn?.structuredResponse?.logs?.length || 0) > 200
    };
};

export const diagnoseAvgSceneSource = (evidence: ReturnType<typeof buildAvgSceneSourceEvidence>) => {
    const result = (code: string, summary: string, confirmed: boolean) => ({ code, summary, confirmed });
    if (evidence.stored.hintCount > 0) return result('scene-fields-present', '本回合已保存结构化场景字段或已有场景引用。', true);
    if ((evidence.processing?.parsed?.hintCount || 0) > 0 || (evidence.processing?.afterPolish?.hintCount || 0) > 0
        || (evidence.processing?.afterVariableGeneration?.hintCount || 0) > 0) {
        const stage = evidence.processing?.parsed?.hintCount && evidence.processing.afterPolish?.hintCount === 0 ? '正文处理'
            : evidence.processing?.afterPolish?.hintCount && evidence.processing.afterVariableGeneration?.hintCount === 0 ? '变量合并'
            : evidence.processing?.final?.hintCount ? '保存或后续编辑' : '最终回合构建';
        return result('scene-fields-lost-after-parsing', `生成时已解析到场景字段，但${stage}时丢失。`, true);
    }
    if ((evidence.reparsed?.hintCount || 0) > 0)
        return result('scene-fields-not-retained', '原始回复可以解析出场景字段，但当前回合未保留；应检查当时的解析或后续处理。', true);
    if (evidence.request?.protocolIncluded === false)
        return result(evidence.request.enabledAtRequest ? 'avg-protocol-not-sent' : 'avg-disabled-at-request',
            evidence.request.enabledAtRequest ? '本回合启用了 AVG，但实际请求未附 AVG 协议。' : '本回合请求时未启用 AVG，实际请求未附 AVG 协议。', true);
    if (!evidence.rawAvailable) return result('scene-source-evidence-unavailable', '该回合没有原始回复，现有记录不足以判断字段在哪一环丢失。', false);
    if (evidence.jsonPayloadUnreadable) return result('scene-json-unreadable', '原始回复含 JSON 场景字段名，但 JSON 无法读取。', true);
    if (!evidence.rawSceneBlockCount && !evidence.jsonPayload)
        return result('response-scene-fields-absent', '保存的原始回复没有演出场景块或 JSON 场景字段。', true);
    if (evidence.rawBlocks.some(block => !block.jsonReadable))
        return result('scene-json-unreadable', '原始回复含演出场景块，但其 JSON 无法读取。', true);
    if (evidence.rawBlocks.some(block => block.structure.duplicateRefs.length) || evidence.jsonPayload?.duplicateRefs.length)
        return result('scene-refs-duplicated', '原始回复中的场景 ref 重复，无法确定每个引用对应哪份分类。', true);
    if (evidence.rawBlocks.some(block => block.structure.readableSceneCount > 0) || (evidence.jsonPayload?.readableSceneCount || 0) > 0)
        return result('scene-parser-dropped-fields', '原始回复包含可读取的场景字段，但当前解析器未提取到。', true);
    return result('scene-fields-incomplete', '原始回复包含场景结构，但缺少场景数组、ref 或空间字段，无法建立匹配。', true);
};

export const diagnoseAvgSceneDisplay = (input: {
    source: ReturnType<typeof buildAvgSceneSourceEvidence>; response?: GameResponse; scene?: AvgResolvedScene;
    sceneRef?: string; availability?: string; candidateCount?: number; imageState?: string; catalogAvailable?: boolean;
    bindingReuseBlockReason?: string;
    bindingReuseAvailable?: boolean;
}) => {
    const result = (code: string, summary: string, confirmed = true) => ({ code, summary, confirmed });
    const { scene, response, source, availability, imageState } = input;
    if (scene?.image) {
        if (availability === 'local-file-missing') return result('scene-local-file-missing', '已选中场景素材，但浏览器本地图片文件缺失。');
        if (availability === 'storage-unavailable') return result('scene-storage-unavailable', '无法读取本地图片存储，暂不能确认图片文件是否存在。', false);
        if (imageState === 'failed') return result('scene-image-load-failed', '已选中场景图，但浏览器加载或解码失败。');
        if (imageState === 'pending') return result('scene-image-loading', '已选中场景图，导出时图片仍在加载。', false);
        return result(imageState === 'loaded' ? 'scene-image-loaded' : 'scene-image-selected',
            imageState === 'loaded' ? '当前镜头的场景图已成功加载。' : '已保存场景图选择；此记录未验证浏览器是否成功显示。', imageState === 'loaded');
    }
    if (scene?.reason === 'manual-neutral') return result('scene-manual-neutral', '此地点选择了中性背景。');
    if (input.bindingReuseBlockReason === 'conflicting-scene-identity')
        return result('scene-binding-conflict', '场景 ID 与地点关联到不同的已绑定空间，引用结构存在冲突。');
    if (input.bindingReuseAvailable)
        return result('scene-existing-binding-not-applied', '已有可复用的历史场景绑定，但该旧回合尚未保存复用结果；重新读档可恢复。');
    const sourceDiagnosis = diagnoseAvgSceneSource(source);
    if (sourceDiagnosis.code !== 'scene-fields-present') return sourceDiagnosis;
    if (!response?.avgPresentation) return result('scene-presentation-missing', '已保存结构化场景分类，但该回合没有演出快照。');
    if (response?.avgPresentation?.diagnostic === 'no-scene-markers') {
        if ((source.reparsed?.markedLogCount || 0) > 0 || (source.processing?.parsed?.markedLogCount || 0) > 0)
            return result('scene-markers-not-retained', '原始回复或解析阶段有镜头引用，但当前正文未保留。');
        return result('scene-markers-absent', '本回合有多份场景分类，但正文没有镜头引用，无法确定使用哪份。');
    }
    if (!scene || scene.profile.空间 === '未知')
        return result('scene-ref-unmapped', `镜头 ${input.sceneRef || '未标记'} 没有可使用的结构化场景分类。`);
    if (input.catalogAvailable === false) return result('scene-catalog-unavailable', '场景分类已保留，但素材库读取失败，无法确认匹配结果。', false);
    if (input.candidateCount === 0) return result('scene-no-compatible-art', '结构化分类已保留，但当前素材库没有通过匹配条件的场景图。');
    return result('scene-selection-missing', '当前有结构化分类和候选素材，但该镜头未保存图片选择；候选数量反映导出时的素材库。');
};
