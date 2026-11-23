import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { MainMenuScene } from '../scenes/MainMenuScene';
import { PreloadScene } from '../scenes/PreloadScene';
import { WorldScene } from '../scenes/WorldScene';
import { GAME_HEIGHT, GAME_WIDTH, WORLD_SPRITE_SCALE } from './constants';
import { PLAYER_PHYSICS } from './physicsConfig';

export { GAME_HEIGHT, GAME_WIDTH, WORLD_SPRITE_SCALE };

export function createPhaserGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#132a4f',
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    loader: {
      imageLoadType: 'HTMLImageElement',
      crossOrigin: null as unknown as undefined,
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: PLAYER_PHYSICS.gravityY },
        debug: false,
      },
    },
    scene: [BootScene, PreloadScene, MainMenuScene, WorldScene],
  };
}
