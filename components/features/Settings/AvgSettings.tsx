import React, { useEffect, useState } from 'react';
import type { 游戏设置结构 } from '../../../types';
import ToggleSwitch from '../../ui/ToggleSwitch';
import { getAvgArtThemes, importAvgArtPack, listAvgArtPacks, loadAvgPackCatalog, uninstallAvgArtPack } from '../../../services/avg/packStore';
import { avgDisplayStyle, DEFAULT_AVG_DISPLAY, readAvgDisplay, saveAvgDisplay, type AvgDisplayPreferences } from '../../../services/avg/displayPreferences';
import '../AVG/AvgStage.css';

const controls: Array<{ key: keyof AvgDisplayPreferences; label: string; min: number; max: number }> = [
    { key: 'scale', label: '立绘大小', min: 50, max: 150 },
    { key: 'offsetX', label: '左右位置', min: -40, max: 60 },
    { key: 'offsetY', label: '上下位置', min: -40, max: 40 },
    { key: 'recededScale', label: '旁白立绘大小', min: 40, max: 100 },
    { key: 'recededOpacity', label: '旁白立绘不透明度', min: 0, max: 100 },
    { key: 'dialogueWidth', label: '对话框宽度', min: 30, max: 95 },
    { key: 'dialoguePositionX', label: '对话框左右位置', min: 0, max: 100 },
    { key: 'dialoguePositionY', label: '对话框上移距离', min: 0, max: 60 }
];
const AvgSettings: React.FC<{ settings: 游戏设置结构; onSave: (settings: 游戏设置结构) => void }> = ({ settings, onSave }) => {
    const [form, setForm] = useState(settings);
    const [draft, setDraft] = useState(readAvgDisplay);
    const [receded, setReceded] = useState(false);
    const [layoutMessage, setLayoutMessage] = useState('');
    const [artPacks, setArtPacks] = useState<Array<{ key: string; active: boolean; scenes: number; portraits: number }>>([]);
    const [artPackMessage, setArtPackMessage] = useState('');
    const [artThemes, setArtThemes] = useState<string[]>([]);
    const [importingArtPack, setImportingArtPack] = useState(false);
    useEffect(() => { setForm(settings); }, [settings]);
    const 实时应用更新 = (patch: Partial<游戏设置结构>) => {
        const next = { ...form, ...patch }; setForm(next); onSave(next);
    };
    useEffect(() => {
        void loadAvgPackCatalog().then(() => { setArtThemes(getAvgArtThemes()); return listAvgArtPacks(); })
            .then(setArtPacks).catch(error => setArtPackMessage(error instanceof Error ? error.message : '读取 AVG 图包失败'));
    }, []);

    const handleUninstallArtPack = async (key: string) => {
        if (importingArtPack) return;
        setImportingArtPack(true);
        try {
            await uninstallAvgArtPack(key);
            setArtPacks(await listAvgArtPacks());
            setArtThemes(getAvgArtThemes());
            setArtPackMessage('已卸载图包；存档保留，读取时恢复可用的同人物资源。');
        } catch (error) { setArtPackMessage(error instanceof Error ? error.message : '卸载图包失败'); }
        finally { setImportingArtPack(false); }
    };

    const handleArtPackFiles = async (files: File[]) => {
        if (!files.length || importingArtPack) return;
        setImportingArtPack(true);
        const messages: string[] = [];
        try {
            for (const [index, file] of files.entries()) {
                setArtPackMessage(`正在导入 ${index + 1}/${files.length}：${file.name}`);
                try {
                    const result = await importAvgArtPack(file);
                    messages.push(`已导入 ${file.name}：场景 ${result.scenes} 张，立绘 ${result.portraits} 张`);
                } catch (error) {
                    messages.push(`${file.name}：${error instanceof Error ? error.message : '导入失败'}`);
                }
            }
            setArtPacks(await listAvgArtPacks());
            setArtThemes(getAvgArtThemes());
            setArtPackMessage(messages.join('；'));
        } catch (error) {
            setArtPackMessage(error instanceof Error ? error.message : '导入 AVG 图包失败');
        } finally {
            setImportingArtPack(false);
        }
    };

    return <section className="space-y-5">
        <header><h2 className="text-xl text-wuxia-gold font-bold">AVG 演出设置</h2>
            <p className="mt-2 text-sm text-gray-400">调整人物演出布局，并管理本机美术资源包。</p></header>
        <section className="space-y-4 rounded-md border border-wuxia-gold/20 bg-black/30 p-4">
            <div className="flex justify-between items-center gap-3"><h3 className="text-wuxia-cyan font-bold">立绘与对话框布局</h3>
                <button type="button" className="border border-wuxia-gold/40 rounded px-3 py-1 text-sm" onClick={() => { setDraft({ ...DEFAULT_AVG_DISPLAY }); setLayoutMessage(''); }}>恢复默认</button></div>
            <p className="text-xs text-gray-400">拖动滑块查看示意，保存后应用到所有回合。布局是本机偏好。</p>
            <div role="group" aria-label="AVG 立绘布局示意" className="relative w-full min-w-0 aspect-[16/10] min-h-[240px] max-h-[400px] overflow-hidden rounded-lg border border-wuxia-gold/30 bg-gradient-to-br from-slate-600 via-slate-800 to-black" style={avgDisplayStyle(draft)}>
                <div className="absolute inset-x-[15%] top-[12%] h-[55%] border-4 border-amber-800/50 bg-slate-500/30" />
                <svg viewBox="0 0 180 400" aria-label="示意立绘" data-avg-portrait-stage={receded ? 'receded' : 'active'} className="avg-stage-portrait">
                    <circle cx="90" cy="45" r="29" fill="#ecc9ab" />
                    <path d="M60 76 Q90 66 120 76 L145 220 L115 220 L124 385 L97 385 L90 250 L82 385 L55 385 L66 220 L35 220Z" fill="#699da3" />
                    <path d="M60 80 L38 196 M120 80 L142 196" fill="none" stroke="#ddb798" strokeWidth="17" strokeLinecap="round" />
                    <path d="M58 26 Q90 -12 122 26 L119 46 Q90 12 61 46Z" fill="#322b2a" />
                    <path d="M64 150 L116 150" stroke="#c79e55" strokeWidth="13" />
                </svg>
                <div className="avg-stage-dialogue absolute z-10 rounded-lg border border-amber-400/50 bg-black/85 p-3 min-h-[100px] max-h-[55%] overflow-auto">
                    <strong className="text-amber-200 text-sm">{receded ? '旁白' : '人物对白'}</strong><p className="mt-3 text-sm text-gray-200">立绘大小和位置示意；切换旁白查看缩小与透明效果。</p></div>
            </div>
            <div className="flex gap-2 text-sm">{[false, true].map(value => <button key={String(value)} type="button" aria-pressed={receded === value} className={`rounded border px-3 py-1 ${receded === value ? 'border-wuxia-gold text-wuxia-gold' : 'border-gray-600 text-gray-400'}`} onClick={() => setReceded(value)}>{value ? '旁白预览' : '对白预览'}</button>)}</div>
            <div className="grid gap-4 sm:grid-cols-2">{controls.map(control => <label key={control.key} className="block text-sm text-gray-200">
                <span className="flex justify-between">{control.label}<output>{draft[control.key]}%</output></span>
                <input className="w-full mt-2 accent-amber-500" type="range" aria-label={control.label} min={control.min} max={control.max} step={1} value={draft[control.key]} onChange={event => { setDraft({ ...draft, [control.key]: Number(event.target.value) }); setLayoutMessage(''); }} />
            </label>)}</div>
            <p className="text-xs text-gray-400">左右负值向左，正值向右；上下负值向上，正值向下。旁白大小以当前对白立绘为基准；不透明度越低越透明。</p>
            <p className="text-xs text-gray-400">对话框左右位置：0% 靠左、50% 居中、100% 靠右；上移距离越大位置越高。窄屏对话框保持全宽，避免文字过窄。</p>
            <button type="button" className="rounded bg-wuxia-gold text-black font-bold px-4 py-2" onClick={() => { try { saveAvgDisplay(draft); setLayoutMessage('AVG 布局已保存。'); } catch { setLayoutMessage('保存失败，请检查浏览器本地存储空间。'); } }}>保存 AVG 布局</button>
            {layoutMessage && <p role="status" className="text-sm text-wuxia-gold">{layoutMessage}</p>}
        </section>
            <div className="space-y-3 rounded-md border border-wuxia-gold/20 bg-black/30 p-4">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <div className="text-sm text-wuxia-cyan font-bold">AVG 演出场景</div>
                        <div className="text-xs text-gray-400 mt-1">在现有剧情请求中输出固定场景分类和段落转场；已有回合仍可切换原文阅读。</div>
                    </div>
                    <ToggleSwitch checked={form.启用AVG演出 !== false}
                        onChange={(next) => 实时应用更新({ 启用AVG演出: next })}
                        ariaLabel="切换 AVG 演出场景" />
                </div>
                <div className="border-t border-wuxia-gold/20 pt-3 text-xs text-gray-300">
                    <label className="mb-3 flex items-center gap-3">本存档美术主题
                        <select className="rounded border border-wuxia-gold/40 bg-gray-900 px-3 py-2"
                            value={form.AVG主题 || ''} onChange={event => 实时应用更新({ AVG主题: event.target.value })}>
                            <option value="">通用江湖</option>
                            {[...new Set(['tianlong', 'shuihu-jinpingmei', ...artThemes, ...(form.AVG主题 ? [form.AVG主题] : [])])].map(id =>
                                <option key={id} value={id}>{id === 'tianlong' ? '天龙八部' : id === 'shuihu-jinpingmei' ? '水浒传与金瓶梅' : id}</option>)}
                        </select>
                    </label>
                    <p className="mb-3 text-gray-400">优先使用所选故事的人物资源，缺少时使用通用库。已绑定人物保留原形象。</p>
                    <div className="flex flex-wrap items-center gap-3">
                        <label className="cursor-pointer rounded border border-wuxia-gold/50 px-3 py-2 text-wuxia-gold">
                            导入 AVG 美术 ZIP
                            <input type="file" accept=".zip,application/zip" multiple className="hidden" disabled={importingArtPack}
                                onChange={event => { void handleArtPackFiles(Array.from(event.target.files || [])); event.target.value = ''; }} />
                        </label>
                        <span>图包独立存放；存档只记录素材绑定。</span>
                    </div>
                    {artPacks.filter(pack => pack.active).map(pack =>
                        <div key={pack.key} className="mt-2 flex justify-between gap-2 items-center">
                            <span>{pack.key} · 场景 {pack.scenes} · 立绘 {pack.portraits}</span>
                            <button type="button" disabled={importingArtPack} aria-label={`卸载 ${pack.key}`}
                                className="shrink-0 border border-wuxia-gold/30 rounded px-2 py-1 disabled:opacity-40"
                                onClick={() => { void handleUninstallArtPack(pack.key); }}>卸载</button>
                        </div>)}
                    {artPackMessage && <div className="mt-2" role="status">{artPackMessage}</div>}
                </div>
            </div>
    </section>;
};
export default AvgSettings;
