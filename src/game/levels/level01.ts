import { ASSET_KEYS } from '../config/assetManifest';
import { FallingWoodPlacement } from '../entities/FallingWoodPlatform';
import { MonkeyPlacement } from '../entities/ForestMonkey';
import { QuestionBoxPlacement } from '../entities/QuestionBox';

export interface LevelPlatformPlacement {
  sheetKey: string;
  frame: string;
  x: number;
  y: number;
  depth?: number;
  scale?: number;
}

export interface LevelDecorPlacement {
  sheetKey: string;
  frame: string;
  x: number;
  y: number;
  depth?: number;
  flipX?: boolean;
  scale?: number;
  alpha?: number;
}

export interface LevelObstaclePlacement {
  id: string;
  kind: 'solid_block' | 'hazard';
  sheetKey: string;
  frame: string;
  x: number;
  y: number;
  scale?: number;
  colliderInset?: {
    topInset: number;
    bottomInset: number;
    leftInset: number;
    rightInset: number;
  };
}

export interface LevelGemPlacement {
  id: string;
  x: number;
  y: number;
  optional?: boolean;
}

export interface LevelCheckpointPlacement {
  id: string;
  name: string;
  x: number;
  y: number;
}

export interface LevelAreaZone {
  id: string;
  name: string;
  startX: number;
  endX: number;
}

export interface LevelDefinition {
  id: string;
  number: number;
  name: string;
  subtitle: string;
  worldWidth: number;
  worldHeight: number;
  spawn: { x: number; y: number };
  skyTheme: 'meadow' | 'savanna' | 'ruins';
  enemyProfile?: 'monkey' | 'scorpion';
  questionBoxTheme?: 'meadow' | 'savanna';
  unlockedByDefault: boolean;
  comingInPhase02?: boolean;
  areas: LevelAreaZone[];
  groundSegments: LevelPlatformPlacement[];
  floatingPlatforms: LevelPlatformPlacement[];
  fallingPlatforms?: FallingWoodPlacement[];
  obstacles: LevelObstaclePlacement[];
  midgroundDecorations: LevelDecorPlacement[];
  decorations: LevelDecorPlacement[];
  foregroundDecorations: LevelDecorPlacement[];
  gems: LevelGemPlacement[];
  questionBoxes?: QuestionBoxPlacement[];
  monkeys?: MonkeyPlacement[];
  checkpoints: LevelCheckpointPlacement[];
  goal: { x: number; y: number; label: string };
}

/**
 * World 01: Emerald Meadow (6400 x 720)
 * Five connected adventure areas built exclusively with the original uploaded PNG sprite sheets.
 */
export const LEVEL_01: LevelDefinition = {
  id: 'level-01',
  number: 1,
  name: 'Emerald Meadow',
  subtitle: '5 Connected Regions · Forest Entrance to Emerald Gate',
  worldWidth: 6400,
  worldHeight: 720,
  spawn: { x: 140, y: 580 },
  skyTheme: 'meadow',
  unlockedByDefault: true,
  areas: [
    { id: 'area-1', name: 'Forest Entrance', startX: 0, endX: 1200 },
    { id: 'area-2', name: 'Floating Meadow', startX: 1200, endX: 2520 },
    { id: 'area-3', name: 'Rocky Passage', startX: 2520, endX: 3920 },
    { id: 'area-4', name: 'Ancient Shrine', startX: 3920, endX: 5260 },
    { id: 'area-5', name: 'Emerald Gate', startX: 5260, endX: 6400 },
  ],
  groundSegments: [
    // AREA 1: Forest Entrance (0 .. 936) -> Bridge -> (1132 .. 1336)
    { sheetKey: ASSET_KEYS.GROUND_TILESET, frame: 'ground_wide', x: 102, y: 720 },
    { sheetKey: ASSET_KEYS.GROUND_TILESET, frame: 'ground_wide', x: 306, y: 720 },
    { sheetKey: ASSET_KEYS.GROUND_TILESET, frame: 'ground_wide', x: 510, y: 720 },
    { sheetKey: ASSET_KEYS.GROUND_TILESET, frame: 'ground_wide', x: 714, y: 720 },
    { sheetKey: ASSET_KEYS.GROUND_TILESET, frame: 'ground_med', x: 876, y: 720 },

    // AREA 2: Floating Meadow Landing & Overlook (1132 .. 1874)
    { sheetKey: ASSET_KEYS.GROUND_TILESET, frame: 'ground_wide', x: 1234, y: 720 },
    { sheetKey: ASSET_KEYS.GROUND_TILESET, frame: 'ground_roots', x: 1438, y: 720 },
    { sheetKey: ASSET_KEYS.GROUND_TILESET, frame: 'ground_wide', x: 1652, y: 720 },
    { sheetKey: ASSET_KEYS.GROUND_TILESET, frame: 'ground_med', x: 1814, y: 720 },

    // Meadow Chasm (1874 .. 2416) crossed via floating islands

    // AREA 3: Rocky Passage (2416 .. 3356) -> Chasm -> (3612 .. 3936)
    { sheetKey: ASSET_KEYS.GROUND_TILESET, frame: 'ground_wide', x: 2518, y: 720 },
    { sheetKey: ASSET_KEYS.GROUND_TILESET, frame: 'ground_wide', x: 2722, y: 720 },
    { sheetKey: ASSET_KEYS.GROUND_TILESET, frame: 'ground_tall', x: 2910, y: 720 },
    { sheetKey: ASSET_KEYS.GROUND_TILESET, frame: 'ground_wide', x: 3100, y: 720 },
    { sheetKey: ASSET_KEYS.GROUND_TILESET, frame: 'ground_mossy', x: 3278, y: 720 },
    { sheetKey: ASSET_KEYS.GROUND_TILESET, frame: 'ground_wide', x: 3715, y: 720 },
    { sheetKey: ASSET_KEYS.GROUND_TILESET, frame: 'ground_med', x: 3876, y: 720 },

    // AREA 4: Ancient Shrine Entrance (3934 .. 4314) -> Shrine Abyss -> (5148 .. 5302)
    { sheetKey: ASSET_KEYS.GROUND_TILESET, frame: 'ground_roots', x: 4048, y: 720 },
    { sheetKey: ASSET_KEYS.GROUND_TILESET, frame: 'ground_mossy', x: 4236, y: 720 },
    { sheetKey: ASSET_KEYS.GROUND_TILESET, frame: 'ground_mossy', x: 5225, y: 720 },

    // AREA 5: Emerald Gate Sanctuary (5302 .. 6442)
    { sheetKey: ASSET_KEYS.GROUND_TILESET, frame: 'ground_wide', x: 5404, y: 720 },
    { sheetKey: ASSET_KEYS.GROUND_TILESET, frame: 'ground_wide', x: 5608, y: 720 },
    { sheetKey: ASSET_KEYS.GROUND_TILESET, frame: 'ground_wide', x: 5812, y: 720 },
    { sheetKey: ASSET_KEYS.GROUND_TILESET, frame: 'ground_wide', x: 6016, y: 720 },
    { sheetKey: ASSET_KEYS.GROUND_TILESET, frame: 'ground_wide', x: 6220, y: 720 },
    { sheetKey: ASSET_KEYS.GROUND_TILESET, frame: 'ground_med', x: 6382, y: 720 },
  ],
  floatingPlatforms: [
    // Area 1: Forest Entrance step-ups & bridge
    { sheetKey: ASSET_KEYS.FLOATING_PLATFORMS, frame: 'plat_grass_sm', x: 430, y: 542 },
    { sheetKey: ASSET_KEYS.FLOATING_PLATFORMS, frame: 'plat_grass_md', x: 645, y: 452 },
    { sheetKey: ASSET_KEYS.FLOATING_PLATFORMS, frame: 'plat_grass_xs', x: 845, y: 375 },
    { sheetKey: ASSET_KEYS.FLOATING_PLATFORMS, frame: 'bridge_wood', x: 1033, y: 638 },

    // Area 2: Floating Meadow islands
    { sheetKey: ASSET_KEYS.FLOATING_PLATFORMS, frame: 'island_roots_md', x: 1540, y: 548 },
    { sheetKey: ASSET_KEYS.FLOATING_PLATFORMS, frame: 'island_vines_md', x: 1785, y: 448 },
    { sheetKey: ASSET_KEYS.FLOATING_PLATFORMS, frame: 'plat_grass_md', x: 1990, y: 565 },
    { sheetKey: ASSET_KEYS.FLOATING_PLATFORMS, frame: 'island_roots_sm', x: 2185, y: 495 },
    { sheetKey: ASSET_KEYS.FLOATING_PLATFORMS, frame: 'plat_grass_lg', x: 2315, y: 380 },
    { sheetKey: ASSET_KEYS.FLOATING_PLATFORMS, frame: 'plank_wood', x: 2360, y: 565 },

    // Area 3: Rocky Passage ledges & chasm rock
    { sheetKey: ASSET_KEYS.FLOATING_PLATFORMS, frame: 'plat_stone', x: 2980, y: 525 },
    { sheetKey: ASSET_KEYS.FLOATING_PLATFORMS, frame: 'plat_stone_moss', x: 3240, y: 450 },
    { sheetKey: ASSET_KEYS.FLOATING_PLATFORMS, frame: 'island_rock_sm', x: 3485, y: 575 },

    // Area 4: Ancient Shrine platforming gauntlet
    { sheetKey: ASSET_KEYS.FLOATING_PLATFORMS, frame: 'island_ruin_md', x: 4445, y: 560 },
    { sheetKey: ASSET_KEYS.FLOATING_PLATFORMS, frame: 'bridge_broken', x: 4650, y: 515 },
    { sheetKey: ASSET_KEYS.FLOATING_PLATFORMS, frame: 'island_stone_md', x: 4875, y: 465 },
    { sheetKey: ASSET_KEYS.FLOATING_PLATFORMS, frame: 'plat_stone', x: 4750, y: 385 },
    { sheetKey: ASSET_KEYS.FLOATING_PLATFORMS, frame: 'plat_stone_moss', x: 5065, y: 535 },

    // Area 5: Emerald Gate high approach
    { sheetKey: ASSET_KEYS.FLOATING_PLATFORMS, frame: 'island_rock_lg', x: 5608, y: 562 },
    { sheetKey: ASSET_KEYS.FLOATING_PLATFORMS, frame: 'plat_grass_lg', x: 5870, y: 445 },
  ],
  fallingPlatforms: [
    // Area 2: Optional wooden stepping plank above Floating Meadow ground
    { id: 'falling-wood-1', x: 1665, y: 500 },
    // Area 3: Wooden bridge plank spanning Rocky Passage stone platforms
    { id: 'falling-wood-2', x: 3110, y: 486 },
    // Area 4: High-route wooden plank toward optional Ancient Shrine stone ledge
    { id: 'falling-wood-3', x: 4555, y: 432 },
  ],
  obstacles: [
    {
      id: 'obs-rock-1',
      kind: 'solid_block',
      sheetKey: ASSET_KEYS.ROCK_DECOR,
      frame: 'boulder_chunky',
      x: 2780,
      y: 626,
      colliderInset: { topInset: 14, bottomInset: 4, leftInset: 18, rightInset: 18 },
    },
    {
      id: 'obs-cairn-1',
      kind: 'solid_block',
      sheetKey: ASSET_KEYS.ROCK_DECOR,
      frame: 'cairn_1',
      x: 3060,
      y: 626,
      colliderInset: { topInset: 16, bottomInset: 4, leftInset: 24, rightInset: 24 },
    },
    {
      id: 'obs-rock-2',
      kind: 'solid_block',
      sheetKey: ASSET_KEYS.ROCK_DECOR,
      frame: 'boulder_peak',
      x: 3730,
      y: 626,
      colliderInset: { topInset: 16, bottomInset: 4, leftInset: 18, rightInset: 18 },
    },
  ],
  midgroundDecorations: [
    // Secondary depth layer behind gameplay terrain/player (zero collision)
    { sheetKey: ASSET_KEYS.ROCK_DECOR, frame: 'megalith_mound', x: 180, y: 632, depth: 5, alpha: 0.92 },
    { sheetKey: ASSET_KEYS.NATURE_DECOR, frame: 'bush_lg', x: 600, y: 632, depth: 5, alpha: 0.92 },
    { sheetKey: ASSET_KEYS.NATURE_DECOR, frame: 'tree_stump', x: 1380, y: 632, depth: 5, alpha: 0.92 },
    { sheetKey: ASSET_KEYS.ROCK_DECOR, frame: 'megalith_grass', x: 2660, y: 632, depth: 5, alpha: 0.92 },
    { sheetKey: ASSET_KEYS.ROCK_DECOR, frame: 'megalith_vines', x: 3180, y: 632, depth: 5, alpha: 0.92 },
    { sheetKey: ASSET_KEYS.ROCK_DECOR, frame: 'megalith_spiral_ruin', x: 4060, y: 632, depth: 5, alpha: 0.92 },
    { sheetKey: ASSET_KEYS.NATURE_DECOR, frame: 'moss_drape_md', x: 4445, y: 540, depth: 5, alpha: 0.9 },
    { sheetKey: ASSET_KEYS.NATURE_DECOR, frame: 'bush_lg', x: 5520, y: 632, depth: 5, alpha: 0.92 },
  ],
  decorations: [
    // Area 1: Forest Entrance
    { sheetKey: ASSET_KEYS.ROCK_DECOR, frame: 'boulder_moss', x: 52, y: 626, depth: 8 },
    { sheetKey: ASSET_KEYS.NATURE_DECOR, frame: 'fern_tall', x: 95, y: 626, depth: 9 },
    { sheetKey: ASSET_KEYS.NATURE_DECOR, frame: 'flower_pair', x: 215, y: 626, depth: 9 },
    { sheetKey: ASSET_KEYS.NATURE_DECOR, frame: 'bush_md', x: 300, y: 626, depth: 8 },
    { sheetKey: ASSET_KEYS.NATURE_DECOR, frame: 'mushroom_red', x: 360, y: 626, depth: 9 },
    { sheetKey: ASSET_KEYS.NATURE_DECOR, frame: 'leaf_green', x: 470, y: 624, depth: 9 },
    { sheetKey: ASSET_KEYS.NATURE_DECOR, frame: 'grass_tuft_md', x: 530, y: 626, depth: 9 },
    { sheetKey: ASSET_KEYS.NATURE_DECOR, frame: 'pebble_group', x: 640, y: 626, depth: 9 },
    { sheetKey: ASSET_KEYS.ROCK_DECOR, frame: 'cairn_0', x: 740, y: 626, depth: 8 },
    { sheetKey: ASSET_KEYS.NATURE_DECOR, frame: 'flower_patch', x: 840, y: 626, depth: 9 },
    { sheetKey: ASSET_KEYS.NATURE_DECOR, frame: 'flower_yellow', x: 412, y: 484, depth: 9 },
    { sheetKey: ASSET_KEYS.NATURE_DECOR, frame: 'grass_tuft_sm', x: 675, y: 388, depth: 9 },
    { sheetKey: ASSET_KEYS.NATURE_DECOR, frame: 'glow_sprout_1', x: 845, y: 317, depth: 9 },

    // Area 2: Floating Meadow
    { sheetKey: ASSET_KEYS.NATURE_DECOR, frame: 'bush_flowers', x: 1255, y: 626, depth: 8 },
    { sheetKey: ASSET_KEYS.NATURE_DECOR, frame: 'roots_hang_sm', x: 1540, y: 626, depth: 7 },
    { sheetKey: ASSET_KEYS.NATURE_DECOR, frame: 'mushroom_cluster', x: 1640, y: 626, depth: 9 },
    { sheetKey: ASSET_KEYS.NATURE_DECOR, frame: 'glow_sprout_3', x: 1785, y: 360, depth: 9 },
    { sheetKey: ASSET_KEYS.NATURE_DECOR, frame: 'flower_blue', x: 2295, y: 316, depth: 9 },

    // Area 3: Rocky Passage
    { sheetKey: ASSET_KEYS.NATURE_DECOR, frame: 'fern_wide', x: 2630, y: 626, depth: 9 },
    { sheetKey: ASSET_KEYS.NATURE_DECOR, frame: 'mushroom_brown', x: 2910, y: 614, depth: 9 },
    { sheetKey: ASSET_KEYS.NATURE_DECOR, frame: 'grass_golden', x: 3255, y: 608, depth: 9 },
    { sheetKey: ASSET_KEYS.NATURE_DECOR, frame: 'mushroom_amber', x: 3320, y: 608, depth: 9 },
    { sheetKey: ASSET_KEYS.NATURE_DECOR, frame: 'leaf_autumn', x: 3660, y: 624, depth: 9 },
    { sheetKey: ASSET_KEYS.ROCK_DECOR, frame: 'cairn_rubble', x: 3835, y: 626, depth: 8 },

    // Area 4: Ancient Shrine
    { sheetKey: ASSET_KEYS.ROCK_DECOR, frame: 'rune_spiral', x: 3990, y: 626, depth: 8 },
    { sheetKey: ASSET_KEYS.NATURE_DECOR, frame: 'glow_sprout_1', x: 4160, y: 608, depth: 9 },
    { sheetKey: ASSET_KEYS.ROCK_DECOR, frame: 'cairn_moss', x: 5225, y: 608, depth: 8 },

    // Area 5: Emerald Gate
    { sheetKey: ASSET_KEYS.NATURE_DECOR, frame: 'log_fallen', x: 5380, y: 626, depth: 8 },
    { sheetKey: ASSET_KEYS.NATURE_DECOR, frame: 'bush_berries', x: 5720, y: 626, depth: 8 },
    { sheetKey: ASSET_KEYS.NATURE_DECOR, frame: 'flower_patch', x: 5930, y: 626, depth: 9 },
    { sheetKey: ASSET_KEYS.ROCK_DECOR, frame: 'crystal_cluster', x: 6055, y: 626, depth: 9 },
    { sheetKey: ASSET_KEYS.ROCK_DECOR, frame: 'rune_obelisk', x: 6105, y: 626, depth: 8 },
    { sheetKey: ASSET_KEYS.ROCK_DECOR, frame: 'megalith_spiral_ruin', x: 6180, y: 628, depth: 8 },
    { sheetKey: ASSET_KEYS.ROCK_DECOR, frame: 'rune_obelisk', x: 6255, y: 626, depth: 8 },
    { sheetKey: ASSET_KEYS.ROCK_DECOR, frame: 'crystal_cluster', x: 6305, y: 626, depth: 9 },
  ],
  foregroundDecorations: [
    // Low-profile foreground elements framing bottom soil without obstructing visibility
    { sheetKey: ASSET_KEYS.NATURE_DECOR, frame: 'grass_tuft_sm', x: 165, y: 718, depth: 25 },
    { sheetKey: ASSET_KEYS.NATURE_DECOR, frame: 'flower_red', x: 590, y: 718, depth: 25 },
    { sheetKey: ASSET_KEYS.ROCK_DECOR, frame: 'scatter_0', x: 1470, y: 718, depth: 25 },
    { sheetKey: ASSET_KEYS.ROCK_DECOR, frame: 'scatter_2', x: 2850, y: 718, depth: 25 },
    { sheetKey: ASSET_KEYS.NATURE_DECOR, frame: 'vine_strip', x: 4230, y: 718, depth: 25 },
    { sheetKey: ASSET_KEYS.NATURE_DECOR, frame: 'grass_tuft_lg', x: 5980, y: 718, depth: 25 },
  ],
  gems: [],
  questionBoxes: [
    // Well-spaced exploration Question Boxes (width 35px; min horizontal gap >= 228px across all 5 areas)
    // Area 1: Forest Entrance (2 boxes)
    { id: 'qbox-1', questionId: 'q-1', x: 430, y: 506 },
    { id: 'qbox-2', questionId: 'q-2', x: 845, y: 339 },

    // Area 2: Floating Meadow (3 boxes)
    { id: 'qbox-3', questionId: 'q-3', x: 1300, y: 615 },
    { id: 'qbox-4', questionId: 'q-4', x: 1785, y: 398 },
    { id: 'qbox-5', questionId: 'q-5', x: 2315, y: 342 },

    // Area 3: Rocky Passage (3 boxes)
    { id: 'qbox-6', questionId: 'q-6', x: 2780, y: 557 },
    { id: 'qbox-7', questionId: 'q-7', x: 3240, y: 408 },
    { id: 'qbox-8', questionId: 'q-8', x: 3730, y: 552 },

    // Area 4: Ancient Shrine (3 boxes)
    { id: 'qbox-9', questionId: 'q-9', x: 3985, y: 613 },
    { id: 'qbox-10', questionId: 'q-10', x: 4445, y: 496 },
    { id: 'qbox-11', questionId: 'q-11', x: 5065, y: 493 },

    // Area 5: Emerald Gate (3 boxes)
    { id: 'qbox-12', questionId: 'q-12', x: 5380, y: 615 },
    { id: 'qbox-13', questionId: 'q-13', x: 5608, y: 493 },
    { id: 'qbox-14', questionId: 'q-14', x: 5930, y: 407 },
  ],
  monkeys: [
    // Area 1: Open unobstructed ground ahead of step-up platforms for clean head-stomp engagement
    { id: 'monkey-1', x: 305, y: 627, patrolMinX: 265, patrolMaxX: 342 },
    // Area 2: Guards Floating Meadow ground (qbox-3 / qbox-4) & chasm island approach (qbox-5)
    { id: 'monkey-2', x: 1620, y: 627, patrolMinX: 1450, patrolMaxX: 1820 },
    { id: 'monkey-3', x: 1990, y: 539, patrolMinX: 1935, patrolMaxX: 2045 },
    // Area 3: Guards Rocky Passage mossy terrace (qbox-7) & east boulder terrace (qbox-8)
    { id: 'monkey-4', x: 3275, y: 608, patrolMinX: 3225, patrolMaxX: 3330 },
    { id: 'monkey-5', x: 3845, y: 626, patrolMinX: 3795, patrolMaxX: 3915 },
    // Area 4: Guards Ancient Shrine entrance (qbox-9) & mid-chasm stone island (qbox-10 / qbox-11)
    { id: 'monkey-6', x: 4095, y: 625, patrolMinX: 4045, patrolMaxX: 4145 },
    { id: 'monkey-7', x: 4875, y: 432, patrolMinX: 4815, patrolMaxX: 4935 },
    // Area 5: Guards Emerald Gate approach below floating route (qbox-12..14)
    { id: 'monkey-8', x: 5720, y: 627, patrolMinX: 5530, patrolMaxX: 5900 },
  ],
  checkpoints: [
    { id: 'cp-1', name: 'Rocky Passage', x: 2560, y: 622 },
    { id: 'cp-2', name: 'Ancient Shrine', x: 4236, y: 608 },
  ],
  goal: {
    x: 6180,
    y: 622,
    label: 'Emerald Gate',
  },
};
