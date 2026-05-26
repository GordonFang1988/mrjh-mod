import React from 'react';

type Point = { x: number; y: number };
type Facing = 1 | -1;

const SCENE_WIDTH = 480;
const SCENE_HEIGHT = 270;

const prefersReducedMotion = () => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

const fillPixelRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string
) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

const fillPolygon = (ctx: CanvasRenderingContext2D, points: Point[], color: string) => {
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

const lerp = (a: Point, b: Point, t: number): Point => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t
});

const drawPixelLine = (
    ctx: CanvasRenderingContext2D,
    from: Point,
    to: Point,
    color: string,
    pixelSize = 1
) => {
    const dx = Math.abs(Math.round(to.x - from.x));
    const dy = Math.abs(Math.round(to.y - from.y));
    const steps = Math.max(dx, dy, 1);
    ctx.fillStyle = color;
    for (let i = 0; i <= steps; i += pixelSize) {
        const t = i / steps;
        ctx.fillRect(
            Math.round(from.x + (to.x - from.x) * t),
            Math.round(from.y + (to.y - from.y) * t),
            pixelSize,
            pixelSize
        );
    }
};

const drawMountainRange = (
    ctx: CanvasRenderingContext2D,
    baseY: number,
    offset: number,
    color: string,
    highlight: string,
    alpha: number
) => {
    ctx.globalAlpha = alpha;
    for (let i = -1; i < 7; i += 1) {
        const x = i * 92 - offset;
        const peak = baseY - 44 - ((i + 2) % 3) * 18;
        fillPolygon(ctx, [
            { x: x - 50, y: baseY },
            { x, y: peak },
            { x: x + 66, y: baseY }
        ], color);
        fillPolygon(ctx, [
            { x, y: peak },
            { x: x + 18, y: baseY - 10 },
            { x: x + 34, y: baseY }
        ], highlight);
    }
    ctx.globalAlpha = 1;
};

const drawCloudSea = (ctx: CanvasRenderingContext2D, time: number, reducedMotion: boolean) => {
    const speed = reducedMotion ? 0.003 : 0.018;
    const drift = (time * speed) % 120;
    const bands = [
        { y: 86, height: 15, alpha: 0.20, color: '#f3d7b8' },
        { y: 106, height: 18, alpha: 0.24, color: '#c7c8c9' },
        { y: 128, height: 20, alpha: 0.20, color: '#9aa9b7' },
        { y: 214, height: 22, alpha: 0.18, color: '#cbd2dd' }
    ];

    for (const band of bands) {
        ctx.globalAlpha = band.alpha;
        for (let i = -2; i < 8; i += 1) {
            const x = i * 92 - drift * (band.y / 120);
            fillPixelRect(ctx, x, band.y, 54, band.height, band.color);
            fillPixelRect(ctx, x + 24, band.y - 8, 64, band.height - 4, band.color);
            fillPixelRect(ctx, x + 54, band.y + 7, 68, band.height - 7, band.color);
        }
    }
    ctx.globalAlpha = 1;
};

const drawStonePlatform = (ctx: CanvasRenderingContext2D, time: number) => {
    const top = { x: 246, y: 92 };
    const right = { x: 398, y: 156 };
    const bottom = { x: 248, y: 229 };
    const left = { x: 94, y: 157 };
    const edgeBottom = { x: 247, y: 247 };

    fillPolygon(ctx, [left, top, right, bottom], '#6e6657');
    fillPolygon(ctx, [left, bottom, edgeBottom, { x: 102, y: 174 }], '#3f3b34');
    fillPolygon(ctx, [right, bottom, edgeBottom, { x: 392, y: 172 }], '#4c4339');
    strokePolygon(ctx, [left, top, right, bottom], '#b7a06f', 1);

    for (let i = 1; i < 9; i += 1) {
        const t = i / 9;
        const a = lerp(left, top, t);
        const b = lerp(bottom, right, t);
        drawPixelLine(ctx, a, b, 'rgba(38,34,30,0.5)');
        const c = lerp(top, right, t);
        const d = lerp(left, bottom, t);
        drawPixelLine(ctx, c, d, 'rgba(38,34,30,0.45)');
    }

    for (let i = 0; i < 54; i += 1) {
        const row = i % 9;
        const col = Math.floor(i / 9);
        const x = 122 + col * 42 + (row % 2) * 8;
        const y = 122 + row * 10 - col * 4;
        fillPixelRect(ctx, x, y, 10 + (i % 3) * 4, 2, i % 4 === 0 ? '#8a806e' : '#544f46');
    }

    const glow = Math.sin(time * 0.0018) * 0.5 + 0.5;
    ctx.globalAlpha = 0.16 + glow * 0.08;
    strokePolygon(ctx, [
        { x: 206, y: 152 },
        { x: 246, y: 137 },
        { x: 288, y: 153 },
        { x: 247, y: 171 }
    ], '#d8bd69', 1);
    strokePolygon(ctx, [
        { x: 218, y: 153 },
        { x: 247, y: 143 },
        { x: 276, y: 154 },
        { x: 248, y: 166 }
    ], '#f2d98b', 1);
    ctx.globalAlpha = 1;

    for (let i = 0; i < 24; i += 1) {
        const x = 104 + i * 12;
        const y = i % 2 === 0 ? 158 + i * 2.1 : 94 + i * 2.3;
        if (i < 12) fillPixelRect(ctx, x, y, 7, 11, '#7e7769');
        if (i >= 12) fillPixelRect(ctx, x + 6, 112 + (i - 12) * 5, 7, 11, '#867a67');
    }
};

const drawPine = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale: number,
    time: number,
    phase = 0
) => {
    const sway = Math.round(Math.sin(time * 0.002 + phase) * 2);
    fillPixelRect(ctx, x, y - 42 * scale, 7 * scale, 45 * scale, '#3a241b');
    fillPixelRect(ctx, x + 4 * scale, y - 35 * scale, 4 * scale, 25 * scale, '#5a3324');

    const clusters = [
        [-25, -45, 44, 12], [-36, -34, 52, 12], [-18, -25, 58, 12],
        [-46, -18, 42, 10], [8, -13, 50, 11], [-22, -7, 42, 9]
    ];
    for (const [cx, cy, w, h] of clusters) {
        fillPixelRect(ctx, x + cx * scale + sway, y + cy * scale, w * scale, h * scale, '#17291f');
        fillPixelRect(ctx, x + (cx + 5) * scale + sway, y + (cy - 3) * scale, (w - 14) * scale, 5 * scale, '#2b4b31');
        fillPixelRect(ctx, x + (cx + 9) * scale + sway, y + (cy + h - 3) * scale, (w - 18) * scale, 3 * scale, '#07110d');
    }
};

const drawFlag = (ctx: CanvasRenderingContext2D, x: number, y: number, time: number) => {
    const wave = Math.round(Math.sin(time * 0.006) * 2);
    fillPixelRect(ctx, x, y - 64, 3, 74, '#2a1d17');
    fillPixelRect(ctx, x - 13, y - 64, 29, 3, '#756044');
    for (let i = 0; i < 4; i += 1) {
        fillPixelRect(ctx, x + 3 + wave + i, y - 58 + i * 10, 8, 22, '#7f1d1d');
        fillPixelRect(ctx, x + 11 + wave + i, y - 53 + i * 10, 5, 18, '#b6332b');
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
    const end = {
        x: x + facing * (18 + swing * 8),
        y: y - 9 - swing * 7
    };
    drawPixelLine(ctx, { x: x + facing * 4, y: y - 5 }, end, color, 1);
    drawPixelLine(ctx, { x: x + facing * 5, y: y - 4 }, { x: end.x, y: end.y + 1 }, 'rgba(255,255,255,0.6)', 1);
};

const drawWarrior = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    facing: Facing,
    coat: string,
    trim: string,
    time: number,
    phase: number,
    active = true
) => {
    const frame = Math.floor((time * 0.008 + phase) % 6);
    const swing = active && frame >= 3 ? (frame - 2) / 3 : 0;
    const bob = Math.round(Math.sin(time * 0.006 + phase) * 1);
    const baseY = y + bob;
    const lean = active ? Math.round(Math.sin(time * 0.004 + phase) * 2) : 0;

    fillPixelRect(ctx, x - 4 + lean, baseY - 23, 8, 5, '#15100d');
    fillPixelRect(ctx, x - 5 + lean, baseY - 18, 10, 5, '#d7b584');
    fillPixelRect(ctx, x - 7 + lean, baseY - 12, 14, 14, coat);
    fillPixelRect(ctx, x - 5 + lean, baseY - 10, 10, 3, trim);
    fillPixelRect(ctx, x - 8 + lean, baseY + 1, 5, 8, '#171b20');
    fillPixelRect(ctx, x + 3 + lean, baseY + 1, 5, 8, '#171b20');
    fillPixelRect(ctx, x - 10 + lean, baseY + 9, 9, 3, '#0b0d10');
    fillPixelRect(ctx, x + 1 + lean, baseY + 9, 9, 3, '#0b0d10');
    fillPixelRect(ctx, x + facing * 3 + lean, baseY - 8, facing * 12, 3, trim);
    drawSword(ctx, x + lean, baseY, facing, swing, swing > 0.8 ? '#fff3b0' : '#d8e1e4');
};

const drawSwordFlash = (ctx: CanvasRenderingContext2D, time: number, reducedMotion: boolean) => {
    if (reducedMotion) return;
    const cycle = Math.floor(time / 1800);
    const local = time % 1800;
    if (local > 150) return;
    const pairs = [
        { x1: 183, y1: 150, x2: 219, y2: 135 },
        { x1: 306, y1: 153, x2: 342, y2: 141 },
        { x1: 246, y1: 133, x2: 270, y2: 121 }
    ];
    const flash = pairs[cycle % pairs.length];
    ctx.globalAlpha = 1 - local / 150;
    drawPixelLine(ctx, { x: flash.x1, y: flash.y1 }, { x: flash.x2, y: flash.y2 }, '#fff4bb', 2);
    drawPixelLine(ctx, { x: flash.x1 - 6, y: flash.y1 + 6 }, { x: flash.x2 - 1, y: flash.y2 + 4 }, '#9ff0ff', 1);
    ctx.globalAlpha = 1;
};

const drawScene = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    time: number,
    reducedMotion: boolean
) => {
    const scale = Math.max(width / SCENE_WIDTH, height / SCENE_HEIGHT);
    const offsetX = (width - SCENE_WIDTH * scale) / 2;
    const offsetY = (height - SCENE_HEIGHT * scale) / 2;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);

    const sky = ctx.createLinearGradient(0, 0, SCENE_WIDTH, SCENE_HEIGHT);
    sky.addColorStop(0, '#e7aa73');
    sky.addColorStop(0.28, '#a98787');
    sky.addColorStop(0.58, '#405169');
    sky.addColorStop(1, '#101722');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, SCENE_WIDTH, SCENE_HEIGHT);

    ctx.globalAlpha = 0.8;
    fillPixelRect(ctx, 57, 52, 18, 18, '#f7e6c5');
    fillPixelRect(ctx, 54, 56, 24, 10, 'rgba(255,238,198,0.5)');
    ctx.globalAlpha = 1;

    const t = reducedMotion ? 0 : time;
    drawMountainRange(ctx, 121, (t * 0.003) % 92, '#6b7581', '#9a9da1', 0.34);
    drawMountainRange(ctx, 142, (t * 0.006) % 92, '#3c4d59', '#65727b', 0.5);
    drawCloudSea(ctx, time, reducedMotion);

    drawPine(ctx, 92, 211, 0.78, t, 0.2);
    drawPine(ctx, 390, 226, 0.88, t, 1.1);
    drawPine(ctx, 342, 126, 0.44, t, 2.4);
    drawFlag(ctx, 386, 117, t);
    drawStonePlatform(ctx, t);

    drawWarrior(ctx, 176, 160, 1, '#62513e', '#ead2a4', t, 0.1);
    drawWarrior(ctx, 218, 150, -1, '#284b5c', '#99e2e0', t, 2.5);
    drawWarrior(ctx, 305, 160, 1, '#6a2626', '#e0a04f', t, 1.6);
    drawWarrior(ctx, 347, 151, -1, '#d8d2bd', '#9fd0ff', t, 3.4);
    drawWarrior(ctx, 261, 126, 1, '#253746', '#c9d7dc', t, 4.7, false);
    drawSwordFlash(ctx, time, reducedMotion);

    ctx.globalAlpha = 0.18;
    for (let i = 0; i < 28; i += 1) {
        const drift = reducedMotion ? 0 : time * 0.01;
        const x = (i * 41 + drift) % 520 - 20;
        const y = 42 + ((i * 29) % 118);
        fillPixelRect(ctx, x, y, 2, 2, i % 3 === 0 ? '#fff2be' : '#d2edf0');
    }
    ctx.globalAlpha = 1;
};

const HomePixelBackground: React.FC = () => {
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

    React.useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        let animationFrame = 0;
        let reducedMotion = prefersReducedMotion();
        const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');

        const resize = () => {
            const rect = canvas.getBoundingClientRect();
            const isSmallScreen = rect.width < 720;
            const dpr = Math.min(window.devicePixelRatio || 1, isSmallScreen ? 1.15 : 1.5);
            canvas.width = Math.max(1, Math.floor(rect.width * dpr));
            canvas.height = Math.max(1, Math.floor(rect.height * dpr));
            drawScene(ctx, canvas.width, canvas.height, performance.now(), reducedMotion);
        };

        let lastFrameTime = 0;
        const animate = (time: number) => {
            const minFrameMs = canvas.width < 900 ? 66 : 33;
            if (!reducedMotion && time - lastFrameTime >= minFrameMs) {
                drawScene(ctx, canvas.width, canvas.height, time, false);
                lastFrameTime = time;
            }
            animationFrame = window.requestAnimationFrame(animate);
        };

        const handleMotionChange = (event: MediaQueryListEvent) => {
            reducedMotion = event.matches;
            window.cancelAnimationFrame(animationFrame);
            drawScene(ctx, canvas.width, canvas.height, performance.now(), reducedMotion);
            if (!reducedMotion) {
                animationFrame = window.requestAnimationFrame(animate);
            }
        };

        resize();
        window.addEventListener('resize', resize);
        motionQuery?.addEventListener?.('change', handleMotionChange);

        if (!reducedMotion) {
            animationFrame = window.requestAnimationFrame(animate);
        }

        return () => {
            window.removeEventListener('resize', resize);
            motionQuery?.removeEventListener?.('change', handleMotionChange);
            window.cancelAnimationFrame(animationFrame);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full opacity-95"
        />
    );
};

export default HomePixelBackground;
