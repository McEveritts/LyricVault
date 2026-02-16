import { createEffect, onCleanup, Show } from "solid-js";

type Props = {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  open: boolean;
  title?: string;
  artist?: string;
  onClose: () => void;
};

export default function VisualizerDeck(props: Props) {
  let canvasRef: HTMLCanvasElement | undefined;
  let raf = 0;

  createEffect(() => {
    if (!props.open) return;
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKeydown);
    onCleanup(() => window.removeEventListener("keydown", onKeydown));
  });

  createEffect(() => {
    if (!props.open) return;
    const canvas = canvasRef;
    const analyser = props.analyser;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const data = new Uint8Array(analyser.frequencyBinCount);
    const drawWave = (
      width: number,
      height: number,
      time: number,
      color: string,
      amplitude: number,
      frequency: number,
      offset: number,
      thickness: number,
      energyFactor: number,
    ) => {
      const centerY = height / 2;
      ctx.beginPath();
      ctx.lineWidth = thickness + energyFactor * 4;
      ctx.strokeStyle = color;
      for (let x = 0; x <= width; x += 5) {
        const normalizedX = x / width;
        const wave1 = Math.sin(normalizedX * frequency + time + offset);
        const wave2 = Math.sin(normalizedX * (frequency * 1.5) - time * 0.8 + offset);
        const envelope = Math.sin(normalizedX * Math.PI);
        const y = centerY + (wave1 + wave2) * amplitude * envelope * (1 + energyFactor * 2.5);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    const render = () => {
      raf = requestAnimationFrame(render);
      const width = canvas.width;
      const height = canvas.height;
      ctx.fillStyle = "rgba(10, 10, 12, 0.15)";
      ctx.fillRect(0, 0, width, height);

      if (!props.isPlaying) return;
      analyser.getByteFrequencyData(data);

      let energy = 0;
      const range = Math.floor(data.length * 0.4);
      for (let i = 0; i < range; i += 1) energy += data[i];
      energy /= Math.max(1, range);
      const energyFactor = energy / 255;

      const glowSize = height * (0.3 + energyFactor * 0.4);
      const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, glowSize);
      gradient.addColorStop(0, `rgba(234, 179, 8, ${0.05 + energyFactor * 0.1})`);
      gradient.addColorStop(1, "rgba(10, 10, 12, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      ctx.globalCompositeOperation = "lighter";
      const time = Date.now() * 0.001;
      drawWave(width, height, time, "rgba(234, 179, 8, 0.4)", height * 0.15, 3, time, 2, energyFactor);
      drawWave(
        width,
        height,
        time,
        "rgba(255, 255, 255, 0.15)",
        height * 0.1,
        4,
        time * 1.2,
        1,
        energyFactor,
      );
      drawWave(
        width,
        height,
        time,
        "rgba(202, 138, 4, 0.2)",
        height * 0.12,
        2.5,
        time * 0.7,
        3,
        energyFactor,
      );
      drawWave(
        width,
        height,
        time,
        "rgba(250, 204, 21, 0.1)",
        height * 0.2,
        2,
        -time * 0.5,
        1,
        energyFactor,
      );
      ctx.globalCompositeOperation = "source-over";
    };

    render();
    onCleanup(() => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    });
  });

  return (
    <Show when={props.open}>
      <div class="viz-deck">
        <canvas ref={canvasRef} class="viz-canvas" />
        <div class="viz-overlay">
          <div class="viz-head">
            <div>
              <span class="viz-chip">Now Playing</span>
              <h2>{props.title ?? "Unknown Track"}</h2>
              <p>{props.artist ?? "Unknown Artist"}</p>
            </div>
            <button class="viz-close" onClick={props.onClose} aria-label="Close visualizer">
              X
            </button>
          </div>
          <div class="viz-foot">Aura Visualizer Engine</div>
        </div>
      </div>
    </Show>
  );
}
