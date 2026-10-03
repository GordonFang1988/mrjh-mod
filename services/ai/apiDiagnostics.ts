/** Bounded local metrics only. Request/response bodies and credentials never enter the log. */
import type { AuxiliaryInputMetric, InputSectionMetric } from '../../utils/auxiliaryContext';
export const API_DIAGNOSTIC_LIMIT = 60;
const STORAGE_KEY = 'mrjh-api-diagnostics:v1';
const tasks = ['story', 'world-evolution', 'planning', 'variable', 'recall', 'polish', 'world-generation', 'realm-generation', 'novel', 'connection-test', 'other'] as const;
export type ApiDiagnosticTask = typeof tasks[number];
type Status = 'running' | 'success' | 'error' | 'cancelled' | 'fallback';
type Usage = { inputTokens?: number; outputTokens?: number; reasoningTokens?: number };
export type AuxiliaryResultMetric = {
    status: 'invalid-output' | 'no-update' | 'filtered' | 'ready' | 'applied';
    reason?: 'reasoning-only' | 'empty-output' | 'invalid-format' | 'state-guard' | 'not-needed';
    parsedCommands?: number; acceptedCommands?: number; appliedCommands?: number;
    parsedHeroineCommands?: number; acceptedHeroineCommands?: number; appliedHeroineCommands?: number;
    parsedAgreementCommands?: number; acceptedAgreementCommands?: number; appliedAgreementCommands?: number;
};
export type ApiAttemptMetric = {
    number: number; requestedStream: boolean; actualStream?: boolean; startedAt: number; durationMs?: number;
    status: Status; httpStatus?: number; headersMs?: number; firstByteMs?: number;
    firstOutputMs?: number; firstContentMs?: number; firstReasoningMs?: number; lastOutputMs?: number;
    contentChars: number; reasoningChars: number; outputChars: number; deltaCount: number;
    usage?: Usage; finishReason?: string; errorKind?: string; observedStream?: boolean;
};
export type ApiCallMetric = {
    id: string; task: ApiDiagnosticTask; model: string; provider: string; endpointOrigin: string; transportOrigin: string; proxied: boolean;
    startedAt: number; durationMs?: number; status: Status; inputChars: number; messageCount: number;
    maxOutputTokens?: number; requestedStream: boolean; retryCount: number; retryWaitMs: number;
    fallbackCount: number; attempts: ApiAttemptMetric[]; errorKind?: string;
    inputBreakdown?: AuxiliaryInputMetric;
    result?: AuxiliaryResultMetric;
};
const clock = () => performance.now();
const millis = (value: number) => Math.max(0, Math.round(value));
const safeText = (value: unknown) => typeof value === 'string'
    ? value.replace(/sk-(?:proj-)?[A-Za-z0-9_-]{8,}|Bearer\s+\S+/gi, '[REDACTED]').slice(0, 120) : '';
const origin = (value: unknown) => {
    try { const url = new URL(String(value)); return /^https?:$/.test(url.protocol) ? url.origin : ''; }
    catch { return ''; }
};
const numeric = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
const safeResult = (value: any): AuxiliaryResultMetric | undefined => {
    if (!['invalid-output','no-update','filtered','ready','applied'].includes(value?.status)) return undefined;
    return {status: value.status,
        reason: ['reasoning-only','empty-output','invalid-format','state-guard','not-needed'].includes(value.reason) ? value.reason : undefined,
        parsedCommands: numeric(value.parsedCommands), acceptedCommands: numeric(value.acceptedCommands),
        appliedCommands: numeric(value.appliedCommands),
        parsedHeroineCommands: numeric(value.parsedHeroineCommands),
        acceptedHeroineCommands: numeric(value.acceptedHeroineCommands),
        appliedHeroineCommands: numeric(value.appliedHeroineCommands),
        parsedAgreementCommands: numeric(value.parsedAgreementCommands),
        acceptedAgreementCommands: numeric(value.acceptedAgreementCommands),
        appliedAgreementCommands: numeric(value.appliedAgreementCommands)};
};
const sectionNames = ['rules','identity','schema','analysis','extra','world','social','story','heroine','environment','body','history','memory','plan','commands','hints','lore','recall','query','trigger','novel','worldbook'];
const safeBreakdown = (value: any): AuxiliaryInputMetric | undefined => {
    if (value?.version !== 1 || !numeric(value.budgetChars) || !Array.isArray(value.sections)) return undefined;
    const clean = (rows: any[]): InputSectionMetric[] => rows.slice(0, 48).flatMap(row => {
        if (!sectionNames.includes(row?.name)) return [];
        return [{name: row.name, sourceChars: numeric(row.sourceChars) || 0, sentChars: numeric(row.sentChars) || 0,
            sourceItems: numeric(row.sourceItems), sentItems: numeric(row.sentItems), omittedItems: numeric(row.omittedItems)}];
    });
    return {version: 1, budgetChars: value.budgetChars, sections: clean(value.sections),
        details: Array.isArray(value.details) ? clean(value.details) : undefined};
};
const errorKind = (error: unknown): string => {
    const item = error as { name?: string; message?: string; status?: number };
    if (item?.name === 'AbortError') return 'cancelled';
    if (numeric(item?.status)) return 'http';
    const message = String(item?.message || '').toLowerCase();
    return /输出.*截断/.test(message) ? 'output-limit' : /timeout|timed out/.test(message) ? 'timeout'
        : /fetch|network/.test(message) ? 'network'
        : /empty/.test(message) ? 'empty-output'
        : /stream|sse|protocol/.test(message) ? 'protocol' : 'request-error';
};
let records: ApiCallMetric[] = [];
let loaded = false;
let storageAvailable = true;
let omitted = 0;
let sequence = 0;
const active = new Set<string>();

// Reconstruct a whitelist when loading local data; never export arbitrary stored fields.
const restore = (value: any): ApiCallMetric | undefined => {
    if (!value || !numeric(value.startedAt) || !Array.isArray(value.attempts)) return undefined;
    const attempts: ApiAttemptMetric[] = value.attempts.slice(-6).map((a: any, index: number) => {
        const item: ApiAttemptMetric = { number: index + 1, requestedStream: a?.requestedStream === true,
            startedAt: numeric(a?.startedAt) || value.startedAt, status: ['success','error','cancelled','fallback'].includes(a?.status) ? a.status : 'running',
            contentChars: numeric(a?.contentChars) || 0, reasoningChars: numeric(a?.reasoningChars) || 0,
            outputChars: numeric(a?.outputChars) || 0, deltaCount: numeric(a?.deltaCount) || 0 };
        for (const field of ['durationMs','httpStatus','headersMs','firstByteMs','firstOutputMs','firstContentMs','firstReasoningMs','lastOutputMs'] as const)
            item[field] = numeric(a?.[field]);
        item.actualStream = typeof a?.actualStream === 'boolean' ? a.actualStream : undefined;
        item.observedStream = a?.observedStream === true;
        item.usage = a?.usage ? { inputTokens:numeric(a.usage.inputTokens),outputTokens:numeric(a.usage.outputTokens),reasoningTokens:numeric(a.usage.reasoningTokens) } : undefined;
        item.errorKind = safeText(a?.errorKind); item.finishReason = safeText(a?.finishReason);
        return item;
    });
    return { id:safeText(value.id), task:tasks.includes(value.task) ? value.task : 'other',
        model:safeText(value.model), provider:safeText(value.provider), endpointOrigin:origin(value.endpointOrigin),transportOrigin:origin(value.transportOrigin),
        proxied:value.proxied === true, startedAt:value.startedAt, durationMs:numeric(value.durationMs),
        status:['success','error','cancelled'].includes(value.status) ? value.status : 'running',
        inputChars:numeric(value.inputChars) || 0, messageCount:numeric(value.messageCount) || 0,
        maxOutputTokens:numeric(value.maxOutputTokens), requestedStream:value.requestedStream === true,
        retryCount:numeric(value.retryCount) || 0, retryWaitMs:numeric(value.retryWaitMs) || 0,
        fallbackCount:numeric(value.fallbackCount) || 0, attempts,errorKind:safeText(value.errorKind), inputBreakdown:safeBreakdown(value.inputBreakdown),
        result:safeResult(value.result) };
};
const load = () => {
    if (loaded) return;
    loaded = true;
    try {
        if (typeof localStorage === 'undefined') return;
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        omitted = numeric(raw.omitted) || 0;
        records = Array.isArray(raw.records) ? raw.records.slice(-API_DIAGNOSTIC_LIMIT).flatMap((value: unknown) => {
            const record=restore(value); return record ? [record] : [];
        }) : [];
    } catch { storageAvailable = false; }
};
const persist = () => {
    try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify({omitted,records}));
    } catch { storageAvailable = false; }
};
export const recordAuxiliaryResult = (id: string | undefined, result: AuxiliaryResultMetric): void => {
    if (!id) return;
    const record = records.find(item => item.id === id);
    if (record) {
        const clean = safeResult(result);
        if (clean) record.result = {...clean,
            parsedCommands: clean.parsedCommands ?? record.result?.parsedCommands,
            acceptedCommands: clean.acceptedCommands ?? record.result?.acceptedCommands,
            appliedCommands: clean.appliedCommands ?? record.result?.appliedCommands,
            parsedHeroineCommands: clean.parsedHeroineCommands ?? record.result?.parsedHeroineCommands,
            acceptedHeroineCommands: clean.acceptedHeroineCommands ?? record.result?.acceptedHeroineCommands,
            appliedHeroineCommands: clean.appliedHeroineCommands ?? record.result?.appliedHeroineCommands,
            parsedAgreementCommands: clean.parsedAgreementCommands ?? record.result?.parsedAgreementCommands,
            acceptedAgreementCommands: clean.acceptedAgreementCommands ?? record.result?.acceptedAgreementCommands,
            appliedAgreementCommands: clean.appliedAgreementCommands ?? record.result?.appliedAgreementCommands};
        persist();
    }
};
export const beginApiDiagnostic = (input: {
    task?: ApiDiagnosticTask; model: string; provider?: string; endpoint: string; transportEndpoint?: string; proxied: boolean;
    inputChars: number; messageCount: number; maxOutputTokens?: number; requestedStream: boolean;
    inputBreakdown?: AuxiliaryInputMetric;
}) => {
    load();
    const started = clock();
    const record: ApiCallMetric = {
        id: Date.now().toString(36)+'-'+(++sequence), task:input.task || 'other',
        model:safeText(input.model),provider:safeText(input.provider),endpointOrigin:origin(input.endpoint),transportOrigin:origin(input.transportEndpoint || input.endpoint),
        proxied:input.proxied,startedAt:Date.now(),status:'running',inputChars:input.inputChars,
        messageCount:input.messageCount,maxOutputTokens:input.maxOutputTokens,requestedStream:input.requestedStream,
        retryCount:0,retryWaitMs:0,fallbackCount:0,attempts:[],inputBreakdown:safeBreakdown(input.inputBreakdown)
    };
    records.push(record);
    active.add(record.id);
    if (records.length > API_DIAGNOSTIC_LIMIT) { omitted += records.length-API_DIAGNOSTIC_LIMIT; records=records.slice(-API_DIAGNOSTIC_LIMIT); }
    persist();
    return {
        id: record.id,
        outputChannels: () => {
            const attempt = record.attempts.at(-1);
            return {contentChars: attempt?.contentChars || 0, reasoningChars: attempt?.reasoningChars || 0};
        },
        outputTruncated: () => record.attempts.at(-1)?.finishReason === 'length',
        retry: () => { record.retryCount += 1; persist(); },
        retryWait: (duration: number) => { record.retryWaitMs += millis(duration); persist(); },
        fallback: () => { record.fallbackCount += 1; persist(); },
        finish: (error?: unknown) => {
            active.delete(record.id);
            record.durationMs=millis(clock()-started);
            record.status=error ? errorKind(error)==='cancelled' ? 'cancelled' : 'error' : 'success';
            if (error) record.errorKind=errorKind(error);
            persist();
        },
        attempt: (requestedStream: boolean) => {
            const start=clock();
            const metric: ApiAttemptMetric={number:record.attempts.length+1,requestedStream,startedAt:Date.now(),
                status:'running',contentChars:0,reasoningChars:0,outputChars:0,deltaCount:0};
            record.attempts.push(metric);
            persist();
            const elapsed=()=>millis(clock()-start);
            return {
                headers: (response: Response) => {
                    metric.headersMs=elapsed(); metric.httpStatus=response.status;
                    metric.actualStream=requestedStream && (response.headers.get('content-type') || '').toLowerCase().includes('text/event-stream');
                    persist();
                },
                byte: () => { if (metric.firstByteMs === undefined) metric.firstByteMs=elapsed(); },
                payload: (payload: any, streamed: boolean) => {
                    const choice=payload?.choices?.[0],delta=streamed ? choice?.delta || choice?.message : choice?.message;
                    const content=typeof delta?.content==='string' && delta.content ? delta.content : Array.isArray(delta?.content)
                        ? delta.content.map((part: any)=>typeof part==='string' ? part : part?.text || '').join('') : '';
                    const finalContent = content || (streamed && typeof choice?.message?.content === 'string' ? choice.message.content : '');
                    const reasoning=delta?.reasoning_content ?? delta?.reasoning ?? delta?.reasoning_text;
                    const contentChars=Array.from(finalContent).length,reasoningChars=typeof reasoning==='string' ? Array.from(reasoning).length : 0;
                    const first=metric.firstOutputMs === undefined;
                    if (streamed && (contentChars || reasoningChars)) {
                        metric.observedStream=true;
                        metric.firstOutputMs ??= elapsed(); metric.lastOutputMs=elapsed(); metric.deltaCount+=1;
                        if (contentChars) metric.firstContentMs ??= elapsed();
                        if (reasoningChars) metric.firstReasoningMs ??= elapsed();
                    }
                    metric.contentChars+=contentChars;metric.reasoningChars+=reasoningChars;
                    metric.outputChars+=contentChars+reasoningChars;
                    const usage=payload?.usage;
                    if (usage) metric.usage={inputTokens:numeric(usage.prompt_tokens ?? usage.input_tokens),
                        outputTokens:numeric(usage.completion_tokens ?? usage.output_tokens),
                        reasoningTokens:numeric(usage.completion_tokens_details?.reasoning_tokens ?? usage.output_tokens_details?.reasoning_tokens)};
                    if (choice?.finish_reason) metric.finishReason=safeText(choice.finish_reason);
                    if (first && metric.firstOutputMs !== undefined) persist();
                },
                plain: (text: string) => { metric.outputChars=Array.from(text).length;metric.contentChars=metric.outputChars; },
                finish: (status: Status, error?: unknown) => {
                    if (metric.status!=='running') return;
                    metric.durationMs=elapsed();metric.status=status;
                    if (error) metric.errorKind=errorKind(error);
                    persist();
                }
            };
        }
    };
};
export type ApiAttemptObserver = ReturnType<ReturnType<typeof beginApiDiagnostic>['attempt']>;
export type ApiDiagnosticObserver = ReturnType<typeof beginApiDiagnostic>;

const withRates = (attempt: ApiAttemptMetric) => {
    const generationMs=attempt.firstOutputMs !== undefined && attempt.lastOutputMs !== undefined
        ? Math.max(0,attempt.lastOutputMs-attempt.firstOutputMs) : undefined;
    return { ...attempt, generationMs,
        // Character throughput over observed output, not a guessed token rate.
        charsPerSecond:generationMs && attempt.deltaCount>1 ? Math.round(attempt.outputChars*1000/generationMs*10)/10 : undefined,
        firstOutputMeasured:attempt.observedStream === true };
};
export const exportApiDiagnostics = () => {
    load();
    const calls=records.slice(-API_DIAGNOSTIC_LIMIT).map(call=>({...call,
        live:active.has(call.id),elapsedMs:call.status==='running' && active.has(call.id) ? millis(Date.now()-call.startedAt) : undefined,
        attempts:call.attempts.map(withRates)}));
    const labels: Record<ApiDiagnosticTask,string>={story:'主剧情','world-evolution':'世界演化',planning:'规划分析',variable:'变量生成',
        recall:'剧情回忆',polish:'正文润色','world-generation':'世界生成','realm-generation':'境界生成',novel:'小说拆分','connection-test':'连接测试',other:'其他文本请求'};
    const byTask=tasks.flatMap(task=>{
        const group=calls.filter(call=>call.task===task);
        return group.length ? [{task,label:labels[task],calls:group.length,
            failures:group.filter(call=>call.status==='error').length,running:group.filter(call=>call.status==='running' && call.live).length,
            incomplete:group.filter(call=>call.status==='running' && !call.live).length,
            invalidResults:group.filter(call=>call.result?.status==='invalid-output').length,
            totalMs:group.reduce((sum,call)=>sum+(call.durationMs || 0),0),
            maxMs:Math.max(...group.map(call=>call.durationMs || 0)),retries:group.reduce((sum,call)=>sum+call.retryCount,0)}] : [];
    });
    const slowest=[...calls].filter(call=>call.durationMs!==undefined).sort((a,b)=>b.durationMs!-a.durationMs!).slice(0,5)
        .map(call=>({id:call.id,task:call.task,label:labels[call.task],durationMs:call.durationMs,status:call.status}));
    return {schema:'mrjh-api-metrics-v1',limit:API_DIAGNOSTIC_LIMIT,omitted,storageAvailable,byTask,slowest,calls,
        summary:calls.length ? '已记录 '+calls.length+' 次近期文本 API 调用；最耗时任务：'+(slowest[0]?.label || '请求进行中')+'。' : '更新后尚无 API 计时记录；完成一次操作后再导出。',
        limitations:['仅记录本浏览器近期文本 API 调用，不含完整提示词、回复正文或密钥；工作流重新执行会另记一次调用。',
            '响应头、首个网络数据、首个模型输出、首个 content 字段分别计时；非流式或降级结果没有可测的首字速度。',
            '字符速度是客户端接收区间均值，受代理缓冲影响；Token 用量仅在接口实际返回时记录。',
            'inputBreakdown.sections 是角色兼容合并前各消息的字符统计；details 是内部块和注入来源的预处理统计，存在父子关系且可能再受外层预算筛选，不能相加。inputChars 是实际发送的最终消息总量。',
            'status 表示接口请求状态；result 表示辅助任务解析、过滤和应用结果。仅思考、无有效结果不等于无需更新；命令数量不含正文或路径。',
            '历史 running 记录可能来自刷新或中断，未记录的旧调用不能追溯计时。']};
};
