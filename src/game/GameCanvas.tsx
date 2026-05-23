'use client';

import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { GameScene } from './GameScene';

export default function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 560,
      height: 400,
      parent: containerRef.current,
      backgroundColor: '#0a0a1e',
      scene: [GameScene],
      pixelArt: true,
      antialias: false,
      roundPixels: true,
      autoFocus: false,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      input: {
        mouse: {
          preventDefaultDown: true,
          preventDefaultUp: true,
        },
      },
      fps: {
        target: 60,
        forceSetTimeOut: false,
      },
    };

    try {
      gameRef.current = new Phaser.Game(config);
      console.log('[GameCanvas] Phaser game created');
    } catch (err) {
      console.error('[GameCanvas] Phaser init failed:', err);
    }

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden rounded-xl border border-border/60 shadow-lg"
      style={{ imageRendering: 'pixelated', minHeight: 400 }}
    />
  );
}
