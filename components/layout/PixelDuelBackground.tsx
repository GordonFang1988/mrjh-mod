import React from 'react';

type PixelRect = {
    x: number;
    y: number;
    w: number;
    h: number;
    color: string;
};

const drawRects = (ctx: CanvasRenderingContext2D, scale: number, rects: PixelRect[]) => {
    for (const rect of rects) {
        ctx.fillStyle = rect.color;
        ctx.fillRect(rect.x * scale, rect.y * scale, rect.w * scale, rect.h * scale);
    }
};

const drawSwordsman = (
    ctx: CanvasRenderingContext2D,
    scale: number,
    x: number,
    y: number,
    facing: 1 | -1,
    coat: string,
    trim: string,
    t: number
) => {
    const bob = Math.round(Math.sin(t * 0.006) * 1);
    const lunge = Math.round(Math.sin(t * 0.004) * 3);
    const baseX = x + facing * lunge;
    const baseY = y + bob;
    const swordFlash = Math.sin(t * 0.018) > 0.72 ? '#fff7c9' : '#c9d6dc';
    const armY = Math.sin(t * 0.008) > 0 ? 0 : 1;

    drawRects(ctx, scale, [
        { x: baseX - 4, y: baseY - 22, w: 8, h: 4, color: '#201712' },
        { x: baseX - 5, y: baseY - 18, w: 10, h: 4, color: '#e4c08a' },
        { x: baseX - 7, y: baseY - 12, w: 14, h: 13, color: coat },
        { x: baseX - 5, y: baseY - 11, w: 10, h: 3, color: trim },
        { x: baseX - 8, y: baseY + 1, w: 5, h: 10, color: '#202326' },
        { x: baseX + 3, y: baseY + 1, w: 5, h: 10, color: '#202326' },
        { x: baseX - 9, y: baseY + 11, w: 7, h: 3, color: '#111316' },
        { x: baseX + 2, y: baseY + 11, w: 7, h: 3, color: '#111316' },
        { x: baseX + facing * 3, y: baseY - 8 + armY, w: facing * 16, h: 3, color: trim },
    ]);

    ctx.fillStyle = swordFlash;
    ctx.fillRect((baseX + facing * 16) * scale, (baseY - 9 + armY) * scale, facing * 34 * scale, scale);
    ctx.fillStyle = 'rgba(255, 246, 190, 0.35)';
    ctx.fillRect((baseX + facing * 34) * scale, (baseY - 10 + armY) * scale, facing * 14 * scale, scale);
};

const PixelDuelBackground: React.FC = () => {
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

    React.useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrame = 0;
        const pixelWidth = 320;
        const pixelHeight = 180;

        const resize = () => {
            const rect = canvas.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.max(1, Math.floor(rect.width * dpr));
            canvas.height = Math.max(1, Math.floor(rect.height * dpr));
        };

        const draw = (time: number) => {
            const scale = Math.max(canvas.width / pixelWidth, canvas.height / pixelHeight);
            const offsetX = (canvas.width - pixelWidth * scale) / 2;
            const offsetY = (canvas.height - pixelHeight * scale) / 2;

            ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.translate(offsetX, offsetY);

            const sky = ctx.createLinearGradient(0, 0, 0, pixelHeight * scale);
            sky.addColorStop(0, '#05090d');
            sky.addColorStop(0.48, '#0b1920');
            sky.addColorStop(1, '#06100e');
            ctx.fillStyle = sky;
            ctx.fillRect(0, 0, pixelWidth * scale, pixelHeight * scale);

            const cloudShift = (time * 0.006) % 110;
            ctx.fillStyle = 'rgba(190, 224, 216, 0.08)';
            for (let i = -1; i < 5; i++) {
                const cx = i * 92 - cloudShift;
                ctx.fillRect((cx + 12) * scale, 24 * scale, 58 * scale, 4 * scale);
                ctx.fillRect((cx + 28) * scale, 18 * scale, 48 * scale, 3 * scale);
                ctx.fillRect((cx + 4) * scale, 35 * scale, 72 * scale, 3 * scale);
            }

            drawRects(ctx, scale, [
                { x: 0, y: 108, w: 320, h: 72, color: '#07120f' },
                { x: 34, y: 64, w: 70, h: 52, color: '#16211d' },
                { x: 78, y: 50, w: 96, h: 66, color: '#111c1a' },
                { x: 150, y: 58, w: 104, h: 58, color: '#172520' },
                { x: 228, y: 72, w: 82, h: 44, color: '#111a18' },
                { x: 0, y: 118, w: 320, h: 6, color: '#1b2d24' },
                { x: 42, y: 124, w: 236, h: 9, color: '#26382a' },
                { x: 68, y: 133, w: 186, h: 8, color: '#34442f' },
                { x: 96, y: 141, w: 132, h: 7, color: '#455137' },
            ]);

            const pineSway = Math.round(Math.sin(time * 0.002) * 1);
            for (let i = 0; i < 9; i++) {
                const x = 18 + i * 36;
                const h = 22 + (i % 3) * 7;
                drawRects(ctx, scale, [
                    { x, y: 96 - h, w: 3, h, color: '#12120e' },
                    { x: x - 9 + pineSway, y: 88 - h, w: 20, h: 6, color: '#15291f' },
                    { x: x - 7 - pineSway, y: 98 - h, w: 16, h: 6, color: '#1d3328' },
                    { x: x - 5, y: 108 - h, w: 12, h: 5, color: '#223d2f' },
                ]);
            }

            ctx.fillStyle = 'rgba(244, 219, 146, 0.18)';
            const flash = Math.max(0, Math.sin(time * 0.018));
            ctx.fillRect((118 + flash * 38) * scale, 104 * scale, 72 * scale, scale);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.fillRect(146 * scale, 100 * scale, 28 * scale, scale);

            drawSwordsman(ctx, scale, 126, 116, 1, '#3b4e5a', '#8fd4d2', time);
            drawSwordsman(ctx, scale, 196, 116, -1, '#5a3030', '#e6c86e', time + 650);

            ctx.fillStyle = 'rgba(205, 241, 231, 0.12)';
            for (let i = 0; i < 18; i++) {
                const px = (i * 31 + time * 0.012) % 330 - 5;
                const py = 22 + ((i * 17 + Math.sin(time * 0.001 + i) * 9) % 78);
                ctx.fillRect(px * scale, py * scale, scale, scale);
            }

            ctx.restore();
            animationFrame = window.requestAnimationFrame(draw);
        };

        resize();
        window.addEventListener('resize', resize);
        animationFrame = window.requestAnimationFrame(draw);

        return () => {
            window.removeEventListener('resize', resize);
            window.cancelAnimationFrame(animationFrame);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full opacity-75"
        />
    );
};

export default PixelDuelBackground;
