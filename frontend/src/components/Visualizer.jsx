import React, { useEffect, useRef } from 'react';

const Visualizer = ({ analyser, isPlaying, width = 200, height = 40 }) => {
    const canvasRef = useRef(null);
    const requestRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !analyser) return undefined;

        const ctx = canvas.getContext('2d');
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            requestRef.current = requestAnimationFrame(draw);
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (!isPlaying) return;

            analyser.getByteFrequencyData(dataArray);
            const bars = Math.min(48, Math.floor(bufferLength * 0.65));
            const centerX = canvas.width / 2;
            const barWidth = Math.max(1.5, canvas.width / (bars * 2));
            const baseY = canvas.height;

            for (let i = 0; i < bars; i += 1) {
                const value = dataArray[i] || 0;
                const percent = value / 255;
                const barHeight = Math.max(2, percent * canvas.height);

                const hue = 42 + (percent * 12);
                const sat = 84 + (percent * 12);
                const light = 42 + (percent * 44);
                const alpha = 0.2 + (percent * 0.8);
                ctx.fillStyle = `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`;

                const xLeft = centerX - (i + 1) * barWidth;
                const xRight = centerX + (i * barWidth);
                const y = baseY - barHeight;
                const w = Math.max(1, barWidth - 1);

                ctx.fillRect(xLeft, y, w, barHeight);
                ctx.fillRect(xRight, y, w, barHeight);
            }
        };

        draw();
        return () => {
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current);
            }
        };
    }, [analyser, isPlaying]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="opacity-70 pointer-events-none"
        />
    );
};

export default Visualizer;
