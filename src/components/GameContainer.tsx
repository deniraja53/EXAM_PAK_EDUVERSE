import Phaser from 'phaser';
import { useEffect, useRef } from 'react';
import { createPhaserGameConfig } from '../game/config/gameConfig';

interface GameContainerProps {
  onCanvasReady?: () => void;
}

/**
 * Isolated Phaser 3 mount container.
 * Keeps React state updates completely decoupled from the 60fps Phaser simulation loop
 * and preserves the 16:9 landscape aspect ratio cleanly inside any viewport.
 */
export function GameContainer({ onCanvasReady }: GameContainerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    const container = hostRef.current;
    if (!container || gameRef.current) return;

    const config = createPhaserGameConfig(container);
    const game = new Phaser.Game(config);
    gameRef.current = game;
    onCanvasReady?.();

    return () => {
      game.destroy(true);
      gameRef.current = null;
    };
  }, [onCanvasReady]);

  return (
    <div
      ref={hostRef}
      className="h-full w-full overflow-hidden bg-[#070d18]"
      aria-label="EXAM EDUVERSE Game Canvas"
    />
  );
}
