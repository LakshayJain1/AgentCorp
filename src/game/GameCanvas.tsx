'use client';

import { useEffect, useRef, useState } from 'react';
import { PixiGame } from './pixi/PixiGameConfig';
import OfficeFallback from './OfficeFallback';

/**
 * The office is mounted only while the Office tab is open (see CenterPanel), so
 * a WebGL context exists only when someone is actually looking at it. If the
 * renderer cannot start we show a roster fallback instead of an error box; the
 * agents keep working because the engine does not depend on this component.
 *
 * Each canvas owns its own PixiGame, and initialization waits until the
 * container has a real size: the centre panel is also rendered in a hidden
 * (display:none) layout, which must never spin up a renderer.
 */
export default function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const game = new PixiGame();
    let started = false;
    let cancelled = false;

    const start = () => {
      started = true;
      game.initialize(el).then(
        () => { if (!cancelled) console.log('[GameCanvas] office ready'); },
        (err) => {
          console.error('[GameCanvas] office init failed:', err);
          if (!cancelled) setError(err instanceof Error ? err.message : String(err));
        },
      );
    };

    // First non-zero size starts the renderer; later sizes resize it.
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (cancelled || width <= 0 || height <= 0) return;
      if (!started) start();
      else game.resize(width, height);
    });
    ro.observe(el);

    return () => {
      cancelled = true;
      ro.disconnect();
      game.destroy();
    };
  }, [attempt]);

  if (error) {
    return <OfficeFallback error={error} onRetry={() => { setError(null); setAttempt((n) => n + 1); }} />;
  }

  return (
    <div
      ref={containerRef}
      data-testid="office-canvas"
      className="relative w-full h-full overflow-hidden rounded-2xl border border-navy/10 bg-[#0a0a1e] shadow-md ring-1 ring-black/5"
      style={{ minHeight: 480 }}
    />
  );
}
