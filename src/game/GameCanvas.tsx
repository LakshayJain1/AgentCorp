'use client';

import { useEffect, useRef, useState } from 'react';
import { pixiGame } from './pixi/PixiGameConfig';

export default function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize PixiJS once
  useEffect(() => {
    if (!containerRef.current) return;

    let mounted = true;

    const init = async () => {
      try {
        await pixiGame.initialize(containerRef.current!);
        console.log('[GameCanvas] PixiJS game created');
      } catch (err) {
        console.error('[GameCanvas] PixiJS init failed:', err);
        if (mounted) setError(String(err));
      }
    };

    init();

    return () => {
      mounted = false;
      pixiGame.destroy();
    };
  }, []);

  // ResizeObserver — handles panel toggle (hidden → visible) and sidebar open/close.
  // window.resize alone misses CSS display changes, so this is the primary resize path.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      pixiGame.resize(width, height);
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (error) {
    return (
      <div
        ref={containerRef}
        className="relative w-full h-full overflow-hidden rounded-xl border border-red-500/60 shadow-lg flex items-center justify-center bg-red-900/20 p-4"
        style={{ minHeight: 480 }}
      >
        <div className="text-center text-red-400">
          <p className="font-mono text-sm">Failed to initialize PixiJS</p>
          <pre className="mt-2 text-xs overflow-auto max-h-64">{error}</pre>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden rounded-xl border border-border/60 shadow-lg"
      style={{ minHeight: 480 }}
    />
  );
}