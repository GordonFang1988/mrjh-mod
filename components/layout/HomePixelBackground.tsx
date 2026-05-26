import React from 'react';

type Point = { x: number; y: number };
type Facing = 1 | -1;
type VirtualSize = { width: number; height: number; mobile: boolean };

type Fighter = {
    x: number;
    y: number;
    facing: Facing;
    coat: string;
    trim: string;
    phase: number;
    active?: boolean;
};

const DESKTOP_SIZE = { width: 640, height: 360 };
const MOBILE_SIZE = { width: 480, height: 270 };

const FIGHTERS: Fighter[] = [
    { x: 247, y: 213, facing: 1, coat: '#594b3e', trim: '#f0d8a2', phase: 0.2, active: true },
    { x: 305, y: 199, facing: -1, coat: '#294c5d', trim: '#9be7e1', phase: 2.6, active: true },
    { x: 414, y: 214, facing: 1, coat: '#692827', trim: '#e5aa55', phase: 1.4, active: true },
    { x: 468, y: 203, facing: -1, coat: '#d8d0bd', trim: '#a8ddff', phase: 3.2, active: true },
    { x: 353, y: 170, facing: 1, coat: '#273948', trim: '#ced9dc', phase: 4.5, active: false },
];

const BIRDS = [
    { x: 118, y: 65, speed: 0.012 },
    { x: 172, y: 82, speed: 0.009 },
    { x: 532, y: 74, speed: 0.006 },
];

const MIST_DOTS = Array.from({ length: 24 }, (_, index) => ({
    x: (index * 83 + 47) % 700,
    y: 80 + ((index * 37) % 180),
    speed: 0.006 + (index % 5) * 0.002,
    alpha: 0.07 + (index % 4) * 0.025,
}));

const createCanvas = (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
};

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

const polygon = (ctx: CanvasRenderingContext2D, points: Point[], color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    ctx.fill();
};

const strokePolygon = (ctx: CanvasRenderingContext2D, points: Point[], color: string, width = 1) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    ctx.stroke();
};

const lerp = (from: Point, to: Point, amount: number): Point => ({
    x: from.x + (to.x - from.x) * amount,
    y: from.y + (to.y - from.y) * amount
});

const pixelLine = (
    ctx: CanvasRenderingContext2D,
    from: Point,
    to: Point,
    color: string,
    size = 1
) => {
    const steps = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y), 1);
    ctx.fillStyle = color;
    for (let i = 0; i <= steps; i += size) {
        const amount = i / steps;
        ctx.fillRect(
            Math.round(from.x + (to.x - from.x) * amount),
            Math.round(from.y + (to.y - from.y) * amount),
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

const drawSky = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const sky = ctx.createLinearGradient(0, 0, width, height);
    sky.addColorStop(0, '#f0b376');
    sky.addColorStop(0.22, '#b58a84');
    sky.addColorStop(0.55, '#42546c');
    sky.addColorStop(1, '#101721');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    const sunX = width * 0.15;
    const sunY = height * 0.23;
    withAlpha(ctx, 0.8, () => {
        rect(ctx, sunX - 11, sunY - 11, 22, 22, '#fee8bf');
        rect(ctx, sunX - 20, sunY - 5, 40, 10, 'rgba(255,238,196,0.42)');
        rect(ctx, sunX - 32, sunY + 8, 64, 4, 'rgba(255,211,149,0.28)');
    });
};

const drawMountains = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    time: number,
    reducedMotion: boolean
) => {
    const layers = [
        { base: height * 0.43, peak: 0.20, step: 116, speed: 0.004, color: '#747d88', light: '#a49d98', alpha: 0.32 },
        { base: height * 0.52, peak: 0.28, step: 104, speed: 0.008, color: '#405466', light: '#637280', alpha: 0.48 },
        { base: height * 0.66, peak: 0.38, step: 132, speed: 0.014, color: '#202d37', light: '#364654', alpha: 0.62 },
    ];

    layers.forEach((layer, layerIndex) => {
        const drift = reducedMotion ? 0 : (time * layer.speed) % layer.step;
        withAlpha(ctx, layer.alpha, () => {
            for (let i = -2; i < Math.ceil(width / layer.step) + 3; i += 1) {
                const x = i * layer.step - drift;
                const peakY = height * layer.peak - ((i + layerIndex) % 3) * 17;
                polygon(ctx, [
                    { x: x - 64, y: layer.base },
                    { x: x + 12, y: peakY },
                    { x: x + 92, y: layer.base }
                ], layer.color);
                polygon(ctx, [
                    { x: x + 12, y: peakY },
                    { x: x + 36, y: layer.base - 12 },
                    { x: x + 58, y: layer.base }
                ], layer.light);
            }
        });
    });
};

const drawClouds = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    time: number,
    reducedMotion: boolean,
    mobile: boolean
) => {
    const speed = reducedMotion ? 0.002 : 0.018;
    const density = mobile ? 5 : 7;
    const cloudRows = [
        { y: height * 0.36, h: 13, color: '#ffe3bf', alpha: 0.19, drift: 1.0 },
        { y: height * 0.46, h: 18, color: '#dad6d2', alpha: 0.23, drift: 0.75 },
        { y: height * 0.61, h: 23, color: '#aeb9c6', alpha: 0.2, drift: 0.48 },
        { y: height * 0.82, h: 24, color: '#cfd6df', alpha: 0.16, drift: 0.34 },
    ];

    cloudRows.forEach((row, rowIndex) => {
        const offset = (time * speed * row.drift) % 120;
        withAlpha(ctx, row.alpha, () => {
            for (let i = -2; i < density + 2; i += 1) {
                const x = i * 112 - offset + (rowIndex % 2) * 34;
                rect(ctx, x, row.y, 70, row.h, row.color);
                rect(ctx, x + 24, row.y - 8, 86, row.h - 4, row.color);
                rect(ctx, x + 62, row.y + 7, 78, row.h - 7, row.color);
            }
        });
    });
};

const drawPlatform = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const centerX = width * 0.58;
    const top = { x: centerX, y: height * 0.31 };
    const right = { x: centerX + width * 0.25, y: height * 0.53 };
    const bottom = { x: centerX + width * 0.01, y: height * 0.82 };
    const left = { x: centerX - width * 0.27, y: height * 0.54 };
    const edge = { x: bottom.x, y: bottom.y + height * 0.07 };

    polygon(ctx, [left, top, right, bottom], '#6f685a');
    polygon(ctx, [left, bottom, edge, { x: left.x + 12, y: left.y + 24 }], '#3e3931');
    polygon(ctx, [right, bottom, edge, { x: right.x - 10, y: right.y + 26 }], '#4a4137');
    strokePolygon(ctx, [left, top, right, bottom], '#bca36d', 1);

    for (let i = 1; i < 11; i += 1) {
        const amount = i / 11;
        pixelLine(ctx, lerp(left, top, amount), lerp(bottom, right, amount), 'rgba(36,32,28,0.52)');
        pixelLine(ctx, lerp(top, right, amount), lerp(left, bottom, amount), 'rgba(36,32,28,0.42)');
    }

    for (let i = 0; i < 76; i += 1) {
        const row = i % 10;
        const col = Math.floor(i / 10);
        const x = left.x + 45 + col * 41 + (row % 2) * 10;
        const y = top.y + 43 + row * 11 - col * 5;
        rect(ctx, x, y, 11 + (i % 4) * 5, 2, i % 5 === 0 ? '#8d836f' : '#514b42');
    }

    withAlpha(ctx, 0.24, () => {
        strokePolygon(ctx, [
            { x: centerX - 48, y: height * 0.56 },
            { x: centerX, y: height * 0.49 },
            { x: centerX + 50, y: height * 0.56 },
            { x: centerX, y: height * 0.64 },
        ], '#e0c373', 1);
        strokePolygon(ctx, [
            { x: centerX - 31, y: height * 0.56 },
            { x: centerX, y: height * 0.52 },
            { x: centerX + 32, y: height * 0.56 },
            { x: centerX, y: height * 0.61 },
        ], '#f4de95', 1);
    });
};

const drawStoneProps = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const markers = [
        { x: width * 0.38, y: height * 0.52 },
        { x: width * 0.72, y: height * 0.50 },
        { x: width * 0.49, y: height * 0.70 },
        { x: width * 0.78, y: height * 0.65 },
    ];

    markers.forEach((marker, index) => {
        rect(ctx, marker.x, marker.y - 17, 8, 17, '#8b806d');
        rect(ctx, marker.x - 2, marker.y - 20, 12, 4, '#b5a179');
        rect(ctx, marker.x + 2, marker.y - 14, 4, 8, index % 2 === 0 ? '#544d42' : '#4a443d');
    });

    for (let i = 0; i < 13; i += 1) {
        rect(ctx, width * 0.83 - i * 11, height * 0.34 + i * 6, 18, 5, i % 2 ? '#4a4339' : '#665d4f');
    }
};

const drawStaticPineBase = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale: number
) => {
    rect(ctx, x, y - 54 * scale, 8 * scale, 57 * scale, '#3a241b');
    rect(ctx, x + 5 * scale, y - 44 * scale, 4 * scale, 34 * scale, '#5b3325');
};

const drawMovingPineFoliage = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale: number,
    time: number,
    phase: number,
    reducedMotion: boolean
) => {
    const sway = reducedMotion ? 0 : Math.round(Math.sin(time * 0.002 + phase) * 2);
    const clusters = [
        [-30, -58, 54, 13], [-44, -45, 66, 14], [-24, -33, 72, 14],
        [-57, -24, 50, 12], [10, -18, 62, 13], [-28, -8, 54, 10]
    ];
    clusters.forEach(([cx, cy, w, h], index) => {
        rect(ctx, x + cx * scale + sway, y + cy * scale, w * scale, h * scale, index % 2 ? '#112219' : '#172c21');
        rect(ctx, x + (cx + 7) * scale + sway, y + (cy - 3) * scale, (w - 18) * scale, 5 * scale, '#31543a');
        rect(ctx, x + (cx + 9) * scale + sway, y + (cy + h - 3) * scale, (w - 20) * scale, 3 * scale, '#07110d');
    });
};

const drawTreesAndFlags = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    time: number,
    reducedMotion: boolean
) => {
    drawMovingPineFoliage(ctx, width * 0.18, height * 0.83, 0.95, time, 0.4, reducedMotion);
    drawMovingPineFoliage(ctx, width * 0.82, height * 0.89, 1.04, time, 1.6, reducedMotion);
    drawMovingPineFoliage(ctx, width * 0.68, height * 0.42, 0.52, time, 2.3, reducedMotion);

    const flagX = width * 0.82;
    const flagY = height * 0.43;
    const wave = reducedMotion ? 0 : Math.round(Math.sin(time * 0.006) * 2);
    rect(ctx, flagX, flagY - 84, 3, 96, '#2b1d17');
    rect(ctx, flagX - 17, flagY - 84, 37, 4, '#806746');
    for (let i = 0; i < 4; i += 1) {
        rect(ctx, flagX + 4 + wave + i, flagY - 76 + i * 13, 10, 27, '#7f1d1d');
        rect(ctx, flagX + 14 + wave + i, flagY - 70 + i * 13, 6, 22, '#b5322c');
    }
};

const drawSword = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    facing: Facing,
    swing: number,
    color: string
) => {
    const end = { x: x + facing * (22 + swing * 11), y: y - 12 - swing * 8 };
    pixelLine(ctx, { x: x + facing * 5, y: y - 6 }, end, color, 1);
    pixelLine(ctx, { x: x + facing * 6, y: y - 5 }, { x: end.x, y: end.y + 1 }, 'rgba(255,255,255,0.62)', 1);
};

const drawSingleSwordsman = (
    ctx: CanvasRenderingContext2D,
    fighter: Fighter,
    time: number,
    reducedMotion: boolean,
    scale = 1
) => {
    const actionTime = reducedMotion ? 0 : time;
    const frame = Math.floor((actionTime * 0.007 + fighter.phase) % 7);
    const swing = fighter.active && frame >= 4 ? (frame - 3) / 4 : 0;
    const bob = reducedMotion ? 0 : Math.round(Math.sin(actionTime * 0.005 + fighter.phase) * 1);
    const lean = fighter.active && !reducedMotion
        ? Math.round(Math.sin(actionTime * 0.004 + fighter.phase) * 2)
        : 0;
    const x = fighter.x * scale + lean;
    const y = fighter.y * scale + bob;
    const s = scale;

    rect(ctx, x - 4 * s, y - 25 * s, 9 * s, 5 * s, '#15100d');
    rect(ctx, x - 6 * s, y - 20 * s, 12 * s, 6 * s, '#d8b684');
    rect(ctx, x - 8 * s, y - 13 * s, 16 * s, 16 * s, fighter.coat);
    rect(ctx, x - 6 * s, y - 11 * s, 12 * s, 3 * s, fighter.trim);
    rect(ctx, x - 9 * s, y + 3 * s, 6 * s, 10 * s, '#171b20');
    rect(ctx, x + 3 * s, y + 3 * s, 6 * s, 10 * s, '#171b20');
    rect(ctx, x - 11 * s, y + 13 * s, 10 * s, 3 * s, '#080a0d');
    rect(ctx, x + 1 * s, y + 13 * s, 10 * s, 3 * s, '#080a0d');
    rect(ctx, x + fighter.facing * 4 * s, y - 9 * s, fighter.facing * 13 * s, 3 * s, fighter.trim);
    drawSword(ctx, x, y, fighter.facing, swing, swing > 0.75 ? '#fff2ad' : '#d8e4e7');
};

const drawSwordsmen = (
    ctx: CanvasRenderingContext2D,
    width: number,
    time: number,
    reducedMotion: boolean,
    mobile: boolean
) => {
    const scale = width / DESKTOP_SIZE.width;
    const fighters = mobile ? FIGHTERS.slice(0, 4) : FIGHTERS;
    fighters.forEach((fighter) => drawSingleSwordsman(ctx, fighter, time, reducedMotion, scale));
};

const drawSwordFlash = (
    ctx: CanvasRenderingContext2D,
    width: number,
    time: number,
    reducedMotion: boolean
) => {
    if (reducedMotion) return;
    const scale = width / DESKTOP_SIZE.width;
    const local = time % 2800;
    if (local > 170) return;

    const flashIndex = Math.floor(time / 2800) % 4;
    const flashes = [
        { from: { x: 258, y: 202 }, to: { x: 319, y: 179 } },
        { from: { x: 421, y: 205 }, to: { x: 479, y: 184 } },
        { from: { x: 336, y: 169 }, to: { x: 374, y: 151 } },
        { from: { x: 294, y: 217 }, to: { x: 236, y: 191 } },
    ];
    const flash = flashes[flashIndex];

    withAlpha(ctx, 1 - local / 170, () => {
        pixelLine(ctx, {
            x: flash.from.x * scale,
            y: flash.from.y * scale
        }, {
            x: flash.to.x * scale,
            y: flash.to.y * scale
        }, '#fff4b7', 2);
        pixelLine(ctx, {
            x: (flash.from.x - 7) * scale,
            y: (flash.from.y + 7) * scale
        }, {
            x: (flash.to.x - 2) * scale,
            y: (flash.to.y + 5) * scale
        }, '#9eeeff', 1);
    });
};

const drawAmbientDetails = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    time: number,
    reducedMotion: boolean,
    mobile: boolean
) => {
    const dotCount = mobile ? 10 : MIST_DOTS.length;
    for (let i = 0; i < dotCount; i += 1) {
        const dot = MIST_DOTS[i];
        const x = reducedMotion ? dot.x % width : (dot.x + time * dot.speed) % (width + 40) - 20;
        withAlpha(ctx, dot.alpha, () => {
            rect(ctx, x, (dot.y / DESKTOP_SIZE.height) * height, 2, 2, i % 3 ? '#d9edf1' : '#fff0bd');
        });
    }

    if (!mobile) {
        BIRDS.forEach((bird, index) => {
            const x = reducedMotion ? bird.x : (bird.x + time * bird.speed) % (width + 30);
            const y = bird.y + Math.sin(time * 0.002 + index) * 2;
            withAlpha(ctx, 0.42, () => {
                pixelLine(ctx, { x, y }, { x: x + 5, y: y + 2 }, '#1b2028');
                pixelLine(ctx, { x: x + 5, y: y + 2 }, { x: x + 10, y }, '#1b2028');
            });
        });
    }
};

const drawOverlay = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const vignette = ctx.createRadialGradient(
        width * 0.55,
        height * 0.52,
        width * 0.05,
        width * 0.55,
        height * 0.52,
        width * 0.72
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0.06)');
    vignette.addColorStop(0.56, 'rgba(0,0,0,0.20)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.76)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    withAlpha(ctx, 0.09, () => {
        for (let y = 0; y < height; y += 4) {
            rect(ctx, 0, y, width, 1, '#000000');
        }
    });
};

const buildStaticBackground = (width: number, height: number) => {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    ctx.imageSmoothingEnabled = false;
    drawSky(ctx, width, height);
    return canvas;
};

const buildStaticForeground = (width: number, height: number) => {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    ctx.imageSmoothingEnabled = false;

    drawPlatform(ctx, width, height);
    drawStoneProps(ctx, width, height);
    drawStaticPineBase(ctx, width * 0.18, height * 0.83, width / DESKTOP_SIZE.width * 0.95);
    drawStaticPineBase(ctx, width * 0.82, height * 0.89, width / DESKTOP_SIZE.width * 1.04);
    drawStaticPineBase(ctx, width * 0.68, height * 0.42, width / DESKTOP_SIZE.width * 0.52);
    return canvas;
};

const renderFrame = (
    ctx: CanvasRenderingContext2D,
    background: HTMLCanvasElement,
    foreground: HTMLCanvasElement,
    size: VirtualSize,
    time: number,
    reducedMotion: boolean
) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(background, 0, 0);
    drawMountains(ctx, size.width, size.height, time, reducedMotion);
    drawClouds(ctx, size.width, size.height, time, reducedMotion, size.mobile);
    ctx.drawImage(foreground, 0, 0);
    drawTreesAndFlags(ctx, size.width, size.height, time, reducedMotion);
    drawSwordsmen(ctx, size.width, time, reducedMotion, size.mobile);
    drawSwordFlash(ctx, size.width, time, reducedMotion);
    drawAmbientDetails(ctx, size.width, size.height, time, reducedMotion, size.mobile);
    drawOverlay(ctx, size.width, size.height);
};

const HomePixelBackground: React.FC = () => {
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

    React.useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        let size = getVirtualSize();
        let background = buildStaticBackground(size.width, size.height);
        let foreground = buildStaticForeground(size.width, size.height);
        let reducedMotion = getReducedMotion();
        let animationFrame = 0;
        let lastFrame = 0;
        let pausedByVisibility = document.hidden;
        const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');

        const applyCanvasSize = () => {
            const nextSize = getVirtualSize();
            const changed = nextSize.width !== size.width || nextSize.height !== size.height;
            size = nextSize;
            canvas.width = size.width;
            canvas.height = size.height;
            if (changed) {
                background = buildStaticBackground(size.width, size.height);
                foreground = buildStaticForeground(size.width, size.height);
            }
            renderFrame(ctx, background, foreground, size, performance.now(), reducedMotion);
        };

        const stopAnimation = () => {
            if (animationFrame) {
                window.cancelAnimationFrame(animationFrame);
                animationFrame = 0;
            }
        };

        const animate = (time: number) => {
            const targetFrameMs = reducedMotion ? 500 : size.mobile ? 50 : 33;
            if (!pausedByVisibility && time - lastFrame >= targetFrameMs) {
                renderFrame(ctx, background, foreground, size, time, reducedMotion);
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
            renderFrame(ctx, background, foreground, size, performance.now(), reducedMotion);
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
    }, []);

    return (
        <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full opacity-95"
            style={{
                imageRendering: 'pixelated'
            }}
        />
    );
};

export default HomePixelBackground;
