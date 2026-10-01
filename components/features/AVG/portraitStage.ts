import type { GameLog } from '../../../types';

export type AvgPortraitStage = { sender: string; mode: 'active' | 'receded' } | null;

const isNarration = (sender: string): boolean => sender === '旁白'
    || /^(?:【(?:NSFW)?判定】|(?:NSFW)?判定|先机|瞄准|接战|防御|伤害|态势|反馈|消耗|洞察)$/.test(sender);

/** Narration carries only the most recent speaker in the current scene segment. */
export const portraitStageForStep = (steps: GameLog[], index: number, multiScene: boolean): AvgPortraitStage => {
    const step = steps[index];
    if (!step) return null;
    const sender = step.sender.trim();
    if (!isNarration(sender)) return sender ? { sender, mode: 'active' } : null;
    for (let previous = index - 1; previous >= 0; previous -= 1) {
        const candidate = steps[previous];
        if (multiScene && candidate.avgSceneRef !== step.avgSceneRef) break;
        const previousSender = candidate.sender.trim();
        if (previousSender && !isNarration(previousSender)) {
            return { sender: previousSender, mode: 'receded' };
        }
    }
    return null;
};
