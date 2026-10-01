import React, { useId } from 'react';
import type { 功能API用途, 接口设置结构 } from '../../../models/system';
import {
    功能存在旧独立配置, 功能使用旧独立接口, 获取功能基础接口配置,
    设置功能API档案, 供应商标签, 请求协议覆盖标签
} from '../../../utils/apiConfig';

type Props = {
    settings: 接口设置结构;
    usage: 功能API用途;
    enabled?: boolean;
    onChange: (settings: 接口设置结构) => void;
    onProfileChange?: () => void;
    children?: React.ReactNode;
};

const ApiProfileBinding: React.FC<Props> = ({ settings, usage, enabled = true, onChange, onProfileChange, children }) => {
    const inputId = useId();
    const legacy = 功能使用旧独立接口(settings, usage);
    const value = legacy ? '__legacy__' : settings.功能模型占位.功能API档案?.[usage] || '';
    const config = 获取功能基础接口配置(settings, usage);
    const missing = value && value !== '__legacy__' && !settings.configs.some(profile => profile.id === value);
    return (
        <div className="space-y-2 rounded-md border border-wuxia-gold/20 bg-black/20 p-3">
            <label htmlFor={inputId} className="block text-xs text-gray-300">{usage} API 档案</label>
            <select
                id={inputId}
                aria-label={`${usage} API 档案`}
                value={value}
                disabled={!enabled}
                className="w-full rounded-md border border-gray-600 bg-black/70 p-2 text-white disabled:opacity-50"
                onChange={event => {
                    onChange(设置功能API档案(settings, usage, event.target.value === '__legacy__' ? undefined : event.target.value));
                    onProfileChange?.();
                }}
            >
                <option value="">跟随主 API 档案</option>
                {settings.configs.map(profile => (
                    <option key={profile.id} value={profile.id}>{profile.名称} · {供应商标签[profile.供应商]}</option>
                ))}
                {功能存在旧独立配置(settings, usage) && <option value="__legacy__">旧独立配置（兼容）</option>}
                {missing && <option value={value}>已删除的 API 档案</option>}
            </select>
            {missing ? (
                <p role="alert" className="text-xs text-red-300">所选 API 档案已不存在，请重新选择；不会自动改用其他接口。</p>
            ) : config ? (
                <div className="break-all text-[11px] leading-5 text-gray-400">
                    <div>接口类型：{供应商标签[config.供应商]} · 协议：{请求协议覆盖标签[config.协议覆盖 || 'auto']}</div>
                    <div>地址：{config.baseUrl || '未填写'}</div>
                </div>
            ) : <p className="text-[11px] text-gray-400">请先在“API 设置”保存一个 API 档案。</p>}
            <p className="text-[11px] leading-5 text-gray-500">地址、密钥和接口类型在“API 设置”统一维护。此处复用档案，可另选模型；功能开关与调用流程保持原有设置。</p>
            {legacy && children && <div className="space-y-3 border-t border-gray-700 pt-3">{children}</div>}
        </div>
    );
};

export default ApiProfileBinding;
