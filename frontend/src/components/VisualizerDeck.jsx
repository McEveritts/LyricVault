import React, { useEffect, useRef } from 'react';

const VisualizerDeck = ({ analyser, isPlaying, onClose, currentSong }) => {
    const canvasRef = useRef(null);
    const requestRef = useRef();
    const particlesRef = useRef([]);
    const beatStateRef = useRef({
        shortEMA: 0,
        longEMA: 0,
        lastBeat: 0,
        pulseValue: 0
    });

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !analyser) return;

        const ctx = canvas.getContext('2d');
        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;
        beatStateRef.current = { shortEMA: 0, longEMA: 0, lastBeat: 0, pulseValue: 0 };

        let prefersReducedMotion = false;
        const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const handleReducedMotionChange = () => {
            prefersReducedMotion = reducedMotionQuery.matches;
        };
        handleReducedMotionChange();
        if (typeof reducedMotionQuery.addEventListener === 'function') {
            reducedMotionQuery.addEventListener('change', handleReducedMotionChange);
        } else if (typeof reducedMotionQuery.addListener === 'function') {
            reducedMotionQuery.addListener(handleReducedMotionChange);
        }

        // Handle resize
        const handleResize = () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', handleResize);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const sampleRate = analyser.context?.sampleRate || 44100;
        const binHz = sampleRate / analyser.fftSize;
        const bassStartBin = Math.max(0, Math.floor(20 / binHz));
        const bassEndBin = Math.min(bufferLength - 1, Math.ceil(150 / binHz));
        const bassBinCount = Math.max(1, bassEndBin - bassStartBin + 1);

        // Particle system setup
        if (particlesRef.current.length === 0) {
            for (let i = 0; i < 50; i++) {
                particlesRef.current.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    vx: (Math.random() - 0.5) * 2,
                    vy: (Math.random() - 0.5) * 2,
                    size: Math.random() * 3,
                    alpha: Math.random()
                });
            }
        }

        const draw = () => {
            requestRef.current = requestAnimationFrame(draw);

            analyser.getByteFrequencyData(dataArray);

            // 1. Beat Detection Logic (Focused on Bass 20-150Hz)
            let currentBassSum = 0;
            for (let i = bassStartBin; i <= bassEndBin; i++) {
                currentBassSum += dataArray[i];
            }
            const currentBassAvg = currentBassSum / bassBinCount;

            // EMA Smoothing
            const state = beatStateRef.current;
            state.shortEMA = state.shortEMA * 0.7 + currentBassAvg * 0.3;
            state.longEMA = state.longEMA * 0.98 + currentBassAvg * 0.02;

            // Detect Beat (Short-term spike > Long-term average * threshold)
            const now = Date.now();
            const threshold = Math.max(state.longEMA * 1.3, 30); // Dynamic threshold with noise floor

            if (state.shortEMA > threshold && now - state.lastBeat > 250) {
                state.lastBeat = now;
                state.pulseValue = 1.0; // Trigger full pulse
            }

            // Pulse Decay (Exponential)
            state.pulseValue *= 0.92;
            if (state.pulseValue < 0.01) state.pulseValue = 0;

            // 2. Global "Boost" for general reactivity
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
            }
            const average = sum / bufferLength;
            const boost = average / 255;

            // Apply reduced-motion preference without per-frame media query calls.
            const effectivePulse = prefersReducedMotion ? state.pulseValue * 0.2 : state.pulseValue;

            // Background with beat pulse (classic iTunes dark bloom)
            const pulseSize = Math.max(0, width * (0.5 + boost * 0.2 + effectivePulse * 0.3));
            const bgGradient = ctx.createRadialGradient(
                width / 2, height / 2, 0,
                width / 2, height / 2, pulseSize
            );
            bgGradient.addColorStop(0, `rgba(40, 60, 100, ${0.1 + boost * 0.1 + effectivePulse * 0.3})`);
            bgGradient.addColorStop(0.6, 'rgba(10, 15, 30, 0.8)');
            bgGradient.addColorStop(1, 'rgba(0, 0, 0, 1)');

            ctx.fillStyle = bgGradient;
            ctx.fillRect(0, 0, width, height);

            // Draw Particles (Background ambience)
            particlesRef.current.forEach(p => {
                p.x += p.vx * (1 + boost + effectivePulse * 3);
                p.y += p.vy * (1 + boost + effectivePulse * 3);

                if (p.x < 0) p.x = width;
                if (p.x > width) p.x = 0;
                if (p.y < 0) p.y = height;
                if (p.y > height) p.y = 0;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * (1 + boost + effectivePulse), 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * (0.3 + effectivePulse * 0.5)})`;
                ctx.fill();
            });

            // Spectrum Bars (Mirrored)
            const barWidth = (width / bufferLength) * 2; // Wider bars
            const centerX = width / 2;
            const centerY = height / 2 + 50; // Slightly lower than center

            // Limit the bars we draw to the bass/mid frequencies mostly, top end is often empty
            const barsToDraw = Math.floor(bufferLength * 0.7);

            for (let i = 0; i < barsToDraw; i++) {
                const value = dataArray[i];
                const percent = value / 255;
                const barHeight = (percent * height * 0.4);

                // Use the Google Gold palette (Hue ~42-54)
                const hue = 42 + (percent * 12);
                const sat = 85 + (percent * 10);
                const light = 45 + (percent * 45);

                const alpha = (0.8 + effectivePulse * 0.2);
                ctx.fillStyle = `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`;

                // Draw right side
                // Main bar going UP
                const xPosRight = centerX + (i * barWidth);
                const dynamicHeight = barHeight * (1 + effectivePulse * 0.2);
                ctx.fillRect(xPosRight, centerY - dynamicHeight, barWidth - 1, dynamicHeight);

                // Reflection going DOWN (less opacity)
                ctx.fillStyle = `hsla(${hue}, ${sat}%, ${light}%, ${alpha * 0.3})`;
                ctx.fillRect(xPosRight, centerY, barWidth - 1, dynamicHeight * 0.5);

                // Draw left side (Mirror)
                // Main bar going UP
                const xPosLeft = centerX - ((i + 1) * barWidth);
                ctx.fillStyle = `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`;
                ctx.fillRect(xPosLeft, centerY - dynamicHeight, barWidth - 1, dynamicHeight);

                // Reflection going DOWN
                ctx.fillStyle = `hsla(${hue}, ${sat}%, ${light}%, ${alpha * 0.3})`;
                ctx.fillRect(xPosLeft, centerY, barWidth - 1, dynamicHeight * 0.5);
            }

            // Floor "Gloss" line
            ctx.beginPath();
            ctx.moveTo(0, centerY);
            ctx.lineTo(width, centerY);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.stroke();
        };

        if (isPlaying) {
            draw();
        } else {
            // Just clear if stopped, or could draw a static "paused" state
            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, width, height);
        }

        return () => {
            window.removeEventListener('resize', handleResize);
            if (typeof reducedMotionQuery.removeEventListener === 'function') {
                reducedMotionQuery.removeEventListener('change', handleReducedMotionChange);
            } else if (typeof reducedMotionQuery.removeListener === 'function') {
                reducedMotionQuery.removeListener(handleReducedMotionChange);
            }
            cancelAnimationFrame(requestRef.current);
        };
    }, [analyser, isPlaying]);

    // Keyboard Accessibility (Esc to close)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-[100] bg-black animate-in fade-in duration-700">
            <canvas ref={canvasRef} className="block w-full h-full" />

            {/* Overlay UI */}
            <div className="absolute top-0 left-0 w-full p-8 flex justify-between items-start opacity-0 hover:opacity-100 transition-opacity duration-500 bg-gradient-to-b from-black/80 to-transparent">
                <div className="flex flex-col">
                    {currentSong && (
                        <>
                            <h2 className="text-3xl font-bold text-white tracking-tight drop-shadow-lg">{currentSong.title}</h2>
                            <p className="text-google-gold text-xl font-medium drop-shadow-md">{currentSong.artist}</p>
                        </>
                    )}
                </div>
                <button
                    onClick={onClose}
                    className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-white transition-all border border-white/10"
                    aria-label="Close Visualizer"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Subtle controls hint if mouse is idle? (Optional, skipping for clean look) */}
        </div>
    );
};

export default VisualizerDeck;
