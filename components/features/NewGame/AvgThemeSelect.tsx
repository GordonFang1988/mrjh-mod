import React, { useEffect, useState } from 'react';
import { getAvgArtThemes, loadAvgPackCatalog } from '../../../services/avg/packStore';

export const avgThemeLabel = (theme?: string): string => theme === 'tianlong' ? '天龙八部'
    : theme === 'shuihu-jinpingmei' ? '水浒传与金瓶梅' : theme || '通用江湖';

const AvgThemeSelect: React.FC<{ value?: string; onChange: (theme: string) => void }> = ({ value, onChange }) => {
    const [themes, setThemes] = useState<string[]>([]);
    useEffect(() => {
        let cancelled = false;
        void loadAvgPackCatalog().then(() => { if (!cancelled) setThemes(getAvgArtThemes()); }).catch(() => {});
        return () => { cancelled = true; };
    }, []);
    return <div className="space-y-2">
        <label className="block text-sm text-wuxia-cyan font-bold">
            本存档美术主题
            <select className="mt-2 w-full rounded-md border border-wuxia-gold/40 bg-gray-900 p-3 text-white"
                value={value || ''} onChange={event => onChange(event.target.value)}>
                <option value="">通用江湖</option>
                {[...new Set(['tianlong', 'shuihu-jinpingmei', ...themes, ...(value ? [value] : [])])].map(theme =>
                    <option key={theme} value={theme}>{avgThemeLabel(theme)}</option>)}
            </select>
        </label>
        <p className="text-xs text-gray-400">决定本局优先使用的具名人物和场景资源，随存档保存；游戏中可在 AVG 设置调整。</p>
    </div>;
};
export default AvgThemeSelect;
