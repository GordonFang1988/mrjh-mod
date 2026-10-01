export interface ReleaseNoteUpdate {
    id: string; time: string; version: string; title: string; summary: string; items: readonly string[];
}
export interface ReleaseNoteEntry { id: string; date: string; updates: readonly ReleaseNoteUpdate[]; }
export const releaseNotes: readonly ReleaseNoteEntry[] = [{
    id: '2026-10-01', date: '2026年10月1日', updates: [{
        id: '2026-10-01-v1.0.0', time: '13:56', version: 'v1.0.0',
        title: '1.0.0 版本基线 · AVG 演出与存档兼容',
        summary: '将当前已完成的功能统一归入 1.0.0，并建立版本号与更新日志。',
        items: [
            '支持 AVG 对白演出、立绘前后景变化、页面沉浸和全屏；沉浸时保留状态栏与行动输入，左右边缘可展开面板。',
            '点击舞台空白处或按空格翻句；点击人物立绘可放大，支持缩放、拖动和双击复位。',
            'AVG 设置可调整立绘大小、透明度和位置，以及对话框宽度和位置；布局偏好在本机保存。',
            '支持多次导入美术 ZIP，并按存档主题优先匹配专用资源；缺少专用图时使用通用库，资源包独立安装。',
            '修复旧存档中武大郎专用立绘、年轻成年人物匹配和缺少场景提示时的背景回退。',
            '修复空功法条目导致的白屏，在功法与世界事件写入、读档和显示时处理无效记录。',
            '右上角可复制或下载 AVG 诊断信息，方便排查图片绑定与加载问题。',
            '2026-07-01：修复稳定 NPC 命令解析时丢失 npcId/npcName 的问题，并兼容中文登记、状态更新、记忆与互动命令，使剧情人物正确入档。',
            '2026-06-22：完善 NPC 安全写入，增加 registerNpc、updateNpcState 与校准、执行、数据规范化防护，禁止危险的社交数组下标写入，防止空档案及记忆错写。',
            '早期修改（2026-05-26 起）：增加按 npcId 定位的 pushNpcMemory 命令及提示词约束，避免 AI 猜测数组下标；增加 Netlify 构建配置与首页像素风动态背景。',
            '将首页版权声明与原修改日志合并到本更新日志，刷新时每天仅提醒一次，有新版本记录时再次提醒，也可通过版本入口随时查看。'
        ]
    }]
}];
