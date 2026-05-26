import React from 'react';

type Facing = 1 | -1;
type VirtualSize = { width: number; height: number; mobile: boolean };
type SpriteSource = HTMLImageElement | HTMLCanvasElement;

type Fighter = {
    x: number;
    y: number;
    row: number;
    facing: Facing;
    scale: number;
    phase: number;
    cycleMs: number;
};

type Flash = {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
};

const DESKTOP_SIZE = { width: 640, height: 360 };
const MOBILE_SIZE = { width: 480, height: 270 };
const SPRITE_PATH = '/assets/home/swordsmen-sprites.webp';
const BG_PATH = '/assets/home/huashan-bg.webp';
const FRAME_WIDTH = 48;
const FRAME_HEIGHT = 64;
const IDLE_FRAMES = 4;
const ATTACK_FRAMES = 6;
const TOTAL_FRAMES = IDLE_FRAMES + ATTACK_FRAMES;
const SPRITE_ROWS = 4;

const FIGHTERS: Fighter[] = [
    { x: 292, y: 233, row: 0, facing: 1, scale: 0.86, phase: 0, cycleMs: 5200 },
    { x: 356, y: 220, row: 1, facing: -1, scale: 0.9, phase: 1300, cycleMs: 5700 },
    { x: 454, y: 230, row: 2, facing: 1, scale: 0.86, phase: 2800, cycleMs: 6400 },
    { x: 510, y: 216, row: 3, facing: -1, scale: 0.88, phase: 4200, cycleMs: 6100 },
];

const FLASHES: Flash[] = [
    { fromX: 318, fromY: 205, toX: 371, toY: 185 },
    { fromX: 462, fromY: 207, toX: 517, toY: 190 },
    { fromX: 342, fromY: 229, toX: 286, toY: 207 },
    { fromX: 498, fromY: 218, toX: 444, toY: 198 },
];

const MIST = Array.from({ length: 22 }, (_, index) => ({
    x: (index * 91 + 37) % 720,
    y: 118 + ((index * 43) % 150),
    width: 24 + (index % 5) * 8,
    speed: 0.009 + (index % 4) * 0.003,
    alpha: 0.06 + (index % 4) * 0.025
}));

const LEAVES = Array.from({ length: 10 }, (_, index) => ({
    x: (index * 67 + 320) % 680,
    y: 120 + ((index * 29) % 145),
    speed: 0.015 + (index % 3) * 0.006,
    wobble: index * 0.7
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
        const t = i / steps;
        ctx.fillRect(
            Math.round(fromX + (toX - fromX) * t),
            Math.round(fromY + (toY - fromY) * t),
            size,
            size
        );
    }
};

const withAlpha = (ctx: CanvasRenderingContext2D, alpha: number, draw: () => void) => {
    const previousAlpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha;
    draw();
    ctx.globalAlpha = previousAlpha;
};

const createCanvas = (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
};

const loadSpriteSheet = () => new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = SPRITE_PATH;
});

const drawGeneratedSprite = (
    ctx: CanvasRenderingContext2D,
    row: number,
    frame: number,
    attacking: boolean
) => {
    const x = frame * FRAME_WIDTH;
    const y = row * FRAME_HEIGHT;
    const palette = [
        { robe: '#6b5844', trim: '#f1d4a4', hair: '#16100d', sash: '#d6b06f' },
        { robe: '#234d60', trim: '#9ee7df', hair: '#12151b', sash: '#d7e8eb' },
        { robe: '#702b28', trim: '#e3a156', hair: '#160d0c', sash: '#f0d097' },
        { robe: '#ded6bf', trim: '#a9dbff', hair: '#12151a', sash: '#c8d5d8' },
    ][row % 4];
    const idleBob = attacking ? 0 : (frame % 2);
    const lean = attacking ? Math.min(frame, ATTACK_FRAMES - 1) - 2 : 0;
    const swordReach = attacking ? 17 + frame * 4 : 18 + (frame % 2) * 2;
    const swordLift = attacking ? 14 + frame * 2 : 8;
    const bodyX = x + 22 + lean;
    const bodyY = y + 30 + idleBob;

    rect(ctx, x + 15 + lean, y + 10 + idleBob, 14, 7, palette.hair);
    rect(ctx, x + 17 + lean, y + 16 + idleBob, 12, 9, '#d9b487');
    rect(ctx, x + 13 + lean, y + 24 + idleBob, 20, 23, palette.robe);
    rect(ctx, x + 16 + lean, y + 27 + idleBob, 15, 4, palette.trim);
    rect(ctx, x + 19 + lean, y + 37 + idleBob, 11, 4, palette.sash);
    rect(ctx, x + 9 + lean, y + 28 + idleBob, 8, 20, palette.robe);
    rect(ctx, x + 30 + lean, y + 28 + idleBob, 8, 18, palette.robe);
    rect(ctx, x + 12 + lean, y + 47 + idleBob, 9, 11, '#171b20');
    rect(ctx, x + 26 + lean, y + 47 + idleBob, 9, 11, '#171b20');
    rect(ctx, x + 10 + lean, y + 58, 12, 3, '#080a0d');
    rect(ctx, x + 25 + lean, y + 58, 12, 3, '#080a0d');
    rect(ctx, x + 11 + lean, y + 20 + idleBob, 4, 12, palette.hair);
    rect(ctx, x + 28 + lean, y + 19 + idleBob, 4, 10, palette.hair);

    rect(ctx, bodyX + 4, bodyY - 7, 12, 4, palette.trim);
    line(ctx, bodyX + 15, bodyY - 6, bodyX + swordReach, bodyY - swordLift, attacking ? '#fff0ad' : '#dce7ea', attacking ? 2 : 1);
    line(ctx, bodyX + 15, bodyY - 4, bodyX + swordReach, bodyY - swordLift + 2, 'rgba(255,255,255,0.55)', 1);

    if (attacking && frame > 2) {
        withAlpha(ctx, 0.35, () => {
            line(ctx, bodyX + 13, bodyY - 3, bodyX + swordReach + 9, bodyY - swordLift + 7, '#99efff', 1);
        });
    }
};

const createFallbackSpriteSheet = () => {
    const canvas = createCanvas(FRAME_WIDTH * TOTAL_FRAMES, FRAME_HEIGHT * SPRITE_ROWS);
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    ctx.imageSmoothingEnabled = false;

    for (let row = 0; row < SPRITE_ROWS; row += 1) {
        for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
            drawGeneratedSprite(ctx, row, frame, frame >= IDLE_FRAMES);
        }
    }
    return canvas;
};

const drawCloudLayer = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    time: number,
    reducedMotion: boolean,
    mobile: boolean
) => {
    const rows = [
        { y: height * 0.25, h: 10, alpha: 0.16, drift: 0.018 },
        { y: height * 0.42, h: 15, alpha: 0.22, drift: 0.013 },
        { y: height * 0.62, h: 20, alpha: 0.18, drift: 0.009 },
    ];
    const count = mobile ? 4 : 6;

    rows.forEach((row, rowIndex) => {
        const offset = reducedMotion ? 0 : (time * row.drift * (rowIndex + 1)) % 150;
        withAlpha(ctx, row.alpha, () => {
            for (let i = -2; i < count + 2; i += 1) {
                const x = i * 130 - offset + rowIndex * 37;
                rect(ctx, x, row.y, 82, row.h, '#f0e2d2');
                rect(ctx, x + 28, row.y - 8, 94, row.h + 2, '#d5d7d9');
                rect(ctx, x + 72, row.y + 7, 80, row.h - 3, '#b9c3cf');
            }
        });
    });
};

const drawMistAndLeaves = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    time: number,
    reducedMotion: boolean,
    mobile: boolean
) => {
    const mistCount = mobile ? 10 : MIST.length;
    for (let i = 0; i < mistCount; i += 1) {
        const mist = MIST[i];
        const x = reducedMotion ? mist.x % width : (mist.x + time * mist.speed) % (width + 80) - 40;
        const y = (mist.y / DESKTOP_SIZE.height) * height;
        withAlpha(ctx, mist.alpha, () => {
            rect(ctx, x, y, mist.width, 2, '#eef6f4');
            rect(ctx, x + 12, y + 5, mist.width * 0.7, 2, '#cbd9e0');
        });
    }

    const leafCount = mobile ? 4 : LEAVES.length;
    for (let i = 0; i < leafCount; i += 1) {
        const leaf = LEAVES[i];
        const drift = reducedMotion ? 0 : time * leaf.speed;
        const x = (leaf.x + drift) % (width + 20) - 10;
        const y = (leaf.y / DESKTOP_SIZE.height) * height + Math.sin(time * 0.004 + leaf.wobble) * 5;
        withAlpha(ctx, 0.22, () => {
            rect(ctx, x, y, 3, 2, i % 2 ? '#b27738' : '#d0a34b');
        });
    }
};

const drawFlags = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    time: number,
    reducedMotion: boolean
) => {
    const flagSets = [
        { x: width * 0.82, y: height * 0.17, s: width / DESKTOP_SIZE.width },
        { x: width * 0.92, y: height * 0.28, s: width / DESKTOP_SIZE.width * 0.82 },
    ];

    flagSets.forEach((flag, index) => {
        const wave = reducedMotion ? 0 : Math.round(Math.sin(time * 0.006 + index) * 2);
        rect(ctx, flag.x, flag.y, 3 * flag.s, 54 * flag.s, 'rgba(40,27,19,0.55)');
        for (let i = 0; i < 3; i += 1) {
            rect(ctx, flag.x + 4 * flag.s + wave + i, flag.y + 7 * flag.s + i * 11 * flag.s, 9 * flag.s, 22 * flag.s, 'rgba(135,26,28,0.45)');
            rect(ctx, flag.x + 12 * flag.s + wave + i, flag.y + 12 * flag.s + i * 11 * flag.s, 5 * flag.s, 16 * flag.s, 'rgba(205,55,50,0.36)');
        }
    });
};

const getSpriteFrame = (time: number, fighter: Fighter, reducedMotion: boolean) => {
    if (reducedMotion) return { attacking: false, frame: 0 };

    const local = (time + fighter.phase) % fighter.cycleMs;
    const attacking = local < 680;
    if (attacking) {
        return {
            attacking,
            frame: IDLE_FRAMES + Math.min(ATTACK_FRAMES - 1, Math.floor(local / (680 / ATTACK_FRAMES)))
        };
    }

    return {
        attacking,
        frame: Math.floor((local - 680) / 145) % IDLE_FRAMES
    };
};

const drawFighters = (
    ctx: CanvasRenderingContext2D,
    source: SpriteSource,
    width: number,
    time: number,
    reducedMotion: boolean,
    mobile: boolean
) => {
    const scale = width / DESKTOP_SIZE.width;
    const fighters = mobile ? FIGHTERS.slice(0, 3) : FIGHTERS;

    fighters.forEach((fighter) => {
        const { frame } = getSpriteFrame(time, fighter, reducedMotion);
        const drawWidth = FRAME_WIDTH * fighter.scale * scale;
        const drawHeight = FRAME_HEIGHT * fighter.scale * scale;
        const x = fighter.x * scale - drawWidth / 2;
        const y = fighter.y * scale - drawHeight;
        const bob = reducedMotion ? 0 : Math.sin(time * 0.004 + fighter.phase) * 1.5 * scale;

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        if (fighter.facing < 0) {
            ctx.translate(x + drawWidth, y + bob);
            ctx.scale(-1, 1);
            ctx.drawImage(
                source,
                frame * FRAME_WIDTH,
                fighter.row * FRAME_HEIGHT,
                FRAME_WIDTH,
                FRAME_HEIGHT,
                0,
                0,
                drawWidth,
                drawHeight
            );
        } else {
            ctx.drawImage(
                source,
                frame * FRAME_WIDTH,
                fighter.row * FRAME_HEIGHT,
                FRAME_WIDTH,
                FRAME_HEIGHT,
                x,
                y + bob,
                drawWidth,
                drawHeight
            );
        }
        ctx.restore();
    });
};

const drawSwordFlash = (
    ctx: CanvasRenderingContext2D,
    width: number,
    time: number,
    reducedMotion: boolean
) => {
    if (reducedMotion) return;
    const local = time % 3300;
    if (local > 150) return;
    const scale = width / DESKTOP_SIZE.width;
    const flash = FLASHES[Math.floor(time / 3300) % FLASHES.length];
    const alpha = 1 - local / 150;

    withAlpha(ctx, alpha, () => {
        line(ctx, flash.fromX * scale, flash.fromY * scale, flash.toX * scale, flash.toY * scale, '#fff2b0', 2);
        line(ctx, (flash.fromX - 8) * scale, (flash.fromY + 7) * scale, flash.toX * scale, (flash.toY + 5) * scale, '#98efff', 1);
    });
};

const drawOverlay = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const gradient = ctx.createRadialGradient(width * 0.52, height * 0.48, width * 0.08, width * 0.52, height * 0.48, width * 0.74);
    gradient.addColorStop(0, 'rgba(0,0,0,0.02)');
    gradient.addColorStop(0.62, 'rgba(0,0,0,0.10)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.34)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    withAlpha(ctx, 0.07, () => {
        for (let y = 0; y < height; y += 4) {
            rect(ctx, 0, y, width, 1, '#000000');
        }
    });
};

const renderFrame = (
    ctx: CanvasRenderingContext2D,
    size: VirtualSize,
    spriteSource: SpriteSource,
    time: number,
    reducedMotion: boolean
) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);
    ctx.imageSmoothingEnabled = false;

    drawCloudLayer(ctx, size.width, size.height, time, reducedMotion, size.mobile);
    drawMistAndLeaves(ctx, size.width, size.height, time, reducedMotion, size.mobile);
    drawFlags(ctx, size.width, size.height, time, reducedMotion);
    drawFighters(ctx, spriteSource, size.width, time, reducedMotion, size.mobile);
    drawSwordFlash(ctx, size.width, time, reducedMotion);
    drawOverlay(ctx, size.width, size.height);
};

const HomePixelBackground: React.FC = () => {
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const [spriteSource, setSpriteSource] = React.useState<SpriteSource | null>(null);

    React.useEffect(() => {
        let cancelled = false;
        const fallback = createFallbackSpriteSheet();
        setSpriteSource(fallback);
        void loadSpriteSheet().then((image) => {
            if (!cancelled && image) {
                setSpriteSource(image);
            }
        });
        return () => {
            cancelled = true;
        };
    }, []);

    React.useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !spriteSource) return;
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
            renderFrame(ctx, size, spriteSource, performance.now(), reducedMotion);
        };

        const animate = (time: number) => {
            const targetFrameMs = reducedMotion ? 500 : size.mobile ? 50 : 33;
            if (!pausedByVisibility && time - lastFrame >= targetFrameMs) {
                renderFrame(ctx, size, spriteSource, time, reducedMotion);
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
            renderFrame(ctx, size, spriteSource, performance.now(), reducedMotion);
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
    }, [spriteSource]);

    return (
        <>
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-cover bg-center"
                style={{
                    backgroundImage: `url('${BG_PATH}')`
                }}
            />
            <canvas
                ref={canvasRef}
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 h-full w-full opacity-95"
                style={{
                    imageRendering: 'pixelated'
                }}
            />
        </>
    );
};

export default HomePixelBackground;
