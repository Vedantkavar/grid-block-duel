import { useMemo } from "react";

type Props = {
  /** Hex/CSS color of the main confetti burst. */
  color: string;
  /** Number of pieces. */
  count?: number;
};

/**
 * Lightweight confetti: a fixed-position overlay full of absolutely-positioned
 * pieces, each with randomized animation params via inline CSS variables.
 * No physics, no canvas — just CSS keyframes.
 */
export default function Confetti({ color, count = 80 }: Props) {
  const pieces = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const left = Math.random() * 100; // %
      const delay = Math.random() * 0.6; // s
      const duration = 2 + Math.random() * 2.2; // s
      const drift = (Math.random() - 0.5) * 240; // px sideways
      const rotate = Math.random() * 720 - 360;
      const size = 6 + Math.random() * 8;
      const palette = [color, "#ffd166", "#ffffff", "#7be0c2"];
      const c = palette[i % palette.length];
      const shape = i % 3; // 0 = square, 1 = circle, 2 = thin rect
      return { i, left, delay, duration, drift, rotate, size, c, shape };
    });
  }, [count, color]);

  return (
    <div className="confetti" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.i}
          className={`confetti__piece confetti__piece--${p.shape}`}
          style={{
            left: `${p.left}%`,
            background: p.c,
            width: p.shape === 2 ? p.size * 0.4 : p.size,
            height: p.shape === 2 ? p.size * 1.4 : p.size,
            // CSS custom props consumed by the keyframes
            ["--drift" as never]: `${p.drift}px`,
            ["--rotate" as never]: `${p.rotate}deg`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
