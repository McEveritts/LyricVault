import { createEffect, onCleanup } from "solid-js";

type Props = {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  width?: number;
  height?: number;
};

export default function Visualizer(props: Props) {
  let canvasRef: HTMLCanvasElement | undefined;
  let raf = 0;

  createEffect(() => {
    const canvas = canvasRef;
    const analyser = props.analyser;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const data = new Uint8Array(bufferLength);

    const draw = () => {
      raf = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!props.isPlaying) return;

      analyser.getByteFrequencyData(data);
      const bars = Math.min(48, Math.floor(bufferLength * 0.65));
      const centerX = canvas.width / 2;
      const barWidth = Math.max(1.5, canvas.width / (bars * 2));
      const baseY = canvas.height;

      for (let i = 0; i < bars; i += 1) {
        const value = data[i] || 0;
        const percent = value / 255;
        const barHeight = Math.max(2, percent * canvas.height);
        const hue = 42 + percent * 12;
        const sat = 84 + percent * 12;
        const light = 42 + percent * 44;
        const alpha = 0.2 + percent * 0.8;
        ctx.fillStyle = `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`;

        const xLeft = centerX - (i + 1) * barWidth;
        const xRight = centerX + i * barWidth;
        const y = baseY - barHeight;
        const w = Math.max(1, barWidth - 1);
        ctx.fillRect(xLeft, y, w, barHeight);
        ctx.fillRect(xRight, y, w, barHeight);
      }
    };

    draw();
    onCleanup(() => {
      if (raf) cancelAnimationFrame(raf);
    });
  });

  return (
    <canvas
      ref={canvasRef}
      width={props.width ?? 200}
      height={props.height ?? 40}
      class="viz-compact"
    />
  );
}
