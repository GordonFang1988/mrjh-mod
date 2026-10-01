import type { AvgPortraitProfile, AvgVisualAge } from '../../models/avg';

export const AVG_PORTRAIT_AGE: Record<AvgVisualAge, string> = {
    child: '幼童', teen: '少年', young: '青年', middle: '中年', elder: '老年'
};
export const AVG_PORTRAIT_ROLES = [
    '门派弟子', '门派长辈', '门派掌门', '江湖侠客', '镖师', '武馆教习', '官差', '军士',
    '匪徒', '商贾', '店家', '医者', '书生', '工匠', '农人', '仆役', '贵人', '艺人', '乞者'
] as const;
export const AVG_PORTRAIT_ARCHETYPES = ['僧人', '道士', '乞丐'] as const;
export const AVG_PORTRAIT_OUTFITS = [
    '江湖劲装', '门派弟子服', '武林袍服', '僧衣', '道袍', '书生长衫', '官服',
    '甲胄', '商旅衣装', '平民布衣', '富贵华服', '乞丐破衣', '通用江湖装'
] as const;
export const AVG_PORTRAIT_BUILDS = ['纤细', '匀称', '健壮', '魁梧', '丰腴'] as const;
export const AVG_PORTRAIT_HEIGHTS = ['娇小', '中等', '高挑'] as const;
export const AVG_PORTRAIT_HAIRSTYLES = ['披发', '束发', '盘发', '短发'] as const;
export const AVG_PORTRAIT_TAILORING = ['宽松', '合身', '修身'] as const;
export const AVG_PORTRAIT_UPPER_SHAPES = ['纤薄', '适中', '丰满'] as const;
export const AVG_PORTRAIT_WAIST_HIP_SHAPES = ['平直', '自然', '曲线明显'] as const;
export const AVG_PORTRAIT_SKIN_LEVELS = ['保守', '适中', '较高'] as const;
export const AVG_PORTRAIT_HAIR = ['黑发', '白发', '灰发', '棕发', '赤发'] as const;
export const AVG_PORTRAIT_FEATURES = [
    '佩剑', '佩刀', '斗笠', '面纱', '胡须', '疤痕', '眼罩', '拐杖', '长发', '短发'
] as const;

export const archetypeFromOutfit = (outfit?: string): string | undefined => {
    if (outfit === '僧衣') return '僧人';
    if (outfit === '道袍') return '道士';
    if (outfit === '乞丐破衣') return '乞丐';
    return undefined;
};

const fixed = (options: readonly string[], value: unknown): string | undefined =>
    typeof value === 'string' && options.includes(value.trim()) ? value.trim() : undefined;

export const normalizeAvgPortraitProfile = (raw: unknown): AvgPortraitProfile | undefined => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
    const source = raw as Record<string, unknown>;
    const ageText = typeof source.视觉年龄 === 'string' ? source.视觉年龄.trim() : '';
    const ageEntry = Object.entries(AVG_PORTRAIT_AGE).find(([code, label]) => ageText === code || ageText === label);
    const 视觉年龄 = ageEntry?.[0] as AvgVisualAge | undefined;
    const 身份类别 = fixed(AVG_PORTRAIT_ROLES, source.身份类别);
    const 服饰类别 = fixed(AVG_PORTRAIT_OUTFITS, source.服饰类别);
    // A recognizable outfit is stronger evidence than a conflicting model label.
    const 江湖形象 = archetypeFromOutfit(服饰类别) || fixed(AVG_PORTRAIT_ARCHETYPES, source.江湖形象);
    const 体态 = fixed(AVG_PORTRAIT_BUILDS, source.体态);
    const 身高 = fixed(AVG_PORTRAIT_HEIGHTS, source.身高);
    const 发型 = fixed(AVG_PORTRAIT_HAIRSTYLES, source.发型);
    const 衣装剪裁 = fixed(AVG_PORTRAIT_TAILORING, source.衣装剪裁);
    const 上身轮廓 = fixed(AVG_PORTRAIT_UPPER_SHAPES, source.上身轮廓);
    const 腰臀轮廓 = fixed(AVG_PORTRAIT_WAIST_HIP_SHAPES, source.腰臀轮廓);
    const 露肤程度 = fixed(AVG_PORTRAIT_SKIN_LEVELS, source.露肤程度);
    const 发色 = fixed(AVG_PORTRAIT_HAIR, source.发色);
    const 显著特征 = Array.isArray(source.显著特征)
        ? [...new Set(source.显著特征.map(item => typeof item === 'string' ? item.trim() : '')
            .filter((item): item is string => !!item && AVG_PORTRAIT_FEATURES.includes(item as any)))].slice(0, 4)
        : [];
    if (!视觉年龄 && !身份类别 && !江湖形象 && !服饰类别 && !体态 && !身高 && !发型
        && !衣装剪裁 && !上身轮廓 && !腰臀轮廓 && !露肤程度 && !发色 && 显著特征.length === 0) return undefined;
    return {
        ...(视觉年龄 ? { 视觉年龄 } : {}),
        ...(身份类别 ? { 身份类别 } : {}),
        ...(江湖形象 ? { 江湖形象 } : {}),
        ...(服饰类别 ? { 服饰类别 } : {}),
        ...(体态 ? { 体态 } : {}),
        ...(身高 ? { 身高 } : {}),
        ...(发型 ? { 发型 } : {}),
        ...(衣装剪裁 ? { 衣装剪裁 } : {}),
        ...(上身轮廓 ? { 上身轮廓 } : {}),
        ...(腰臀轮廓 ? { 腰臀轮廓 } : {}),
        ...(露肤程度 ? { 露肤程度 } : {}),
        ...(发色 ? { 发色 } : {}),
        ...(显著特征.length ? { 显著特征 } : {})
    };
};

export const AVG_PORTRAIT_ARCHIVE_PROMPT = `【AVG人物预制立绘分类】建档长期使用的 NPC 时，在原有社交 NPC 对象内补充 AVG立绘特征；此字段描述常态可见的形象，用于本地预制立绘匹配，原有身份、外貌描写、身材描写、衣着风格仍按原规则写供剧情与生图使用。示例："AVG立绘特征":{"视觉年龄":"young","身份类别":"门派弟子","江湖形象":"僧人","服饰类别":"僧衣","体态":"匀称","身高":"中等","发型":"束发","衣装剪裁":"合身","发色":"黑发"}。视觉年龄固定用 child/teen/young/middle/elder（幼童/少年/青年/中年/老年），以看起来的年龄为准；通常可由实际年龄推断，明确驻颜/易容时按可见外观。身份类别只选：${AVG_PORTRAIT_ROLES.join('、')}。江湖形象只选：${AVG_PORTRAIT_ARCHETYPES.join('、')}；和尚/尼姑归僧人，明显的道门装束归道士，丐帮风貌或乞丐装束归乞丐；没有这些鲜明形象时省略。此字段不记录少林、武当等具体门派或当前门派归属；加入或退出门派本身不改变外观分类，常态装束确实改变时才更新。服饰类别只选：${AVG_PORTRAIT_OUTFITS.join('、')}。体态只选：${AVG_PORTRAIT_BUILDS.join('、')}。身高只选：${AVG_PORTRAIT_HEIGHTS.join('、')}。发型只选：${AVG_PORTRAIT_HAIRSTYLES.join('、')}。衣装剪裁只选：${AVG_PORTRAIT_TAILORING.join('、')}。发色只选：${AVG_PORTRAIT_HAIR.join('、')}。适用且有明确常态外观信息时，可填写上身轮廓（${AVG_PORTRAIT_UPPER_SHAPES.join('、')}）、腰臀轮廓（${AVG_PORTRAIT_WAIST_HIP_SHAPES.join('、')}）、露肤程度（${AVG_PORTRAIT_SKIN_LEVELS.join('、')}）。显著特征最多四项，只选：${AVG_PORTRAIT_FEATURES.join('、')}。不确定的次要字段省略，不造词；短时换衣、负伤、雨淋等临时状态不覆盖常态分类。`;
