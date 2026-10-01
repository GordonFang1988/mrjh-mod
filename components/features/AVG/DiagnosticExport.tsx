import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { 聊天记录结构, NPC结构, 场景图片档案, 环境信息结构 } from '../../../types';
import { buildAvgDiagnostic } from '../../../services/avg/diagnostics';

const DiagnosticExport: React.FC<{
    history: 聊天记录结构[]; social: NPC结构[]; environment: 环境信息结构;
    theme?: string; archive?: 场景图片档案; onClose: () => void;
}> = props => {
    const [text, setText] = useState('');
    const [status, setStatus] = useState('正在整理诊断…');
    useEffect(() => {
        let disposed = false;
        void buildAvgDiagnostic(props).then(report => {
            if (!disposed) { setText(JSON.stringify(report, null, 2)); setStatus('诊断已就绪，可复制给开发者。'); }
        }).catch(error => { if (!disposed) setStatus(error instanceof Error ? error.message : '诊断生成失败'); });
        return () => { disposed = true; };
    }, []);
    return createPortal(<div className="fixed inset-0 z-[2500] bg-black/80 p-3 sm:p-8 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="诊断导出" onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') props.onClose(); }}>
        <section className="w-full max-w-4xl max-h-[90dvh] rounded-xl border border-wuxia-gold/50 bg-slate-950 p-4 flex flex-col gap-3">
            <header className="flex justify-between items-center"><h2 className="text-lg font-bold text-wuxia-gold">诊断导出</h2><button type="button" className="text-gray-300" onClick={props.onClose}>关闭诊断</button></header>
            <p className="text-sm text-gray-300">包含美术匹配字段、绑定、资源是否存在及演出状态，不包含 API 密钥和图片文件。</p>
            <textarea aria-label="诊断导出原文" className="w-full h-[55dvh] min-h-40 bg-black/50 border border-gray-700 rounded p-3 font-mono text-xs text-gray-200" readOnly value={text} />
            <div className="flex gap-3 text-sm">
                <button type="button" disabled={!text} className="rounded border border-wuxia-gold/50 px-3 py-2 text-wuxia-gold disabled:opacity-40" onClick={() => {
                    if (!navigator.clipboard) { setStatus('可在文本框中全选复制。'); return; }
                    void navigator.clipboard.writeText(text).then(() => setStatus('诊断已复制。')).catch(() => setStatus('自动复制失败，可在文本框中全选复制。'));
                }}>复制诊断</button>
                <button type="button" disabled={!text} className="rounded border border-wuxia-gold/50 px-3 py-2 text-wuxia-gold disabled:opacity-40" onClick={() => {
                    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
                    const link = document.createElement('a'); link.href = url; link.download = `mrjh-diagnostic-${new Date().toISOString().replace(/[:.]/g, '-')}.json`; link.click();
                    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
                }}>下载诊断 JSON</button>
            </div>
            <p role="status" className="text-xs text-gray-400">{status}</p>
        </section>
    </div>, document.body);
};
export default DiagnosticExport;
