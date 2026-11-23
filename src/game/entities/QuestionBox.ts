import Phaser from 'phaser';
import { ASSET_KEYS } from '../config/assetManifest';
import { getLevel01Question } from '../data/level01Questions';
import { getLevel02Question } from '../data/level02Questions';
import { AudioSystem } from '../systems/AudioSystem';
import { ENTITY_TEXTURE_KEYS } from '../systems/PixelArtEntities';
import { QuizQuestion } from '../types/gameTypes';

export interface QuestionBoxPlacement {
  id: string;
  questionId: string;
  x: number;
  y: number;
}

export interface QuestionBoxSpriteConfig {
  sheetKey: string;
  idleFrame: string;
  activeFrame: string;
  usedFrame: string;
}

interface QuestionBoxNode {
  id: string;
  questionId: string;
  baseBottomY: number;
  sprite: Phaser.Physics.Arcade.Sprite;
  idleTween?: Phaser.Tweens.Tween;
  used: boolean;
}

const QBOX_SCALE = 0.25;

/**
 * Interactive pixel-art Question Box collectibles using box_pertanyaan_fe411d66.png (Stage 1)
 * or stage-configured crate sprites (Stage 2 Savanna crates).
 */
export class QuestionBoxManager {
  private readonly scene: Phaser.Scene;
  private readonly spriteConfig: QuestionBoxSpriteConfig;
  private readonly useSpriteSheet: boolean;
  private readonly group: Phaser.Physics.Arcade.Group;
  private readonly nodes: QuestionBoxNode[] = [];
  private readonly dustEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly questionResolver?: (
    boxId: string,
    defaultQuestionId: string
  ) => QuizQuestion | null;

  constructor(
    scene: Phaser.Scene,
    placements: QuestionBoxPlacement[],
    dustEmitter?: Phaser.GameObjects.Particles.ParticleEmitter,
    questionResolver?: (boxId: string, defaultQuestionId: string) => QuizQuestion | null,
    spriteConfig?: QuestionBoxSpriteConfig
  ) {
    this.scene = scene;
    this.dustEmitter = dustEmitter;
    this.questionResolver = questionResolver;
    this.spriteConfig = spriteConfig ?? {
      sheetKey: ASSET_KEYS.QUESTION_BOX,
      idleFrame: 'qbox_idle',
      activeFrame: 'qbox_active',
      usedFrame: 'qbox_used',
    };
    this.useSpriteSheet = scene.textures.exists(this.spriteConfig.sheetKey);
    if (this.useSpriteSheet) {
      scene.textures
        .get(this.spriteConfig.sheetKey)
        .setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.group = scene.physics.add.group({
      allowGravity: false,
      immovable: true,
    });

    placements.forEach((p, idx) => this.createBox(p, idx));
  }

  private createBox(placement: QuestionBoxPlacement, idx: number): void {
    // Bottom-aligned y so idle/active/used frames never shift crate base vertically
    const baseBottomY = Math.round(placement.y);

    const sprite = this.useSpriteSheet
      ? (this.group.create(
          Math.round(placement.x),
          baseBottomY,
          this.spriteConfig.sheetKey,
          this.spriteConfig.idleFrame
        ) as Phaser.Physics.Arcade.Sprite)
      : (this.group.create(
          Math.round(placement.x),
          baseBottomY,
          ENTITY_TEXTURE_KEYS.QBOX_IDLE
        ) as Phaser.Physics.Arcade.Sprite);

    sprite.setScale(this.useSpriteSheet ? QBOX_SCALE : 1.4);
    sprite.setOrigin(0.5, 1);
    sprite.setDepth(22);

    const body = sprite.body as Phaser.Physics.Arcade.Body;
    if (this.useSpriteSheet) {
      const bw = 124;
      const bh = 124;
      body.setSize(bw, bh, false);
      body.setOffset((sprite.frame.width - bw) * 0.5, sprite.frame.height - bh - 4);
    } else {
      body.setSize(20, 20, true);
    }

    const idleTween = this.scene.tweens.add({
      targets: sprite,
      y: baseBottomY - 5,
      duration: 920,
      delay: (idx % 6) * 110,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const node: QuestionBoxNode = {
      id: placement.id,
      questionId: placement.questionId,
      baseBottomY,
      sprite,
      idleTween,
      used: false,
    };

    sprite.setData('questionBoxNode', node);
    this.nodes.push(node);
  }

  public getGroup(): Phaser.Physics.Arcade.Group {
    return this.group;
  }

  public tryActivate(
    sprite: Phaser.Physics.Arcade.Sprite
  ): { boxId: string; question: QuizQuestion | null } | null {
    const node = sprite.getData('questionBoxNode') as QuestionBoxNode | undefined;
    if (!node || node.used) return null;

    node.used = true;
    node.idleTween?.stop();
    node.sprite.setY(node.baseBottomY);

    if (this.useSpriteSheet) {
      node.sprite.setFrame(this.spriteConfig.activeFrame);
    } else {
      node.sprite.setTexture(ENTITY_TEXTURE_KEYS.QBOX_ACTIVE);
    }

    AudioSystem.playCheckpoint();
    if (this.dustEmitter) {
      this.dustEmitter.explode(10, node.sprite.x, node.baseBottomY - 24);
    }

    this.scene.tweens.add({
      targets: node.sprite,
      y: node.baseBottomY - 14,
      duration: 140,
      yoyo: true,
      ease: 'Back.easeOut',
      onComplete: () => {
        if (!node.sprite.scene) return;
        node.sprite.setY(node.baseBottomY);
        if (this.useSpriteSheet) {
          node.sprite.setFrame(this.spriteConfig.usedFrame);
        } else {
          node.sprite.setTexture(ENTITY_TEXTURE_KEYS.QBOX_USED);
        }
      },
    });

    const question = this.questionResolver
      ? this.questionResolver(node.id, node.questionId)
      : node.questionId.startsWith('s2-')
        ? getLevel02Question(node.questionId)
        : getLevel01Question(node.questionId);

    return {
      boxId: node.id,
      question,
    };
  }

  public destroy(): void {
    for (const node of this.nodes) {
      node.idleTween?.stop();
      if (node.sprite.scene) {
        node.sprite.destroy();
      }
    }
    this.nodes.length = 0;
  }
}
