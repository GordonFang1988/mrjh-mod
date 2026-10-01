import type { AvgSceneHint, AvgSceneProfile } from '../../models/avg';
import { AVG_PORTRAIT_ARCHIVE_PROMPT } from './portraitVocabulary';

export const AVG_VOCABULARY_VERSION = 'wuxia-scene-v1';

export const AVG_SCENE_SPACES = [
    '江面', '湖面', '海面', '江岸', '湖岸', '海滩', '海边礁岸', '渡口', '码头', '水上栈桥',
    '岛上空地', '树林', '林间小径', '林间空地', '竹林', '竹林小径', '平原', '草原', '荒原',
    '农田', '丘陵', '湿地', '沼泽', '沙漠', '戈壁', '荒漠', '绿洲', '山脚', '山腰',
    '山顶', '山道', '山谷', '峡谷', '悬崖边', '山间平台', '山口', '溪边', '瀑布潭边',
    '河滩', '洞口', '洞内', '地下河岸', '雪原', '冰川', '官道', '乡间土路', '石桥',
    '吊桥', '关隘外', '城门外', '瓮城内', '城外墙脚', '城内街道', '城内广场', '市集', '巷道', '村道', '村口', '院落',
    '园林', '寺观外院', '废墟', '舟船甲板', '船舱', '客栈大堂', '客栈客房',
    '酒楼大厅', '酒楼雅间', '茶馆', '民居堂屋', '民居卧室', '厨房', '书房', '书院讲堂',
    '库房', '店铺内', '医馆内', '铁匠铺内', '寺庙大殿', '道观大殿', '禅房',
    '祠堂', '门派议事厅', '练功房', '藏书阁', '衙门公堂', '牢房', '宫殿大殿',
    '宫室', '地下石室', '墓室', '山门', '门派前庭', '门派广场', '门派回廊',
    '门派石阶', '后山小径', '露天练武场', '室内演武厅', '比武擂台', '练剑坪',
    '梅花桩场', '箭场', '掌门议事室', '会客厅', '祖师堂', '帮会堂口', '藏经阁',
    '兵器库', '铸剑房', '掌门居所', '弟子寝舍', '厢房', '客舍', '膳堂', '浴房',
    '马厩', '药房', '药圃', '炼药房', '闭关石室', '静修室', '静修洞穴', '斋堂',
    '钟楼内', '鼓楼内', '塔林', '思过崖', '戒律堂', '地牢', '密道', '石窟',
    '镖局大厅', '镖局货院', '山寨大厅', '山寨营地', '帮会院落', '水寨码头',
    '商会大厅', '破庙内', '破庙外', '驿站大厅', '驿站院落', '路边茶棚',
    '荒野营地', '山中茅屋内', '猎户小院', '未知'
] as const;

export const AVG_REGIONS = ['西北', '东北', '西南', '江南', '中部', '华北', '东南沿海', '岭南', '高原', '西域', '通用', '未知'] as const;
export const AVG_GEO = ['内陆', '海岛', '湖岛', '江岛', '沿海', '未知'] as const;
export const AVG_VEGETATION = ['针叶林', '阔叶林', '混交林', '竹林', '热带密林', '灌丛', '草甸', '稀疏植被', '无植被', '未知'] as const;
export const AVG_GROUND = ['草地', '裸土', '黄土', '沙地', '碎石', '裸岩', '积雪', '冰面', '泥地', '石板', '木板', '未知'] as const;
export const AVG_WATER = ['江河', '湖泊', '海洋', '溪流', '地下水', '无', '未知'] as const;
export const AVG_VIEWPOINT = ['地面', '岸边', '舟上', '高处俯望', '水边低视点', '未知'] as const;
export const AVG_INSTITUTION = ['佛寺', '道观', '世俗门派', '书院', '帮会', '山寨', '军营', '官署', '宅院', '商旅', '通用', '未知'] as const;
export const AVG_VENUE_FUNCTION = [
    '民居', '府邸', '衙门', '铁匠铺', '铸剑坊', '客栈', '酒楼', '茶馆', '医馆', '药铺',
    '商铺', '工坊', '仓库', '书院', '寺庙', '道观', '门派', '帮会', '山寨', '军营',
    '镖局', '驿站', '码头', '船舶', '宫廷', '祠堂', '墓葬', '市集', '商会', '武馆', '牢狱', '浴堂', '通用', '未知'
] as const;
export const AVG_QUALITY = ['简陋', '普通', '富丽', '奢华', '不适用', '未知'] as const;
export const AVG_CONDITION = ['完好', '陈旧', '破败', '毁坏', '不适用', '未知'] as const;
export const AVG_SCENE_SCALE = ['狭小', '适中', '开阔', '宏大', '未知'] as const;
export const AVG_FEATURES = ['桌椅', '柜台', '床榻', '书架', '佛像', '神龛', '石柱', '木梁', '水池', '瀑布', '远山', '海岸', '船只', '桥梁', '芦苇', '花木', '岩壁', '帐篷', '旗幡', '马栏', '山货摊', '海味摊', '戏台', '钟楼'] as const;

const has = (values: readonly string[], value: unknown): value is string => typeof value === 'string' && values.includes(value);
const read = (values: readonly string[], value: unknown): string | undefined => has(values, value) && value !== '未知' ? value : undefined;

/** Art manifests use the shared vocabulary; this does not validate a model's judgment. */
export const normalizeAvgProfile = (raw: unknown): AvgSceneProfile | null => {
    if (!raw || typeof raw !== 'object') return null;
    const item = raw as Record<string, unknown>;
    if (!has(AVG_SCENE_SPACES, item.空间) || item.空间 === '未知') return null;
    return {
        空间: item.空间,
        地域: read(AVG_REGIONS, item.地域),
        地理环境: read(AVG_GEO, item.地理环境),
        植被: read(AVG_VEGETATION, item.植被),
        地表: read(AVG_GROUND, item.地表),
        水域: read(AVG_WATER, item.水域),
        视点: read(AVG_VIEWPOINT, item.视点),
        场所体系: read(AVG_INSTITUTION, item.场所体系),
        场所功能: read(AVG_VENUE_FUNCTION, item.场所功能),
        装潢档次: read(AVG_QUALITY, item.装潢档次),
        完好程度: read(AVG_CONDITION, item.完好程度),
        空间规模: read(AVG_SCENE_SCALE, item.空间规模),
        显著要素: Array.isArray(item.显著要素)
            ? [...new Set(item.显著要素.filter(value => has(AVG_FEATURES, value)))].slice(0, 4) as string[]
            : undefined
    };
};

/** Read model fields without replacing or rejecting their classification values. */
export const readAvgSceneProfile = (raw: unknown): AvgSceneProfile | null => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const item = raw as Record<string, unknown>;
    const text = (value: unknown): string | undefined => typeof value === 'string' && value.trim() ? value.trim() : undefined;
    const space = text(item.空间);
    if (!space) return null;
    const profile: AvgSceneProfile = { 空间: space };
    const fields = ['地域', '地理环境', '植被', '地表', '水域', '视点', '场所体系', '场所功能', '装潢档次', '完好程度', '空间规模'] as const;
    for (const field of fields) {
        const value = text(item[field]);
        if (value) profile[field] = value;
    }
    if (Array.isArray(item.显著要素)) {
        profile.显著要素 = [...new Set(item.显著要素.map(text).filter((value): value is string => !!value))];
    }
    return profile;
};

export const normalizeAvgHints = (raw: unknown): AvgSceneHint[] => {
    if (!raw || typeof raw !== 'object') return [];
    const item = raw as Record<string, unknown>;
    if (!Array.isArray(item.场景)) return [];
    const refCounts = new Map<string, number>();
    const result: AvgSceneHint[] = [];
    for (const entry of item.场景.slice(0, 12)) {
        if (!entry || typeof entry !== 'object') continue;
        const scene = entry as Record<string, unknown>;
        const ref = typeof scene.ref === 'string' ? scene.ref.trim() : '';
        if (ref) refCounts.set(ref, (refCounts.get(ref) || 0) + 1);
        const profile = readAvgSceneProfile(scene.分类);
        if (!ref || !profile) continue;
        const location = scene.地点 && typeof scene.地点 === 'object'
            ? Object.fromEntries(Object.entries(scene.地点).filter(([, value]) => typeof value === 'string' && value.trim()).map(([key, value]) => [key, String(value).trim().slice(0, 100)]))
            : undefined;
        result.push({ ref, 地点: location, 分类: profile });
    }
    // Duplicate definitions cannot be addressed unambiguously; other refs remain usable.
    return result.filter(scene => refCounts.get(scene.ref) === 1);
};

/** Kept separate from user editable prompt slots. */
export const AVG_STORY_PROTOCOL_PROMPT = `【AVG演出协议 ${AVG_VOCABULARY_VERSION}】\n在<正文>里，每次实际视角空间开始时，独占一行输出<镜头 ref="s1"/>、<镜头 ref="s2"/>……，其后仍严格使用【旁白】、【角色名】、【判定】行。首次镜头也要标记；只在实际抵达新空间时切换，准备去、回忆、传音、提及地点均不切换。重复返回旧空间可复用同一ref。镜头标记不是正文、命令或记忆。\n在<正文>之后另输出一个<演出场景>JSON</演出场景>，格式：{"词表版本":"${AVG_VOCABULARY_VERSION}","场景":[{"ref":"s1","地点":{"大地点":"江南","中地点":"苏州","小地点":"悦来客栈","具体地点":"大堂"},"分类":{"空间":"客栈大堂","地域":"江南"}}]}。ref仅本回合有效；地点与正文实际到达的地点一致。词条只从下列固定词选，不确定的次要项省略，不可造词。\n空间：${AVG_SCENE_SPACES.join('、')}。\n地域：${AVG_REGIONS.join('、')}。地理环境：${AVG_GEO.join('、')}。植被：${AVG_VEGETATION.join('、')}。地表：${AVG_GROUND.join('、')}。水域：${AVG_WATER.join('、')}。视点：${AVG_VIEWPOINT.join('、')}。场所体系：${AVG_INSTITUTION.join('、')}。装潢档次：${AVG_QUALITY.join('、')}。完好程度：${AVG_CONDITION.join('、')}。显著要素最多4个：${AVG_FEATURES.join('、')}。\n空间看画面所处位置：江面/海面/舟船甲板不同；岛上树林使用树林+海岛，不能选无树空地；练武场分露天和室内；后山、禁地需说明实际空间；东北不必然积雪，繁华城镇中的客栈也不必然奢华。镜头末段应与本回合最终实际地点一致。`;

export const AVG_VENUE_PROTOCOL_PROMPT = `【场所用途补充】在<演出场景>每个分类里，场所用途已知时补“场所功能”，可见空间大小明确时补“空间规模”。场所功能只选：${AVG_VENUE_FUNCTION.join('、')}。空间规模只选：${AVG_SCENE_SCALE.join('、')}。尤其是院落、厨房、书房、库房、厢房等通用空间，应区分它属于谁、用来做什么。例如民居小院：{\"空间\":\"院落\",\"场所体系\":\"宅院\",\"场所功能\":\"民居\",\"空间规模\":\"狭小\"}；衙门院落：场所体系为官署、场所功能为衙门；铁匠铺后院：场所功能为铁匠铺。破落住家仍是民居，以装潢档次“简陋”和完好程度“破败”表示可见状态。场所名字本身不能替代空间；不知道用途或规模时省略，不要编造。`;

export const AVG_FULL_PROTOCOL_PROMPT = `${AVG_STORY_PROTOCOL_PROMPT}\n${AVG_VENUE_PROTOCOL_PROMPT}\n${AVG_PORTRAIT_ARCHIVE_PROMPT}`;
