import React, { useEffect, useMemo, useState } from 'react';
import { fetchApiModels } from '../../../services/ai/modelList';
import { 接口设置结构, 单接口配置结构, 功能模型占位配置结构 } from '../../../types';
import GameButton from '../../ui/GameButton';
import ToggleSwitch from '../../ui/ToggleSwitch';
import InlineSelect from '../../ui/InlineSelect';
import { 规范化接口设置, 获取当前接口配置, 获取功能基础接口配置, 功能使用旧独立接口, 记录接口档案模型列表 } from '../../../utils/apiConfig';
import ApiProfileBinding from './ApiProfileBinding';

interface Props {
    settings: 接口设置结构;
    onSave: (settings: 接口设置结构) => void;
}

const WorldEvolutionModelSettings: React.FC<Props> = ({ settings, onSave }) => {
    const [form, setForm] = useState<接口设置结构>(() => 规范化接口设置(settings));
    const [modelOptions, setModelOptions] = useState<string[]>([]);
    const [loadingModels, setLoadingModels] = useState(false);
    const [message, setMessage] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);

    useEffect(() => {
        const normalized = 规范化接口设置(settings);
        setForm(normalized);
        setModelOptions([]);
    }, [settings]);

    const activeConfig = useMemo<单接口配置结构 | null>(() => {
        if (!form.configs.length) return null;
        const selected = form.configs.find((cfg) => cfg.id === form.activeConfigId);
        return selected || form.configs[0] || null;
    }, [form.activeConfigId, form.configs]);

    const 主剧情解析模型 = useMemo(() => {
        return (activeConfig?.model || form.功能模型占位.主剧情使用模型 || '').trim();
    }, [activeConfig?.model, form.功能模型占位.主剧情使用模型]);

    const 独立模型开启 = Boolean(form.功能模型占位.世界演变独立模型开关);
    const 功能接口 = 独立模型开启 ? 获取功能基础接口配置(form, '世界演变') : 获取当前接口配置(form);

    const updatePlaceholder = <K extends keyof 功能模型占位配置结构>(key: K, value: 功能模型占位配置结构[K]) => {
        setForm(prev => ({
            ...prev,
            功能模型占位: {
                ...prev.功能模型占位,
                [key]: value
            }
        }));
    };

    const fetchModelsFromCurrentConfig = async (): Promise<string[] | null> => {
        const requestConfig = 功能接口;
        const resolvedBaseUrl = requestConfig?.baseUrl || '';
        const resolvedApiKey = requestConfig?.apiKey || '';
        if (!resolvedApiKey || !resolvedBaseUrl) {
            setMessage('请先填写可用的 API Key 与 Base URL（支持独立密钥）。');
            return null;
        }
        try {
            const models = await fetchApiModels(resolvedBaseUrl, {
                headers: { Authorization: `Bearer ${resolvedApiKey}` }
            }, { apiProfileId: requestConfig?.id });
            if (models) {
                if (requestConfig && !功能使用旧独立接口(form, '世界演变')) {
                    setForm(prev => 记录接口档案模型列表(prev, requestConfig.id, models, requestConfig));
                }
                return models;
            }
            setMessage('获取失败：返回格式错误。');
            return null;
        } catch (e: any) {
            setMessage(`获取失败：${e.message}`);
            return null;
        }
    };

    const handleFetchModels = async () => {
        setLoadingModels(true);
        setMessage('');
        const models = await fetchModelsFromCurrentConfig();
        if (models) {
            setModelOptions(models);
            setMessage('世界演变模型列表获取成功。');
        }
        setLoadingModels(false);
    };

    const handleToggleIndependent = (checked: boolean) => {
        setForm(prev => {
            const currentModel = (prev.功能模型占位.世界演变使用模型 || '').trim();
            return {
                ...prev,
                功能模型占位: {
                    ...prev.功能模型占位,
                    世界演变独立模型开关: checked,
                    世界演变使用模型: checked ? (currentModel || 主剧情解析模型 || '') : ''
                }
            };
        });
    };

    const handleSave = () => {
        if (独立模型开启 && typeof form.功能模型占位.功能API档案?.世界演变 === 'string'
            && (!功能接口?.baseUrl || !功能接口?.apiKey)) {
            setMessage('请先选择可用的 API 档案，或在 API 设置中补全连接信息。');
            return;
        }
        if (独立模型开启 && !(form.功能模型占位.世界演变使用模型 || '').trim()) {
            setMessage('已开启世界演变独立模型，请先获取列表并选择模型。');
            return;
        }
        const normalized = 规范化接口设置(form);
        onSave(normalized);
        setForm(normalized);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
    };

    const worldModelValue = (form.功能模型占位.世界演变使用模型 || '').trim();
    const worldModelDisplay = 独立模型开启 ? worldModelValue : 主剧情解析模型;
    const selectOptions = Array.from(
        new Set(
            [
                ...(功能接口?.模型列表 || []), ...(功能使用旧独立接口(form, '世界演变') ? modelOptions : []),
                worldModelValue,
                (功能接口?.model || '')
            ]
                .map(item => (item || '').trim())
                .filter(Boolean)
        )
    );

    return (
        <div className="space-y-6 text-sm animate-fadeIn">
            <div className="flex justify-between items-center border-b border-wuxia-gold/30 pb-3 mb-6">
                <h3 className="text-wuxia-gold font-serif font-bold text-xl">世界演变模型</h3>
            </div>

            <div className="rounded-md border border-wuxia-gold/20 bg-black/25 p-4 space-y-4">
                <div className="text-[11px] text-gray-400">
                    当前启用接口配置：{activeConfig?.名称 || '未配置'}。可选择已保存的 API 档案，无需重复填写地址与密钥。
                </div>

                <label className="flex items-center justify-between gap-3 text-xs text-gray-300">
                    <span>开启世界演变独立模型</span>
                    <ToggleSwitch
                        checked={独立模型开启}
                        onChange={handleToggleIndependent}
                        ariaLabel="切换世界演变独立模型"
                    />
                </label>

                <ApiProfileBinding settings={form} usage="世界演变" enabled={独立模型开启} onChange={setForm} onProfileChange={() => setModelOptions([])} />
                <div className="flex gap-3 items-end">
                    <div className="flex-1 space-y-1">
                        <label className="text-xs text-gray-300">世界演变使用模型</label>
                        <InlineSelect
                            value={worldModelDisplay}
                            options={selectOptions.map((model) => ({
                                value: model,
                                label: model
                            }))}
                            onChange={(model) => updatePlaceholder('世界演变使用模型', model)}
                            disabled={!独立模型开启 || selectOptions.length === 0}
                            placeholder={!独立模型开启
                                ? `跟随主剧情模型：${主剧情解析模型 || '未设置'}`
                                : (selectOptions.length ? '请选择模型' : '请先点击获取列表')}
                            buttonClassName={独立模型开启
                                ? 'bg-black/50 border-gray-600 py-2.5'
                                : 'bg-black/30 border-gray-700 py-2.5'}
                        />
                    </div>
                    <GameButton
                        onClick={handleFetchModels}
                        variant="secondary"
                        className="px-4 py-2 text-xs"
                        disabled={loadingModels}
                    >
                        {loadingModels ? '...' : '获取列表'}
                    </GameButton>
                </div>
                {功能使用旧独立接口(form, '世界演变') && (
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <label className="text-xs text-gray-300">世界演变独立 API 地址（可选）</label>
                            <input
                                type="text"
                                value={form.功能模型占位.世界演变API地址 || ''}
                                onChange={(e) => updatePlaceholder('世界演变API地址', e.target.value)}
                                placeholder={activeConfig?.baseUrl || '留空则复用主剧情 Base URL'}
                                disabled={!独立模型开启}
                                className={`w-full border p-2 text-white rounded-md outline-none ${
                                    独立模型开启
                                        ? 'bg-black/50 border-gray-700 focus:border-wuxia-gold'
                                        : 'bg-black/30 border-gray-800 text-gray-400'
                                }`}
                            />
                            <div className="text-[11px] text-gray-500">
                                留空则复用主剧情 Base URL；填写后仅世界演变请求改用此地址。
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-gray-300">世界演变独立 API 密钥（可选）</label>
                            <input
                                type="password"
                                value={form.功能模型占位.世界演变API密钥 || ''}
                                onChange={(e) => updatePlaceholder('世界演变API密钥', e.target.value)}
                                placeholder={activeConfig?.apiKey ? '留空则复用主剧情 API Key' : 'sk-...'}
                                disabled={!独立模型开启}
                                className={`w-full border p-2 text-white rounded-md outline-none ${
                                    独立模型开启
                                        ? 'bg-black/50 border-gray-700 focus:border-wuxia-gold'
                                        : 'bg-black/30 border-gray-800 text-gray-400'
                                }`}
                            />
                            <div className="text-[11px] text-gray-500">
                                留空则复用主剧情 API Key；填写后世界演变请求优先使用该密钥。
                            </div>
                        </div>
                    </div>
                )}

                {!独立模型开启 && (
                    <div className="text-[11px] text-gray-400">
                        当前状态：世界演变自动更新关闭
                    </div>
                )}
            </div>

            {message && <p className="text-xs text-wuxia-cyan animate-pulse">{message}</p>}

            <div className="pt-6 border-t border-wuxia-gold/20 mt-8">
                <GameButton onClick={handleSave} variant="primary" className="w-full">
                    {showSuccess ? '✔ 配置已保存' : '保存设置'}
                </GameButton>
            </div>
        </div>
    );
};

export default WorldEvolutionModelSettings;
