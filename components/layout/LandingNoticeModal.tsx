import React from 'react';

const NOTICE_STORAGE_KEY = 'mrjh-mod-notice-dismissed-date';
const NOTICE_VERSION = '2026-06-22';

const getTodayKey = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}:${NOTICE_VERSION}`;
};

const LandingNoticeModal: React.FC = () => {
    const [open, setOpen] = React.useState(false);
    const [hideToday, setHideToday] = React.useState(false);

    React.useEffect(() => {
        if (typeof window === 'undefined') return;
        const dismissedDate = window.localStorage.getItem(NOTICE_STORAGE_KEY);
        setOpen(dismissedDate !== getTodayKey());
    }, []);

    const close = () => {
        if (hideToday && typeof window !== 'undefined') {
            window.localStorage.setItem(NOTICE_STORAGE_KEY, getTodayKey());
        }
        setOpen(false);
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm animate-fadeIn">
            <div className="relative w-full max-w-2xl overflow-hidden border border-wuxia-gold/35 bg-[#090b0d]/95 shadow-[0_0_60px_rgba(0,0,0,0.75)]">
                <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(135deg,rgba(230,200,110,0.12),transparent_34%,rgba(13,188,195,0.08))]" />
                <div className="relative z-10 border-b border-wuxia-gold/20 px-6 py-5">
                    <div className="text-[11px] tracking-[0.42em] text-wuxia-gold/60">MRJH MOD</div>
                    <h2 className="mt-2 font-serif text-2xl font-bold tracking-[0.18em] text-wuxia-gold">
                        版权声明与修改日志
                    </h2>
                </div>

                <div className="relative z-10 max-h-[62vh] space-y-5 overflow-y-auto px-6 py-5 text-sm leading-7 text-gray-200">
                    <section>
                        <h3 className="mb-2 font-serif text-base font-bold tracking-[0.18em] text-wuxia-cyan">版权声明</h3>
                        <p>
                            本站基于开源项目 MikuLXK/MoRanJiangHu 修改制作，原项目版权与开源协议归原作者及贡献者所有。
                            本修改版用于个人学习、体验与二次开发研究，请尊重原作者劳动成果。
                        </p>
                    </section>

                    <section>
                        <h3 className="mb-2 font-serif text-base font-bold tracking-[0.18em] text-wuxia-cyan">修改时间</h3>
                        <p>2026-05-26 / 2026-06-22</p>
                    </section>

                    <section>
                        <h3 className="mb-2 font-serif text-base font-bold tracking-[0.18em] text-wuxia-cyan">修改日志</h3>
                        <ul className="list-disc space-y-2 pl-5">
                            <li>2026-06-22：完善 NPC 数据安全写入链路，禁止危险的社交数组下标写入，防止记忆张冠李戴与空 NPC 档案。</li>
                            <li>2026-06-22：新增 registerNpc 与 updateNpcState 稳定身份命令，并在变量校准合并、执行器与社交数据规范化层增加兜底防护。</li>
                            <li>新增 NPC 记忆安全写入命令 pushNpcMemory，优先按 npcId 定位，降低记忆写错角色的概率。</li>
                            <li>补充提示词约束，要求 AI 给已有 NPC 追加个人记忆时避免猜测社交数组下标。</li>
                            <li>增加 Netlify 构建配置，支持 GitHub 推送后自动构建部署。</li>
                            <li>新增首页版权声明、修改日志弹窗与像素风动态背景。</li>
                        </ul>
                    </section>
                </div>

                <div className="relative z-10 flex flex-col gap-4 border-t border-wuxia-gold/20 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <label className="flex cursor-pointer select-none items-center gap-3 text-xs tracking-[0.12em] text-gray-300">
                        <input
                            type="checkbox"
                            checked={hideToday}
                            onChange={(event) => setHideToday(event.target.checked)}
                            className="h-4 w-4 accent-wuxia-gold"
                        />
                        今日不再提醒
                    </label>
                    <button
                        type="button"
                        onClick={close}
                        className="border border-wuxia-gold/55 bg-wuxia-gold px-5 py-2 font-serif text-sm font-bold tracking-[0.2em] text-black transition hover:bg-[#f3dc83]"
                    >
                        我知道了
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LandingNoticeModal;
