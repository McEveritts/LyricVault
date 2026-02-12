import React, { useEffect, useRef } from 'react';

const VisualizerDeck = ({ analyser, isPlaying, onClose, currentSong }) => {
    const canvasRef = useRef(null);
    const requestRef = useRef();

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !analyser) return;

        const ctx = canvas.getContext('2d');
        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;

        // Handle resize
        const handleResize = () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', handleResize);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        // Quality check for transitions
        let opacity = 0;
        const fadeIn = () => {
            if (opacity < 1) {
                opacity += 0.02;
                setTimeout(fadeIn, 16);
            }
        };
        fadeIn();

        const draw = () => {
            requestRef.current = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);

            // 1. Clear with deep fade
            ctx.fillStyle = 'rgba(10, 10, 12, 0.15)';
            ctx.fillRect(0, 0, width, height);

            // 2. Global "Energy" calculation
            let energy = 0;
            const energyRange = Math.floor(bufferLength * 0.4);
            for (let i = 0; i < energyRange; i++) {
                energy += dataArray[i];
            }
            energy /= energyRange;
            const energyFactor = energy / 255;

            // 3. Draw Fluid "Aura" Waves
            const time = Date.now() * 0.001;
            const centerY = height / 2;

            // Draw multiple overlapping waves for "fluid" effect
            const drawWave = (color, amplitude, frequency, offset, thickness) => {
                ctx.beginPath();
                ctx.lineWidth = thickness + (energyFactor * 4);
                ctx.strokeStyle = color;

                for (let x = 0; x <= width; x += 5) {
                    const normalizedX = x / width;
                    // Organic noise-like wave combining sine waves
                    const wave1 = Math.sin(normalizedX * frequency + time + offset);
                    const wave2 = Math.sin(normalizedX * (frequency * 1.5) - time * 0.8 + offset);
                    const envelope = Math.sin(normalizedX * Math.PI); // Taper at edges

                    const y = centerY + (wave1 + wave2) * amplitude * envelope * (1 + energyFactor * 2.5);

                    if (x === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.stroke();
            };

            // Deep background glow
            const glowSize = height * (0.3 + energyFactor * 0.4);
            const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, glowSize);
            gradient.addColorStop(0, `rgba(226, 194, 134, ${0.05 + energyFactor * 0.1})`);
            gradient.addColorStop(1, 'rgba(10, 10, 12, 0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);

            ctx.globalCompositeOperation = 'lighter';

            // The "Aura" - Multiple semi-transparent waves
            drawWave('rgba(226, 194, 134, 0.4)', height * 0.15, 3, time, 2);
            drawWave('rgba(255, 255, 255, 0.15)', height * 0.1, 4, time * 1.2, 1);
            drawWave('rgba(196, 164, 104, 0.2)', height * 0.12, 2.5, time * 0.7, 3);
            drawWave('rgba(244, 224, 184, 0.1)', height * 0.2, 2, -time * 0.5, 1);

            ctx.globalCompositeOperation = 'source-over';
        };

        if (isPlaying) {
            draw();
        } else {
            ctx.fillStyle = '#0a0a0c';
            ctx.fillRect(0, 0, width, height);
        }

        return () => {
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(requestRef.current);
        };
    }, [analyser, isPlaying]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-[100] bg-[#0a0a0c] animate-in fade-in duration-700">
            <canvas ref={canvasRef} className="block w-full h-full" />

            {/* Premium UI Overlay */}
            <div className="absolute inset-0 flex flex-col justify-between p-12 pointer-events-none">
                <div className="flex justify-between items-start pointer-events-auto">
                    <div className="flex flex-col gap-1">
                        <span className="text-google-gold text-[10px] font-black uppercase tracking-[0.3em] opacity-60">Now Playing</span>
                        {currentSong && (
                            <>
                                <h2 className="text-5xl font-bold text-white tracking-tighter drop-shadow-2xl">{currentSong.title}</h2>
                                <p className="text-google-gold/80 text-2xl font-medium tracking-tight mt-1">{currentSong.artist}</p>
                            </>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="w-14 h-14 rounded-full bg-white/5 hover:bg-white/10 backdrop-blur-xl flex items-center justify-center text-white transition-all border border-white/10 group active:scale-90"
                        aria-label="Close Visualizer"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6 group-hover:rotate-90 transition-transform">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex flex-col items-center gap-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-google-gold animate-ping"></div>
                    <span className="text-[10px] font-black tracking-[0.4em] text-white/20 uppercase">AURA VISUALIZER ENGINE</span>
                </div>
            </div>
        </div>
    );
};

export default VisualizerDeck;
