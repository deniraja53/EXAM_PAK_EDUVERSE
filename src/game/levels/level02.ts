import { ASSET_KEYS } from '../config/assetManifest';
import { LevelDefinition } from './level01';

/**
 * STAGE 2: SAVANNA SUNLAND (7200 x 720)
 * Warm, expansive open savanna adventure across 5 connected regions featuring
 * multi-tiered platforms, vertical ladder shafts, wooden rope bridges, sandstone boulders,
 * acacia trees, armored savanna scorpions, 14 Question Boxes, 2 Checkpoints, and the Stage 3 Exit Gate.
 * Built exclusively from the 6 Stage 2 PNG sprite sheets in /public/stage2/.
 */
export const LEVEL_02: LevelDefinition = {
  id: 'level-02',
  number: 2,
  name: 'Savanna Sunland',
  subtitle: '5 Regions · Acacia Terraces, Rope Bridges & Stage 3 Gate',
  worldWidth: 7200,
  worldHeight: 720,
  spawn: { x: 140, y: 580 },
  skyTheme: 'savanna',
  enemyProfile: 'scorpion',
  questionBoxTheme: 'savanna',
  unlockedByDefault: true,
  areas: [
    { id: 's2-area-1', name: 'Sunlit Savanna Gate', startX: 0, endX: 1420 },
    { id: 's2-area-2', name: 'Acacia Terrace', startX: 1420, endX: 2920 },
    { id: 's2-area-3', name: 'Rope Bridge Crossing', startX: 2920, endX: 4410 },
    { id: 's2-area-4', name: 'Sandstone Mesa', startX: 4410, endX: 5900 },
    { id: 's2-area-5', name: 'Horizon Outpost · Stage 3 Gate', startX: 5900, endX: 7200 },
  ],
  groundSegments: [
    // AREA 1: Sunlit Savanna Gate (0 .. 997) -> Canyon Pit -> (1142 .. 1436)
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_g_left', x: 58, y: 674 },
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_g_long', x: 263, y: 674 },
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_g_mid_a', x: 498, y: 674 },
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_g_long', x: 733, y: 674 },
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_g_right', x: 938, y: 674 },

    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_g_left', x: 1200, y: 674 },
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_g_mid_b', x: 1347, y: 674 },

    // AREA 2: Acacia Terrace Lower Floor (1436 .. 2318) -> Gap -> (2450 .. 2921)
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_g_long', x: 1583, y: 674 },
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_g_mid_a', x: 1818, y: 674 },
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_g_long', x: 2054, y: 674 },
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_g_right', x: 2259, y: 674 },

    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_g_left', x: 2508, y: 674 },
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_g_long', x: 2714, y: 674 },
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_g_right', x: 2863, y: 674 },

    // AREA 3: Wide Savanna Canyon crossed via Wooden Rope Bridges & Center Island (no floor)

    // AREA 4: Sandstone Mesa Landing (4410 .. 4997) -> Raised Savanna Ridge (5000 .. 5409)
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_g_left', x: 4468, y: 674 },
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_g_long', x: 4673, y: 674 },
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_g_mid_b', x: 4908, y: 674 },
    // Raised Savanna Ridge (surface y = 570)
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_g_long', x: 5145, y: 612 },
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_g_right', x: 5350, y: 612 },

    // AREA 5: Horizon Outpost Sanctuary to Stage 3 Gate (5910 .. 7200)
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_g_left', x: 5968, y: 674 },
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_g_long', x: 6173, y: 674 },
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_g_mid_a', x: 6408, y: 674 },
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_g_long', x: 6643, y: 674 },
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_g_long', x: 6937, y: 674 },
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_g_right', x: 7142, y: 674 },
  ],
  floatingPlatforms: [
    // AREA 1: Tiered savanna grass platforms (clear >= 116px above ground) + canyon stepping island
    { sheetKey: ASSET_KEYS.STAGE2_PLATFORMS, frame: 's2_plat_grass_md', x: 435, y: 492 },
    { sheetKey: ASSET_KEYS.STAGE2_PLATFORMS, frame: 's2_plat_grass_xs', x: 640, y: 422 },
    { sheetKey: ASSET_KEYS.STAGE2_PLATFORMS, frame: 's2_plat_grass_md', x: 835, y: 365 },
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_float_md', x: 1070, y: 565 },

    // AREA 2: Acacia Terrace Upper Tiers (clear >= 115px above lower floor)
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_float_sm', x: 1490, y: 494 },
    { sheetKey: ASSET_KEYS.STAGE2_PLATFORMS, frame: 's2_plat_sand_lg', x: 1690, y: 478 },
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_float_md', x: 1895, y: 392 },
    { sheetKey: ASSET_KEYS.STAGE2_PLATFORMS, frame: 's2_plat_grass_xl', x: 2180, y: 342 },
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_float_lg', x: 2384, y: 560 },
    { sheetKey: ASSET_KEYS.STAGE2_PLATFORMS, frame: 's2_plat_sand_md', x: 2660, y: 476 },

    // AREA 3: Rope Bridge 1 (deck y = 602) -> Center Island (530) -> Rope Bridge 2 (deck y = 582)
    { sheetKey: ASSET_KEYS.STAGE2_PROPS, frame: 's2_bridge_left', x: 3055, y: 625 },
    { sheetKey: ASSET_KEYS.STAGE2_PROPS, frame: 's2_bridge_mid', x: 3293, y: 642 },
    { sheetKey: ASSET_KEYS.STAGE2_PROPS, frame: 's2_bridge_right', x: 3535, y: 624 },

    { sheetKey: ASSET_KEYS.STAGE2_PLATFORMS, frame: 's2_plat_rock', x: 3805, y: 585 },

    { sheetKey: ASSET_KEYS.STAGE2_PROPS, frame: 's2_bridge_left', x: 4070, y: 605 },
    { sheetKey: ASSET_KEYS.STAGE2_PROPS, frame: 's2_bridge_right', x: 4300, y: 604 },

    // Area 3 Optional High Sky-Platform Route above Canyon (106px+ headroom above Bridge 1)
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_step_low', x: 3110, y: 486 },
    { sheetKey: ASSET_KEYS.STAGE2_PLATFORMS, frame: 's2_plat_grass_md', x: 3290, y: 445 },
    { sheetKey: ASSET_KEYS.STAGE2_PLATFORMS, frame: 's2_plat_sand_md', x: 3560, y: 370 },

    // AREA 4: Sandstone Mesa Multi-Level & Canyon Crossing (122px+ headroom above ground)
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_step_low', x: 4525, y: 500 },
    { sheetKey: ASSET_KEYS.STAGE2_PLATFORMS, frame: 's2_plat_sand_md', x: 4695, y: 474 },
    { sheetKey: ASSET_KEYS.STAGE2_PLATFORMS, frame: 's2_plat_grass_lg', x: 5025, y: 376 },
    { sheetKey: ASSET_KEYS.STAGE2_PLATFORMS, frame: 's2_plat_rock', x: 5645, y: 540 },

    // AREA 5: Horizon Outpost Final Tiered Platforms
    { sheetKey: ASSET_KEYS.STAGE2_PLATFORMS, frame: 's2_plat_spike', x: 6110, y: 556 },
    { sheetKey: ASSET_KEYS.STAGE2_PLATFORMS, frame: 's2_plat_grass_xl', x: 6385, y: 442 },
    { sheetKey: ASSET_KEYS.STAGE2_PLATFORMS, frame: 's2_plat_sand_md', x: 6735, y: 355 },
  ],
  fallingPlatforms: [
    // Area 4 Canyon crossing planks between Sandstone Ridge and Horizon Outpost
    { id: 'falling-s2-1', x: 5495, y: 550 },
    { id: 'falling-s2-2', x: 5820, y: 510 },
  ],
  obstacles: [
    // Solid sandstone boulders & step blocks positioned in open-headroom zones as climbable steps
    {
      id: 'obs-s2-rock-0',
      kind: 'solid_block',
      sheetKey: ASSET_KEYS.STAGE2_PROPS,
      frame: 's2_rock_1',
      x: 275,
      y: 632,
      colliderInset: { topInset: 10, bottomInset: 4, leftInset: 12, rightInset: 12 },
    },
    {
      id: 'obs-s2-rock-1',
      kind: 'solid_block',
      sheetKey: ASSET_KEYS.STAGE2_PROPS,
      frame: 's2_rock_2',
      x: 640,
      y: 632,
      colliderInset: { topInset: 10, bottomInset: 4, leftInset: 14, rightInset: 14 },
    },
    {
      id: 'obs-s2-step-1',
      kind: 'solid_block',
      sheetKey: ASSET_KEYS.STAGE2_GROUND,
      frame: 's2_step_stair',
      x: 1385,
      y: 632,
      colliderInset: { topInset: 6, bottomInset: 2, leftInset: 6, rightInset: 6 },
    },
    {
      id: 'obs-s2-rock-2',
      kind: 'solid_block',
      sheetKey: ASSET_KEYS.STAGE2_PROPS,
      frame: 's2_rock_4',
      x: 4445,
      y: 632,
      colliderInset: { topInset: 12, bottomInset: 4, leftInset: 14, rightInset: 14 },
    },
    {
      id: 'obs-s2-rock-3',
      kind: 'solid_block',
      sheetKey: ASSET_KEYS.STAGE2_PROPS,
      frame: 's2_rock_3',
      x: 6640,
      y: 632,
      colliderInset: { topInset: 10, bottomInset: 4, leftInset: 14, rightInset: 14 },
    },
  ],
  midgroundDecorations: [
    // Earth & terracotta base fill strips below Stage 2 grass slabs (extends seamlessly to y = 720)
    ...Array.from({ length: 9 }, (_, i) => ({
      sheetKey: ASSET_KEYS.STAGE2_GROUND,
      frame: 's2_dirt_strip',
      x: 58 + i * 116,
      y: 720,
      depth: 8,
    })),
    ...Array.from({ length: 3 }, (_, i) => ({
      sheetKey: ASSET_KEYS.STAGE2_GROUND,
      frame: 's2_dirt_strip',
      x: 1200 + i * 116,
      y: 720,
      depth: 8,
    })),
    ...Array.from({ length: 8 }, (_, i) => ({
      sheetKey: ASSET_KEYS.STAGE2_GROUND,
      frame: 's2_dirt_strip',
      x: 1495 + i * 116,
      y: 720,
      depth: 8,
    })),
    ...Array.from({ length: 5 }, (_, i) => ({
      sheetKey: ASSET_KEYS.STAGE2_GROUND,
      frame: 's2_dirt_strip',
      x: 2505 + i * 116,
      y: 720,
      depth: 8,
    })),
    ...Array.from({ length: 5 }, (_, i) => ({
      sheetKey: ASSET_KEYS.STAGE2_GROUND,
      frame: 's2_dirt_strip',
      x: 4465 + i * 116,
      y: 720,
      depth: 8,
    })),
    // Tall earth support beneath raised Checkpoint 2 ridge (5000 .. 5409)
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_dirt_wide', x: 5088, y: 720, depth: 8 },
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_dirt_wide', x: 5262, y: 720, depth: 8 },
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_dirt_med', x: 5355, y: 720, depth: 8 },
    // Horizon Outpost base fill strips (5910 .. 7200)
    ...Array.from({ length: 12 }, (_, i) => ({
      sheetKey: ASSET_KEYS.STAGE2_GROUND,
      frame: 's2_dirt_strip',
      x: 5968 + i * 116,
      y: 720,
      depth: 8,
    })),

    // Iconic Savanna Acacia Trees (zero collision, warm open spacing)
    { sheetKey: ASSET_KEYS.STAGE2_TREES, frame: 's2_tree_canopy', x: 240, y: 632, depth: 5, scale: 1.12 },
    { sheetKey: ASSET_KEYS.STAGE2_TREES, frame: 's2_tree_sapling', x: 545, y: 632, depth: 6 },
    { sheetKey: ASSET_KEYS.STAGE2_TREES, frame: 's2_tree_tall', x: 920, y: 632, depth: 5 },
    { sheetKey: ASSET_KEYS.STAGE2_TREES, frame: 's2_tree_medium', x: 1310, y: 632, depth: 5 },
    { sheetKey: ASSET_KEYS.STAGE2_TREES, frame: 's2_tree_canopy', x: 1710, y: 632, depth: 5, flipX: true },
    { sheetKey: ASSET_KEYS.STAGE2_TREES, frame: 's2_tree_tall', x: 2610, y: 632, depth: 5 },
    { sheetKey: ASSET_KEYS.STAGE2_TREES, frame: 's2_tree_sapling', x: 2810, y: 632, depth: 6 },
    { sheetKey: ASSET_KEYS.STAGE2_TREES, frame: 's2_tree_medium', x: 4530, y: 632, depth: 5 },
    { sheetKey: ASSET_KEYS.STAGE2_TREES, frame: 's2_tree_canopy', x: 5190, y: 572, depth: 5, scale: 1.05 },
    { sheetKey: ASSET_KEYS.STAGE2_TREES, frame: 's2_tree_tall', x: 6160, y: 632, depth: 5 },
    { sheetKey: ASSET_KEYS.STAGE2_TREES, frame: 's2_tree_sapling', x: 6410, y: 404, depth: 6 },
    { sheetKey: ASSET_KEYS.STAGE2_TREES, frame: 's2_tree_canopy', x: 6970, y: 632, depth: 5, scale: 1.15 },
  ],
  decorations: [
    // Vertical Wooden Ladders (tangga.png) tucked behind upper platform lips alongside jump-step ledges
    { sheetKey: ASSET_KEYS.STAGE2_LADDERS, frame: 's2_ladder_med', x: 1585, y: 632, depth: 9, scale: 0.78 },
    { sheetKey: ASSET_KEYS.STAGE2_LADDERS, frame: 's2_ladder_med', x: 2015, y: 425, depth: 9, scale: 0.5 },
    { sheetKey: ASSET_KEYS.STAGE2_LADDERS, frame: 's2_ladder_med', x: 3215, y: 602, depth: 9, scale: 0.72 },
    { sheetKey: ASSET_KEYS.STAGE2_LADDERS, frame: 's2_ladder_tall', x: 4600, y: 632, depth: 9, scale: 0.54 },
    { sheetKey: ASSET_KEYS.STAGE2_LADDERS, frame: 's2_ladder_med', x: 6225, y: 632, depth: 9, scale: 0.86 },
    { sheetKey: ASSET_KEYS.STAGE2_LADDERS, frame: 's2_ladder_base', x: 6225, y: 632, depth: 9, scale: 0.86 },
    { sheetKey: ASSET_KEYS.STAGE2_LADDERS, frame: 's2_ladder_med', x: 6595, y: 402, depth: 9, scale: 0.5 },

    // Savanna Sandstone Boulders & Golden Grass Tufts across regions
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_tuft_md', x: 95, y: 632, depth: 11 },
    { sheetKey: ASSET_KEYS.STAGE2_PROPS, frame: 's2_rock_0', x: 325, y: 632, depth: 9 },
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_tuft_lg', x: 480, y: 632, depth: 11 },
    { sheetKey: ASSET_KEYS.STAGE2_PROPS, frame: 's2_rock_1', x: 895, y: 632, depth: 9 },
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_tuft_sm', x: 1235, y: 632, depth: 11 },
    { sheetKey: ASSET_KEYS.STAGE2_PROPS, frame: 's2_rock_0', x: 1620, y: 632, depth: 9 },
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_tuft_lg', x: 1875, y: 632, depth: 11 },
    { sheetKey: ASSET_KEYS.STAGE2_PROPS, frame: 's2_rock_3', x: 2545, y: 632, depth: 9 },
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_tuft_md', x: 2770, y: 632, depth: 11 },
    { sheetKey: ASSET_KEYS.STAGE2_PROPS, frame: 's2_rock_1', x: 3735, y: 532, depth: 9 },
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_tuft_sm', x: 4510, y: 632, depth: 11 },
    { sheetKey: ASSET_KEYS.STAGE2_PROPS, frame: 's2_rock_2', x: 5110, y: 572, depth: 9 },
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_tuft_lg', x: 5340, y: 572, depth: 11 },
    { sheetKey: ASSET_KEYS.STAGE2_PROPS, frame: 's2_rock_0', x: 5985, y: 632, depth: 9 },
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_tuft_md', x: 6350, y: 632, depth: 11 },
    { sheetKey: ASSET_KEYS.STAGE2_PROPS, frame: 's2_rock_2', x: 6880, y: 632, depth: 9 },
    { sheetKey: ASSET_KEYS.STAGE2_PROPS, frame: 's2_rock_4', x: 7070, y: 632, depth: 9 },
  ],
  foregroundDecorations: [
    // Low-profile savanna grass tufts framing the bottom edge without obstructing gameplay
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_tuft_sm', x: 210, y: 718, depth: 25 },
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_tuft_md', x: 760, y: 718, depth: 25 },
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_tuft_lg', x: 1690, y: 718, depth: 25 },
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_tuft_sm', x: 2720, y: 718, depth: 25 },
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_tuft_md', x: 4860, y: 718, depth: 25 },
    { sheetKey: ASSET_KEYS.STAGE2_GROUND, frame: 's2_tuft_lg', x: 6690, y: 718, depth: 25 },
  ],
  gems: [],
  questionBoxes: [
    // Area 1: Sunlit Savanna Gate (2 boxes)
    { id: 's2-qbox-1', questionId: 's2-q-1', x: 435, y: 452 },
    { id: 's2-qbox-2', questionId: 's2-q-2', x: 835, y: 326 },

    // Area 2: Acacia Terrace (3 boxes across lower & upper routes)
    { id: 's2-qbox-3', questionId: 's2-q-3', x: 1745, y: 624 },
    { id: 's2-qbox-4', questionId: 's2-q-4', x: 1720, y: 420 },
    { id: 's2-qbox-5', questionId: 's2-q-5', x: 2235, y: 293 },

    // Area 3: Rope Bridge Crossing (2 boxes: island & high sky branch)
    { id: 's2-qbox-6', questionId: 's2-q-6', x: 3805, y: 522 },
    { id: 's2-qbox-7', questionId: 's2-q-7', x: 3560, y: 312 },

    // Area 4: Sandstone Mesa (3 boxes)
    { id: 's2-qbox-8', questionId: 's2-q-8', x: 4750, y: 624 },
    { id: 's2-qbox-9', questionId: 's2-q-9', x: 5025, y: 331 },
    { id: 's2-qbox-10', questionId: 's2-q-10', x: 5645, y: 477 },

    // Area 5: Horizon Outpost (4 boxes)
    { id: 's2-qbox-11', questionId: 's2-q-11', x: 6015, y: 624 },
    { id: 's2-qbox-12', questionId: 's2-q-12', x: 6340, y: 393 },
    { id: 's2-qbox-13', questionId: 's2-q-13', x: 6735, y: 297 },
    { id: 's2-qbox-14', questionId: 's2-q-14', x: 6760, y: 624 },
  ],
  monkeys: [
    // Area 1: 1 sparse early Scorpion on open savanna ground
    { id: 'scorpion-1', x: 780, y: 632, patrolMinX: 700, patrolMaxX: 870 },

    // Area 2: Lower corridor & upper plateau guards
    { id: 'scorpion-2', x: 1940, y: 632, patrolMinX: 1840, patrolMaxX: 2140 },
    { id: 'scorpion-3', x: 2180, y: 300, patrolMinX: 2060, patrolMaxX: 2310 },

    // Area 3: Canyon center island guard
    { id: 'scorpion-4', x: 3805, y: 530, patrolMinX: 3715, patrolMaxX: 3895 },

    // Area 4: Mesa ground, high plateau, and canyon island guards
    { id: 'scorpion-5', x: 4830, y: 632, patrolMinX: 4730, patrolMaxX: 4950 },
    { id: 'scorpion-6', x: 5025, y: 339, patrolMinX: 4900, patrolMaxX: 5150 },
    { id: 'scorpion-7', x: 5645, y: 485, patrolMinX: 5560, patrolMaxX: 5730 },

    // Area 5: Final outpost gauntlet scorpions
    { id: 'scorpion-8', x: 6260, y: 632, patrolMinX: 6140, patrolMaxX: 6380 },
    { id: 'scorpion-9', x: 6620, y: 632, patrolMinX: 6510, patrolMaxX: 6730 },
  ],
  checkpoints: [
    { id: 'cp-s2-1', name: 'Acacia Terrace', x: 2660, y: 626 },
    { id: 'cp-s2-2', name: 'Sunstone Mesa', x: 5240, y: 566 },
  ],
  goal: {
    x: 6970,
    y: 626,
    label: 'Stage 3 Gate',
  },
};
