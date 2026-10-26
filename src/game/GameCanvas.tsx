'use client';

import { useEffect, useRef, useState } from 'react';
import { pixiGame } from './pixi/PixiGameConfig';
import { useGameStore } from '@/store/gameStore';

export default function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const centerView = useGameStore((s) => s.centerView);

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
      if (width > 0 && height > 0) {
        pixiGame.resize(width, height);
      }
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // When switching to 'office' tab, trigger resize on next animation frame to ensure correct bounds
  useEffect(() => {
    if (centerView === 'office' && containerRef.current) {
      const el = containerRef.current;
      requestAnimationFrame(() => {
        const { clientWidth, clientHeight } = el;
        if (clientWidth > 0 && clientHeight > 0) {
          pixiGame.resize(clientWidth, clientHeight);
        }
      });
    }
  }, [centerView]);

  if (error) {
    return (
      <div
        ref={containerRef}
        className="relative w-full h-full overflow-hidden rounded-2xl border border-red-500/40 shadow-lg flex items-center justify-center bg-red-950/20 p-4"
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
      className="relative w-full h-full overflow-hidden rounded-2xl border border-navy/10 bg-[#0a0a1e] shadow-md ring-1 ring-black/5"
      style={{ minHeight: 480 }}
    />
  );
}