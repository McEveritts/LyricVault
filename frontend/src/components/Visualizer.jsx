import React, { useRef, useEffect } from 'react';

const Visualizer = ({ analyser, isPlaying, width = 200, height = 40 }) => {
    const canvasRef = useRef(null);
    const requestRef = useRef();

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !analyser) return;

        const ctx = canvas.getContext('2d');
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            if (!isPlaying) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                requestRef.current = requestAnimationFrame(draw);
                return;
            }

            requestRef.current = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const barWidth = (canvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                barHeight = (dataArray[i] / 255) * canvas.height;

                const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
                gradient.addColorStop(0, '#E3E3E3');
                gradient.addColorStop(1, '#FFD700');

                ctx.fillStyle = gradient;
                ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

                x += barWidth + 1;
                if (x > canvas.width) break;
            }
        };

        requestRef.current = requestAnimationFrame(draw);

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
            className="opacity-50 pointer-events-none"
        />
    );
};

export default Visualizer;
