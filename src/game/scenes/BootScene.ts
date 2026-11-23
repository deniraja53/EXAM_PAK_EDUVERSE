import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  public create(): void {
    this.cameras.main.setRoundPixels(true);
    this.scene.start('MainMenuScene');
  }
}
