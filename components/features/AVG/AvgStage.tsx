import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useId } from 'react';
import { useAvgImmersive, setAvgImmersive, exitAvgImmersiveOwner, isAvgInteractiveTarget } from '../../../services/avg/immersive';
import { createPortal } from 'react-dom';
import type { AvgPresentation, AvgPortraitBinding, GameLog, NPC结构, NPC生图结果, 场景图片档案 } from '../../../types';
import { use图片资源回源预取 } from '../../../hooks/useImageAssetPrefetch';
import { 获取图片展示地址, 获取图片资源文本地址 } from '../../../utils/imageAssets';
import { getAvgPackImageBlob, isAvgPackImage } from '../../../services/avg/packStore';
import { avgSamePersonOptions } from '../../../services/avg/identity';
import { getAvgPortraitAssets } from '../../../services/avg/portraitResolver';
import { portraitStageForStep } from './portraitStage';
import { AvgPortraitViewer } from './AvgPortraitViewer';
import './AvgStage.css';
import { avgDisplayStyle, useAvgDisplay } from '../../../services/avg/displayPreferences';

interface Props {
    isLatest?: boolean;
    logs: GameLog[];
    presentation?: AvgPresentation;
    portraitBindings?: Record<string, AvgPortraitBinding>;
    socialList?: NPC结构[];
    sceneArchive?: 场景图片档案;
    onSelectPortrait?: (npcId: string, selection: string) => Promise<void> | void;
    onSelectSceneImage?: (sceneRef: string, imageId: string) => Promise<void> | void;
}

/** The existing image archive is reused only for an exact, unique NPC identity and selected portrait. */
const selectedPortraitRecord = (sender: string, socialList?: NPC结构[]): NPC生图结果 | undefined => {
    const actors = (socialList || []).filter(npc => npc?.姓名?.trim() === sender.trim());
    if (actors.length !== 1) return undefined;
    const archive = actors[0].图片档案;
    const id = archive?.已选立绘图片ID;
    return archive?.生图历史?.find(item => item.id === id && item.状态 === 'success'
        && (item.构图 === '立绘' || item.构图 === '半身'));
};

const useAvgPackImage = (source?: string): string => {
    const [loaded, setLoaded] = useState<{ source: string; url: string }>({ source: '', url: '' });
    useEffect(() => {
        if (!isAvgPackImage(source)) return;
        let cancelled = false;
        let url = '';
        void getAvgPackImageBlob(source).then(blob => {
            if (!blob || cancelled) return;
            url = URL.createObjectURL(blob);
            setLoaded({ source, url });
        });
        return () => {
            cancelled = true;
            // Give the browser's pending image request time to finish after a fast page turn.
            if (url) window.setTimeout(() => URL.revokeObjectURL(url), 2000);
        };
    }, [source]);
    return loaded.source === source ? loaded.url : '';
};

const AvgStage: React.FC<Props> = ({ isLatest = false, logs, presentation, portraitBindings, socialList, sceneArchive, onSelectSceneImage, onSelectPortrait }) => {
    const displayPreferences = useAvgDisplay();
    const [index, setIndex] = useState(0);
    const [failedImage, setFailedImage] = useState('');
    const [showPortraitPicker, setShowPortraitPicker] = useState(false);
    const [showImagePicker, setShowImagePicker] = useState(false);
    const [selectionError, setSelectionError] = useState('');
    const [portraitPreview, setPortraitPreview] = useState<{ src: string; name: string } | null>(null);
    const owner = useId();
    const immersive = useAvgImmersive();
    const pageImmersive = immersive.active && immersive.owner === owner;
    const setPageImmersive = (value: boolean | ((previous: boolean) => boolean)) => setAvgImmersive(owner, typeof value === 'function' ? value(pageImmersive) : value, isLatest);
    useEffect(() => () => exitAvgImmersiveOwner(owner), [owner]);
    useEffect(() => {
        if (isLatest && immersive.active && immersive.followLatest && immersive.owner !== owner) setAvgImmersive(owner, true, true);
    }, [isLatest, immersive.active, immersive.followLatest, immersive.owner, owner]);
    const stageRef = useRef<HTMLDivElement>(null);

    const steps = useMemo(() => (logs || []).filter(item => item?.text?.trim()), [logs]);
    const safeIndex = Math.min(index, Math.max(0, steps.length - 1));
    const step = steps[safeIndex];
    const sceneRef = presentation?.mode === 'multi' ? step?.avgSceneRef : 'final';
    const scene = presentation?.scenes.find(item => item.ref === sceneRef)
        || (presentation?.mode === 'multi' ? undefined : presentation?.scenes[0]);
    const archived = scene?.assetId?.startsWith('archive:')
        ? sceneArchive?.生图历史?.find(item => item.id === scene.assetId?.slice('archive:'.length))
        : undefined;
    const portraitStage = portraitStageForStep(steps, safeIndex, presentation?.mode === 'multi');
    const portraitSender = portraitStage?.sender;
    const actorBinding = portraitSender ? portraitBindings?.[portraitSender] : undefined;
    const actor = socialList?.find(npc => npc.id === actorBinding?.npcId);
    const portraitOptions = avgSamePersonOptions(actorBinding?.assetId?.startsWith('archive:') && actor?.AVG美术选择?.baseAssetId
        ? { ...actorBinding, assetId: actor.AVG美术选择.baseAssetId, baseAssetId: actor.AVG美术选择.baseAssetId } : actorBinding, getAvgPortraitAssets());
    const selectPortrait = (selection: string) => {
        if (!actorBinding?.npcId || !onSelectPortrait) return;
        setSelectionError('');
        void Promise.resolve(onSelectPortrait(actorBinding.npcId, selection)).then(() => setShowPortraitPicker(false))
            .catch(error => setSelectionError(error instanceof Error ? error.message : '设置立绘失败'));
    };
    const packSceneImage = useAvgPackImage(scene?.image);
    const packActorImage = useAvgPackImage(actorBinding?.image);
    // Only legacy turns without a saved binding may consult today's selected image.
    // New turns must render their own snapshot, including an explicit no-art result.
    const selectedActorPicture = portraitSender && !portraitBindings ? selectedPortraitRecord(portraitSender, socialList) : undefined;
    use图片资源回源预取(scene?.image, actorBinding?.image, archived, selectedActorPicture);
    const resolvedImage = isAvgPackImage(scene?.image) ? packSceneImage
        : scene?.image ? 获取图片资源文本地址(scene.image) : 获取图片展示地址(archived);
    const image = resolvedImage && resolvedImage !== failedImage ? resolvedImage : '';
    const actorImage = portraitSender
        ? (actorBinding ? (isAvgPackImage(actorBinding.image) ? packActorImage : 获取图片资源文本地址(actorBinding.image))
            : 获取图片展示地址(selectedActorPicture)) : '';

    const playbackKey = steps.map(item => `${item.sender}\u0000${item.text}\u0000${item.avgSceneRef || ''}`).join('\u0001');
    useEffect(() => { setIndex(0); }, [playbackKey]);
    useEffect(() => { setFailedImage(''); }, [scene?.image]);
    useEffect(() => { if (pageImmersive) stageRef.current?.focus(); }, [pageImmersive]);
    useEffect(() => {
        const next = steps[safeIndex + 1];
        const nextRef = presentation?.mode === 'multi' ? next?.avgSceneRef : 'final';
        const nextImage = presentation?.scenes.find(item => item.ref === nextRef)?.image;
        if (nextImage && !isAvgPackImage(nextImage) && nextImage !== image) { const preload = new Image(); preload.src = nextImage; }
    }, [steps, safeIndex, presentation, image]);

    const move = (delta: number) => setIndex(value => Math.max(0, Math.min(steps.length - 1, value + delta)));
    const onKeyDown = (event: React.KeyboardEvent) => {
        if (isAvgInteractiveTarget(event.target)) return;
        if (event.repeat) return;
        if (event.key === 'Escape' && pageImmersive) {
            event.preventDefault(); setPageImmersive(false);
        } else if (event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault(); move(1);
        } else if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
    };

    if (!step) return <div className="rounded-xl border border-amber-500/30 p-6 text-gray-300">本回合暂无可播放正文。</div>;

    const stageContent = <div style={avgDisplayStyle(displayPreferences)} ref={stageRef} tabIndex={0} onKeyDown={onKeyDown} onClick={event => {
            if (isAvgInteractiveTarget(event.target) || window.getSelection()?.toString()) return;
            stageRef.current?.focus(); move(1);
        }}
        aria-label="AVG 演出舞台，左右方向键翻页"
        className={`${pageImmersive ? 'avg-immersive-stage fixed left-0 right-0 z-[100] rounded-none' : 'relative w-full aspect-[16/10] min-h-[280px] rounded-xl'} overflow-hidden border border-amber-500/40 bg-slate-900 text-white outline-none focus-visible:ring-2 focus-visible:ring-amber-400 [&:fullscreen]:h-screen [&:fullscreen]:w-screen [&:fullscreen]:rounded-none`}>
        {image && <img key={image} src={image} alt={scene?.label || '场景背景'} onError={() => setFailedImage(image)} className="absolute inset-0 h-full w-full object-cover" />}
        {!image && <div className="absolute inset-0 bg-gradient-to-br from-slate-700 via-slate-900 to-black" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/30" />
        <div className="absolute z-10 left-3 top-3 right-3 flex items-start justify-between gap-3 text-xs">
            <div className="rounded bg-black/60 px-2 py-1 text-amber-100 max-w-[75%] truncate" title={scene?.label}>{scene?.label || '场景未定'}</div>
            <div className="flex gap-1 shrink-0">
                {onSelectPortrait && actorBinding?.npcId && <button type="button" className="rounded bg-black/60 px-2 py-1 hover:bg-black/80" onClick={() => setShowPortraitPicker(value => !value)}>人物造型</button>}
                {onSelectSceneImage && <button type="button" className="rounded bg-black/60 px-2 py-1 hover:bg-black/80" onClick={() => setShowImagePicker(value => !value)}>选背景</button>}
                <button type="button" className="rounded bg-black/60 px-2 py-1 hover:bg-black/80" onClick={() => { setPageImmersive(value => !value); stageRef.current?.focus(); }}>{pageImmersive ? '退出沉浸' : '页面沉浸'}</button>
                <button type="button" className="rounded bg-black/60 px-2 py-1 hover:bg-black/80" onClick={() => {
                    setPageImmersive(true);
                    if (typeof document.documentElement.requestFullscreen === 'function') {
                        void document.documentElement.requestFullscreen().catch(() => undefined);
                    }
                    stageRef.current?.focus();
                }}>全屏</button>
            </div>
        </div>
        {showPortraitPicker && actorBinding && <div className="absolute left-3 top-11 z-20 max-w-[85%] rounded border border-amber-400/50 bg-black/90 p-3 text-xs" onKeyDown={event => event.stopPropagation()}>
            <strong className="block mb-2 text-amber-200">{portraitSender} · 人物造型</strong>
            <p className="mb-2 text-gray-300">只切换此人的造型；选择后供后续回合沿用。</p>
            <div className="flex gap-2 mb-2">
                <button type="button" className="border border-white/30 rounded px-2 py-1" onClick={() => selectPortrait('__auto')}>优先使用已选生图</button>
                <button type="button" className="border border-white/30 rounded px-2 py-1" onClick={() => selectPortrait('__base')}>恢复基础立绘</button>
            </div>
            {portraitOptions.length > 0 && <label>已有造型 <select className="bg-slate-900 p-1" value={actorBinding.assetId || ''} onChange={event => selectPortrait(event.target.value)}>
                {actorBinding.assetId?.startsWith('archive:') && <option value={actorBinding.assetId}>当前生图</option>}
                {portraitOptions.map((asset, optionIndex) => <option key={asset.id} value={asset.id}>{asset.variantLabel || (asset.variantStage === 'outfit-1' ? '出行装'
                    : asset.variantStage === 'outfit-2' ? '居家装' : !asset.variantStage ? '基础造型'
                    : /[\u4e00-\u9fff]/.test(asset.variantStage) ? asset.variantStage : `其他造型 ${optionIndex}`)}</option>)}
            </select></label>}
            {selectionError && <p role="alert" className="mt-1 text-red-300">{selectionError}</p>}
        </div>}
        {showImagePicker && onSelectSceneImage && scene && <div className="absolute right-3 top-11 z-20 max-w-[75%] rounded border border-amber-400/50 bg-black/90 p-2 text-xs">
            <label className="block mb-1 text-amber-200">为此地点选择已有场景图</label>
            <p className="mb-1 max-w-64 text-gray-300">选择后，此地点的后续回合沿用；有场景分类时也会标注此图，供新地点自动匹配。</p>
            <select className="max-w-full bg-slate-900 text-white p-1" value={scene.assetId?.startsWith('archive:') ? scene.assetId.slice(8) : ''}
                onChange={event => {
                    setSelectionError('');
                    void Promise.resolve(onSelectSceneImage(scene.ref, event.target.value))
                        .then(() => setShowImagePicker(false))
                        .catch(error => setSelectionError(error instanceof Error ? error.message : '设置背景失败'));
                }}>
                <option value="">恢复预制／中性背景</option>
                {(sceneArchive?.生图历史 || []).filter(item => item?.id && item?.状态 === 'success').map(item =>
                    <option key={item.id} value={item.id}>{item.摘要 || item.场景类型 || item.上传文件名 || item.id}</option>)}
            </select>
            {selectionError && <p role="alert" className="mt-1 text-red-300">{selectionError}</p>}
        </div>}
        {actorImage && <img key={portraitSender} src={actorImage} alt={`${portraitSender} 立绘`}
            role="button" tabIndex={0} data-avg-no-advance aria-label={`放大查看${portraitSender}立绘`}
            title="点击放大查看立绘"
            onClick={() => setPortraitPreview({ src: actorImage, name: portraitSender || '人物' })}
            onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault(); event.stopPropagation();
                    setPortraitPreview({ src: actorImage, name: portraitSender || '人物' });
                }
            }}
            data-avg-portrait-stage={portraitStage?.mode} className="avg-stage-portrait" />}
        {portraitPreview && <AvgPortraitViewer src={portraitPreview.src} alt={`${portraitPreview.name} 立绘大图`}
            title={portraitPreview.name} onClose={() => setPortraitPreview(null)} />}
        <div className="avg-stage-dialogue absolute z-10 rounded-lg border border-amber-400/50 bg-black/85 backdrop-blur-sm min-h-[120px] max-h-[55%] flex flex-col">
            <div className="border-b border-amber-400/20 px-3 py-2 flex justify-between items-center gap-2">
                <strong className="text-amber-200 text-sm truncate">{step.sender}</strong>
                <span className="text-gray-400 text-xs shrink-0">{safeIndex + 1} / {steps.length}</span>
            </div>
            <div className="px-3 py-3 text-sm sm:text-base leading-relaxed overflow-y-auto whitespace-pre-wrap flex-1">{step.text}</div>
            <div className="flex justify-end gap-2 px-3 pb-2 text-xs">
                <button type="button" disabled={safeIndex === 0} onClick={() => setIndex(0)} className="rounded border border-white/30 px-3 py-1 disabled:opacity-40">重播</button>
                <button type="button" disabled={safeIndex === 0} onClick={() => move(-1)} className="rounded border border-white/30 px-3 py-1 disabled:opacity-40">上一段</button>
                <button type="button" disabled={safeIndex >= steps.length - 1} onClick={() => move(1)} className="rounded border border-amber-400/60 text-amber-100 px-3 py-1 disabled:opacity-40">下一段 ▶</button>
            </div>
        </div>
    </div>;
    return pageImmersive ? createPortal(stageContent, document.querySelector('[data-avg-game-shell]') || document.body) : stageContent;
};

export default AvgStage;
