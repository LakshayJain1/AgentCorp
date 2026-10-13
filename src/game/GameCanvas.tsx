'use client';

import { useEffect, useRef, useState } from 'react';
import { pixiGame } from './pixi/PixiGameConfig';

export default function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

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