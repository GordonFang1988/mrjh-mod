import React from 'react';

type Direction = 'left' | 'right';
type SpriteSource = HTMLImageElement | HTMLCanvasElement;
type VirtualSize = { width: number; height: number; mobile: boolean };
type CharacterSourceMap = Record<string, SpriteSource>;
type PineSourceMap = Record<string, SpriteSource>;

type CharacterConfig = {
    id: string;
    src: string;
    x: number;
    y: number;
    scale: number;
    facing: Direction;
    sourceFacing?: Direction;
    columns: number;
    rows: number;
    idleRow: number;
    attackRow: number;
    idleFrames: number[];
    attackFrames: number[];
    attackEveryMs: number;
    attackDurationMs: number;
    phaseMs: number;
    frameWidth?: number;
    frameHeight?: number;
    palette: {
        robe: string;
        trim: string;
        hair: string;
        sash: string;
        skin: string;
    };
    flash: {
        fromX: number;
        fromY: number;
        toX: number;
        toY: number;
    };
};

type PineConfig = {
    id: string;
    src: string;
    x: number;
    y: number;
    scale: number;
    columns: number;
    frameCount: number;
    frameMs: number;
    phaseMs: number;
    sway: number;
    layer: 'mid' | 'front';
    hideOnMobile?: boolean;
};

type Resources = {
    characters: CharacterSourceMap;
    pines: PineSourceMap;
};

const DESKTOP_SIZE = { width: 640, height: 360 };
const MOBILE_SIZE = { width: 480, height: 270 };
const BG_PATH = '/assets/home/huashan-bg.webp';

const CHARACTERS: CharacterConfig[] = [
    {
        id: 'white',
        src: '/assets/home/swordsman-white.webp',
        x: 190,
        y: 258,
        scale: 0.125,
        facing: 'right',
        columns: 4,
        rows: 2,
        idleRow: 0,
        attackRow: 1,
        idleFrames: [0, 1, 2, 3],
        attackFrames: [0, 1, 2, 3],
        attackEveryMs: 4300,
        attackDurationMs: 760,
        phaseMs: 0,
        palette: { robe: '#e7edf4', trim: '#94b7d7', hair: '#101016', sash: '#78b7c8', skin: '#dfb391' },
        flash: { fromX: 211, fromY: 226, toX: 265, toY: 211 }
    },
    {
        id: 'black',
        src: '/assets/home/swordsman-black.webp',
        x: 252,
        y: 250,
        scale: 0.125,
        facing: 'left',
        columns: 4,
        rows: 2,
        idleRow: 0,
        attackRow: 1,
        idleFrames: [0, 1, 2, 3],
        attackFrames: [0, 1, 2, 3],
        attackEveryMs: 4350,
        attackDurationMs: 760,
        phaseMs: 120,
        palette: { robe: '#151820', trim: '#8b7a63', hair: '#0a0b0d', sash: '#4b4158', skin: '#b98963' },
        flash: { fromX: 255, fromY: 223, toX: 204, toY: 209 }
    },
    {
        id: 'master',
        src: '/assets/home/swordsman-master.webp',
        x: 408,
        y: 210,
        scale: 0.108,
        facing: 'left',
        columns: 4,
        rows: 2,
        idleRow: 0,
        attackRow: 1,
        idleFrames: [0, 1, 2, 3],
        attackFrames: [0, 1, 2, 3],
        attackEveryMs: 7600,
        attackDurationMs: 880,
        phaseMs: 3200,
        palette: { robe: '#ddd0b4', trim: '#d4af63', hair: '#d6d1c6', sash: '#4c4030', skin: '#d3a783' },
        flash: { fromX: 408, fromY: 190, toX: 450, toY: 166 }
    },
    {
        id: 'red',
        src: '/assets/home/swordsman-red.webp',
        x: 474,
        y: 239,
        scale: 0.12,
        facing: 'right',
        columns: 4,
        rows: 2,
        idleRow: 0,
        attackRow: 1,
        idleFrames: [0, 1, 2, 3],
        attackFrames: [0, 1, 2, 3],
        attackEveryMs: 5100,
        attackDurationMs: 770,
        phaseMs: 1700,
        palette: { robe: '#8e262b', trim: '#d09a46', hair: '#171114', sash: '#291d1d', skin: '#d99a7d' },
        flash: { fromX: 493, fromY: 216, toX: 545, toY: 201 }
    },
    {
        id: 'young',
        src: '/assets/home/swordsman-young.webp',
        x: 536,
        y: 226,
        scale: 0.118,
        facing: 'left',
        columns: 4,
        rows: 2,
        idleRow: 0,
        attackRow: 1,
        idleFrames: [0, 1, 2, 3],
        attackFrames: [0, 1, 2, 3],
        attackEveryMs: 5100,
        attackDurationMs: 770,
        phaseMs: 1840,
        palette: { robe: '#2e6770', trim: '#90dfd5', hair: '#111924', sash: '#d7e2dc', skin: '#dca889' },
        flash: { fromX: 530, fromY: 207, toX: 480, toY: 196 }
    }
];

const PINES: PineConfig[] = [
    {
        id: 'pine-1',
        src: '/assets/home/pine-1.webp',
        x: 138,
        y: 338,
        scale: 0.18,
        columns: 2,
        frameCount: 4,
        frameMs: 520,
        phaseMs: 0,
        sway: 0.012,
        layer: 'front'
    },
    {
        id: 'pine-2',
        src: '/assets/home/pine-2.webp',
        x: 552,
        y: 342,
        scale: 0.18,
        columns: 2,
        frameCount: 4,
        frameMs: 560,
        phaseMs: 260,
        sway: 0.01,
        layer: 'front',
        hideOnMobile: true
    },
    {
        id: 'pine-3',
        src: '/assets/home/pine-3.webp',
        x: 532,
        y: 164,
        scale: 0.105,
        columns: 2,
        frameCount: 4,
        frameMs: 640,
        phaseMs: 420,
        sway: 0.008,
        layer: 'mid'
    }
];

const MIST = Array.from({ length: 26 }, (_, index) => ({
    x: (index * 87 + 31) % 760,
    y: 92 + ((index * 37) % 215),
    width: 34 + (index % 6) * 12,
    height: 6 + (index % 4) * 2,
    speed: 0.007 + (index % 5) * 0.002,
    alpha: 0.035 + (index % 5) * 0.013
}));

const LEAVES = Array.from({ length: 12 }, (_, index) => ({
    x: (index * 61 + 310) % 690,
    y: 126 + ((index * 31) % 170),
    speed: 0.015 + (index % 4) * 0.004,
    wobble: index * 0.73,
    color: index % 2 ? '#b7793f' : '#d5a64a'
}));

const getVirtualSize = (): VirtualSize => {
    const mobile = typeof window !== 'undefined' && window.innerWidth < 760;
    return mobile
        ? { ...MOBILE_SIZE, mobile: true }
        : { ...DESKTOP_SIZE, mobile: false };
};

const getReducedMotion = () => (
    typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
) || false;

const rect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    color: string
) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
};

const line = (
    ctx: CanvasRenderingContext2D,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    color: string,
    size = 1
) => {
    const steps = Math.max(Math.abs(toX - fromX), Math.abs(toY - fromY), 1);
    ctx.fillStyle = color;
    for (let i = 0; i <= steps; i += size) {
        const progress = i / steps;
        ctx.fillRect(
            Math.round(fromX + (toX - fromX) * progress),
            Math.round(fromY + (toY - fromY) * progress),
            size,
            size
        );
    }
};

const withAlpha = (ctx: CanvasRenderingContext2D, alpha: number, draw: () => void) => {
    const previousAlpha = ctx.globalAlpha;
    ctx.globalAlpha = previousAlpha * alpha;
    draw();
    ctx.globalAlpha = previousAlpha;
};

const createCanvas = (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
};

const sourceWidth = (source: SpriteSource) => (
    source instanceof HTMLImageElement ? source.naturalWidth : source.width
);

const sourceHeight = (source: SpriteSource) => (
    source instanceof HTMLImageElement ? source.naturalHeight : source.height
);

const loadImage = (src: string) => new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
});

const drawFallbackCharacterFrame = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    palette: CharacterConfig['palette'],
    frame: number,
    attacking: boolean
) => {
    const bob = attacking ? 0 : frame % 2;
    const lean = attacking ? frame * 3 - 4 : 0;
    const swordReach = attacking ? 45 + frame * 8 : 30;
    const swordY = attacking ? 25 - frame * 2 : 32;

    rect(ctx, x + 27 + lean, y + 6 + bob, 19, 8, palette.hair);
    rect(ctx, x + 30 + lean, y + 13 + bob, 16, 16, palette.skin);
    rect(ctx, x + 23 + lean, y + 29 + bob, 30, 38, palette.robe);
    rect(ctx, x + 25 + lean, y + 35 + bob, 28, 5, palette.trim);
    rect(ctx, x + 30 + lean, y + 51 + bob, 22, 6, palette.sash);
    rect(ctx, x + 14 + lean, y + 34 + bob, 13, 32, palette.robe);
    rect(ctx, x + 50 + lean, y + 34 + bob, 12, 30, palette.robe);
    rect(ctx, x + 21 + lean, y + 67, 13, 20, '#151821');
    rect(ctx, x + 42 + lean, y + 67, 13, 20, '#151821');
    rect(ctx, x + 19 + lean, y + 87, 18, 5, '#07090d');
    rect(ctx, x + 40 + lean, y + 87, 18, 5, '#07090d');
    rect(ctx, x + 19 + lean, y + 20 + bob, 8, 26, palette.hair);
    rect(ctx, x + 43 + lean, y + 18 + bob, 8, 22, palette.hair);
    line(ctx, x + 48 + lean, y + 42 + bob, x + swordReach + lean, y + swordY + bob, '#e6eef5', attacking ? 2 : 1);
    line(ctx, x + 48 + lean, y + 43 + bob, x + swordReach + lean, y + swordY + 2 + bob, 'rgba(255,244,190,0.7)', 1);

    if (attacking && frame > 1) {
        line(ctx, x + 46 + lean, y + 43, x + swordReach + lean + 10, y + swordY + 8, 'rgba(125,238,255,0.45)', 1);
    }
};

const createFallbackCharacterSheet = (character: CharacterConfig) => {
    const frameWidth = 72;
    const frameHeight = 96;
    const canvas = createCanvas(frameWidth * character.columns, frameHeight * character.rows);
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    ctx.imageSmoothingEnabled = false;

    for (let row = 0; row < character.rows; row += 1) {
        for (let frame = 0; frame < character.columns; frame += 1) {
            drawFallbackCharacterFrame(
                ctx,
                frame * frameWidth,
                row * frameHeight,
                character.palette,
                frame,
                row === character.attackRow
            );
        }
    }

    return canvas;
};

const createFallbackPineSheet = (pine: PineConfig) => {
    const frameWidth = 96;
    const frameHeight = 112;
    const rows = Math.ceil(pine.frameCount / pine.columns);
    const canvas = createCanvas(frameWidth * pine.columns, frameHeight * rows);
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    ctx.imageSmoothingEnabled = false;

    for (let frame = 0; frame < pine.frameCount; frame += 1) {
        const col = frame % pine.columns;
        const row = Math.floor(frame / pine.columns);
        const ox = col * frameWidth + Math.round(Math.sin(frame * 0.8) * 2);
        const oy = row * frameHeight;
        rect(ctx, ox + 42, oy + 38, 18, 65, '#493626');
        rect(ctx, ox + 34, oy + 59, 11, 42, '#2d241d');
        rect(ctx, ox + 51, oy + 45, 12, 51, '#66513a');
        rect(ctx, ox + 18, oy + 24, 54, 14, '#183c32');
        rect(ctx, ox + 12, oy + 34, 62, 14, '#215044');
        rect(ctx, ox + 22, oy + 47, 58, 13, '#183c32');
        rect(ctx, ox + 31, oy + 62, 48, 12, '#2c5c43');
        rect(ctx, ox + 21, oy + 30, 20, 4, '#779d62');
        rect(ctx, ox + 43, oy + 50, 18, 4, '#779d62');
        rect(ctx, ox + 26, oy + 98, 50, 8, '#4f5653');
        rect(ctx, ox + 18, oy + 103, 66, 7, '#303941');
    }

    return canvas;
};

const createFallbackResources = (): Resources => ({
    characters: Object.fromEntries(
        CHARACTERS.map((character) => [character.id, createFallbackCharacterSheet(character)])
    ),
    pines: Object.fromEntries(
        PINES.map((pine) => [pine.id, createFallbackPineSheet(pine)])
    )
});

const loadResources = async (fallback: Resources): Promise<Resources> => {
    const characters: CharacterSourceMap = { ...fallback.characters };
    const pines: PineSourceMap = { ...fallback.pines };

    await Promise.all([
        ...CHARACTERS.map(async (character) => {
            const image = await loadImage(character.src);
            if (image) characters[character.id] = image;
        }),
        ...PINES.map(async (pine) => {
            const image = await loadImage(pine.src);
            if (image) pines[pine.id] = image;
        })
    ]);

    return { characters, pines };
};

const drawClouds = (
    ctx: CanvasRenderingContext2D,
    size: VirtualSize,
    time: number,
    reducedMotion: boolean
) => {
    const rows = [
        { y: size.height * 0.30, h: 8, alpha: 0.13, drift: 0.011, tint: '#fff0db' },
        { y: size.height * 0.46, h: 11, alpha: 0.16, drift: 0.008, tint: '#e7edf2' },
        { y: size.height * 0.67, h: 15, alpha: 0.13, drift: 0.006, tint: '#cdd8e1' },
    ];
    const count = size.mobile ? 5 : 8;

    rows.forEach((row, rowIndex) => {
        const offset = reducedMotion ? 0 : (time * row.drift * (rowIndex + 1)) % 150;
        withAlpha(ctx, row.alpha, () => {
            for (let i = -2; i < count + 2; i += 1) {
                const x = i * 104 - offset + rowIndex * 39;
                rect(ctx, x, row.y, 68, row.h, row.tint);
                rect(ctx, x + 22, row.y - 6, 82, row.h + 3, '#eff4f5');
                rect(ctx, x + 64, row.y + 5, 72, row.h - 2, '#bac7d2');
            }
        });
    });
};

const drawMistAndLeaves = (
    ctx: CanvasRenderingContext2D,
    size: VirtualSize,
    time: number,
    reducedMotion: boolean
) => {
    const mistCount = size.mobile ? 12 : MIST.length;
    for (let i = 0; i < mistCount; i += 1) {
        const mist = MIST[i];
        const x = reducedMotion ? mist.x % size.width : (mist.x + time * mist.speed) % (size.width + 110) - 55;
        const y = (mist.y / DESKTOP_SIZE.height) * size.height;
        withAlpha(ctx, mist.alpha, () => {
            rect(ctx, x, y, mist.width, mist.height, '#f4efe8');
            rect(ctx, x + 14, y + 7, mist.width * 0.72, Math.max(2, mist.height - 3), '#bfcdd6');
        });
    }

    const leafCount = size.mobile ? 4 : LEAVES.length;
    for (let i = 0; i < leafCount; i += 1) {
        const leaf = LEAVES[i];
        const drift = reducedMotion ? 0 : time * leaf.speed;
        const x = (leaf.x + drift) % (size.width + 20) - 10;
        const y = (leaf.y / DESKTOP_SIZE.height) * size.height + Math.sin(time * 0.004 + leaf.wobble) * 5;
        withAlpha(ctx, 0.23, () => {
            rect(ctx, x, y, 3, 2, leaf.color);
        });
    }
};

const drawLight = (
    ctx: CanvasRenderingContext2D,
    size: VirtualSize,
    time: number,
    reducedMotion: boolean
) => {
    const pulse = reducedMotion ? 0 : Math.sin(time * 0.00075) * 0.018;
    const gradient = ctx.createRadialGradient(
        size.width * 0.16,
        size.height * 0.16,
        size.width * 0.02,
        size.width * 0.22,
        size.height * 0.20,
        size.width * 0.72
    );
    gradient.addColorStop(0, `rgba(255,192,102,${0.11 + pulse})`);
    gradient.addColorStop(0.46, `rgba(236,126,76,${0.055 + pulse * 0.5})`);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size.width, size.height);
};

const drawPine = (
    ctx: CanvasRenderingContext2D,
    pine: PineConfig,
    source: SpriteSource,
    size: VirtualSize,
    time: number,
    reducedMotion: boolean
) => {
    if (size.mobile && (pine.hideOnMobile || pine.layer === 'front')) return;

    const viewportScale = size.width / DESKTOP_SIZE.width;
    const frameWidth = Math.floor(sourceWidth(source) / pine.columns);
    const rows = Math.ceil(pine.frameCount / pine.columns);
    const frameHeight = Math.floor(sourceHeight(source) / rows);
    const frame = reducedMotion ? 0 : Math.floor((time + pine.phaseMs) / pine.frameMs) % pine.frameCount;
    const sx = (frame % pine.columns) * frameWidth;
    const sy = Math.floor(frame / pine.columns) * frameHeight;
    const drawWidth = frameWidth * pine.scale * viewportScale;
    const drawHeight = frameHeight * pine.scale * viewportScale;
    const sway = reducedMotion ? 0 : Math.sin(time * 0.0012 + pine.phaseMs) * pine.sway;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(pine.x * viewportScale, pine.y * viewportScale);
    ctx.rotate(sway);
    withAlpha(ctx, pine.layer === 'front' ? 0.84 : 0.64, () => {
        ctx.drawImage(source, sx, sy, frameWidth, frameHeight, -drawWidth * 0.5, -drawHeight, drawWidth, drawHeight);
    });
    ctx.restore();
};

const getCharacterFrame = (
    character: CharacterConfig,
    time: number,
    reducedMotion: boolean
) => {
    if (reducedMotion) {
        return { attacking: false, frame: character.idleFrames[0], row: character.idleRow, local: 0 };
    }

    const local = (time + character.phaseMs) % character.attackEveryMs;
    const attacking = local < character.attackDurationMs;
    const frames = attacking ? character.attackFrames : character.idleFrames;
    const frameMs = attacking ? Math.max(95, character.attackDurationMs / frames.length) : 170;
    return {
        attacking,
        frame: frames[Math.floor(local / frameMs) % frames.length],
        row: attacking ? character.attackRow : character.idleRow,
        local
    };
};

const drawCharacter = (
    ctx: CanvasRenderingContext2D,
    character: CharacterConfig,
    source: SpriteSource,
    size: VirtualSize,
    time: number,
    reducedMotion: boolean
) => {
    const viewportScale = size.width / DESKTOP_SIZE.width;
    const { frame, row, attacking } = getCharacterFrame(character, time, reducedMotion);
    const frameWidth = character.frameWidth ?? Math.floor(sourceWidth(source) / character.columns);
    const frameHeight = character.frameHeight ?? Math.floor(sourceHeight(source) / character.rows);
    const sx = frame * frameWidth;
    const sy = row * frameHeight;
    const mobileCharacterScale = size.mobile ? 0.56 : 1;
    const drawWidth = frameWidth * character.scale * viewportScale * mobileCharacterScale;
    const drawHeight = frameHeight * character.scale * viewportScale * mobileCharacterScale;
    const bob = reducedMotion ? 0 : Math.sin(time * 0.004 + character.phaseMs) * (attacking ? 0.6 : 1.4) * viewportScale;
    const x = character.x * viewportScale - drawWidth * 0.5;
    const y = character.y * viewportScale - drawHeight + bob;
    const sourceFacing = character.sourceFacing ?? 'left';
    const shouldFlip = sourceFacing !== character.facing;

    withAlpha(ctx, 0.38, () => {
        ctx.fillStyle = '#030507';
        ctx.beginPath();
        ctx.ellipse(character.x * viewportScale, character.y * viewportScale - 2, drawWidth * 0.34, drawHeight * 0.055, 0, 0, Math.PI * 2);
        ctx.fill();
    });

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    withAlpha(ctx, size.mobile ? 0.68 : 1, () => {
        if (shouldFlip) {
            ctx.translate(x + drawWidth, y);
            ctx.scale(-1, 1);
            ctx.drawImage(source, sx, sy, frameWidth, frameHeight, 0, 0, drawWidth, drawHeight);
        } else {
            ctx.drawImage(source, sx, sy, frameWidth, frameHeight, x, y, drawWidth, drawHeight);
        }
    });
    ctx.restore();
};

const drawSwordFlashes = (
    ctx: CanvasRenderingContext2D,
    size: VirtualSize,
    time: number,
    reducedMotion: boolean
) => {
    if (reducedMotion) return;
    const viewportScale = size.width / DESKTOP_SIZE.width;

    CHARACTERS.forEach((character) => {
        const { local } = getCharacterFrame(character, time, false);
        if (local > 150) return;
        const alpha = 1 - local / 150;
        withAlpha(ctx, alpha * 0.58, () => {
            line(
                ctx,
                character.flash.fromX * viewportScale,
                character.flash.fromY * viewportScale,
                character.flash.toX * viewportScale,
                character.flash.toY * viewportScale,
                '#fff1a7',
                2
            );
            line(
                ctx,
                (character.flash.fromX - 7) * viewportScale,
                (character.flash.fromY + 7) * viewportScale,
                character.flash.toX * viewportScale,
                (character.flash.toY + 5) * viewportScale,
                '#9eefff',
                1
            );
        });
    });
};

const drawCanvasOverlay = (ctx: CanvasRenderingContext2D, size: VirtualSize) => {
    const gradient = ctx.createRadialGradient(
        size.width * 0.52,
        size.height * 0.48,
        size.width * 0.08,
        size.width * 0.52,
        size.height * 0.48,
        size.width * 0.76
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0.00)');
    gradient.addColorStop(0.62, 'rgba(0,0,0,0.08)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.30)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size.width, size.height);

    withAlpha(ctx, 0.055, () => {
        for (let y = 0; y < size.height; y += 4) {
            rect(ctx, 0, y, size.width, 1, '#000000');
        }
    });
};

const renderFrame = (
    ctx: CanvasRenderingContext2D,
    size: VirtualSize,
    resources: Resources,
    time: number,
    reducedMotion: boolean
) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);
    ctx.imageSmoothingEnabled = false;

    drawLight(ctx, size, time, reducedMotion);
    drawClouds(ctx, size, time, reducedMotion);
    drawMistAndLeaves(ctx, size, time, reducedMotion);
    PINES.filter((pine) => pine.layer === 'mid').forEach((pine) => {
        drawPine(ctx, pine, resources.pines[pine.id], size, time, reducedMotion);
    });
    CHARACTERS.forEach((character) => {
        drawCharacter(ctx, character, resources.characters[character.id], size, time, reducedMotion);
    });
    drawSwordFlashes(ctx, size, time, reducedMotion);
    PINES.filter((pine) => pine.layer === 'front').forEach((pine) => {
        drawPine(ctx, pine, resources.pines[pine.id], size, time, reducedMotion);
    });
    drawCanvasOverlay(ctx, size);
};

const HomePixelBackground: React.FC = () => {
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const [resources, setResources] = React.useState<Resources | null>(null);

    React.useEffect(() => {
        let cancelled = false;
        const fallback = createFallbackResources();
        setResources(fallback);

        void loadResources(fallback).then((loaded) => {
            if (!cancelled) setResources(loaded);
        });

        return () => {
            cancelled = true;
        };
    }, []);

    React.useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !resources) return;
        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return;

        let size = getVirtualSize();
        let reducedMotion = getReducedMotion();
        let animationFrame = 0;
        let lastFrame = 0;
        let pausedByVisibility = document.hidden;
        const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');

        const stopAnimation = () => {
            if (animationFrame) {
                window.cancelAnimationFrame(animationFrame);
                animationFrame = 0;
            }
        };

        const applyCanvasSize = () => {
            size = getVirtualSize();
            canvas.width = size.width;
            canvas.height = size.height;
            renderFrame(ctx, size, resources, performance.now(), reducedMotion);
        };

        const animate = (time: number) => {
            const targetFrameMs = reducedMotion ? 500 : size.mobile ? 50 : 33;
            if (!pausedByVisibility && time - lastFrame >= targetFrameMs) {
                renderFrame(ctx, size, resources, time, reducedMotion);
                lastFrame = time;
            }
            if (!pausedByVisibility) {
                animationFrame = window.requestAnimationFrame(animate);
            }
        };

        const startAnimation = () => {
            stopAnimation();
            if (!pausedByVisibility) {
                animationFrame = window.requestAnimationFrame(animate);
            }
        };

        const handleResize = () => {
            applyCanvasSize();
            lastFrame = 0;
            startAnimation();
        };

        const handleVisibilityChange = () => {
            pausedByVisibility = document.hidden;
            if (pausedByVisibility) {
                stopAnimation();
                return;
            }
            lastFrame = 0;
            startAnimation();
        };

        const handleMotionChange = (event: MediaQueryListEvent) => {
            reducedMotion = event.matches;
            lastFrame = 0;
            renderFrame(ctx, size, resources, performance.now(), reducedMotion);
            startAnimation();
        };

        applyCanvasSize();
        startAnimation();
        window.addEventListener('resize', handleResize);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        motionQuery?.addEventListener?.('change', handleMotionChange);

        return () => {
            stopAnimation();
            window.removeEventListener('resize', handleResize);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            motionQuery?.removeEventListener?.('change', handleMotionChange);
        };
    }, [resources]);

    return (
        <>
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center"
                style={{
                    backgroundImage: `url('${BG_PATH}')`
                }}
            />
            <canvas
                ref={canvasRef}
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-[1] h-full w-full opacity-95"
                style={{
                    imageRendering: 'pixelated'
                }}
            />
        </>
    );
};

export default HomePixelBackground;
