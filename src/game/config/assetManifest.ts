import Phaser from 'phaser';
import { AssetLoadEntry, SpriteFrameSpec } from '../types/gameTypes';

export const ASSET_KEYS = {
  DENI: 'deni_sheet',
  GROUND_TILESET: 'ground_tileset',
  FLOATING_PLATFORMS: 'floating_platforms',
  NATURE_DECOR: 'nature_decor',
  ROCK_DECOR: 'rock_decor',
  MONKEY: 'monkey_sheet',
  QUESTION_BOX: 'question_box_sheet',
  START_MENU_BG: 'start_menu_bck',
  START_MENU_CITY: 'start_menu_kota',
  START_MENU_CITY_SHADOW: 'start_menu_bayangan_kota',
  STAGE2_GROUND: 'stage2_ground_tileset',
  STAGE2_PLATFORMS: 'stage2_floating_platforms',
  STAGE2_TREES: 'stage2_trees',
  STAGE2_PROPS: 'stage2_props',
  STAGE2_LADDERS: 'stage2_ladders',
  STAGE2_ENEMY: 'stage2_enemy',
  STAGE2_BG: 'stage2_bck_savana',
} as const;

export const START_MENU_ASSET_KEYS = new Set<string>([
  ASSET_KEYS.DENI,
  ASSET_KEYS.GROUND_TILESET,
  ASSET_KEYS.FLOATING_PLATFORMS,
  ASSET_KEYS.NATURE_DECOR,
  ASSET_KEYS.ROCK_DECOR,
  ASSET_KEYS.QUESTION_BOX,
  ASSET_KEYS.START_MENU_BG,
  ASSET_KEYS.START_MENU_CITY,
  ASSET_KEYS.START_MENU_CITY_SHADOW,
]);

export interface ManifestSheetDef {
  key: string;
  label: string;
  category: 'characters' | 'tilesets' | 'platforms' | 'decorations';
  path: string;
  expectedWidth: number;
  expectedHeight: number;
  frames: SpriteFrameSpec[];
}

export const DENI_FRAMES: SpriteFrameSpec[] = [
  // Row 0: Idle & blink (8 frames)
  { name: 'idle_0', x: 57, y: 13, w: 129, h: 245 },
  { name: 'idle_1', x: 252, y: 14, w: 128, h: 243 },
  { name: 'idle_2', x: 445, y: 12, w: 127, h: 245 },
  { name: 'idle_3', x: 631, y: 12, w: 127, h: 245 },
  { name: 'idle_4', x: 822, y: 11, w: 128, h: 247 },
  { name: 'idle_5', x: 1013, y: 11, w: 128, h: 246 },
  { name: 'idle_6', x: 1201, y: 10, w: 129, h: 247 },
  { name: 'idle_7', x: 1391, y: 11, w: 128, h: 246 },
  // Row 1: Walk cycle (8 frames)
  { name: 'walk_0', x: 54, y: 266, w: 124, h: 245 },
  { name: 'walk_1', x: 245, y: 266, w: 129, h: 245 },
  { name: 'walk_2', x: 443, y: 267, w: 124, h: 241 },
  { name: 'walk_3', x: 626, y: 266, w: 129, h: 240 },
  { name: 'walk_4', x: 823, y: 267, w: 121, h: 242 },
  { name: 'walk_5', x: 1007, y: 266, w: 131, h: 242 },
  { name: 'walk_6', x: 1193, y: 266, w: 135, h: 241 },
  { name: 'walk_7', x: 1397, y: 266, w: 121, h: 242 },
  // Row 2: Run cycle (8 frames)
  { name: 'run_0', x: 29, y: 524, w: 152, h: 227 },
  { name: 'run_1', x: 223, y: 525, w: 156, h: 230 },
  { name: 'run_2', x: 421, y: 525, w: 148, h: 228 },
  { name: 'run_3', x: 611, y: 523, w: 145, h: 232 },
  { name: 'run_4', x: 799, y: 525, w: 150, h: 229 },
  { name: 'run_5', x: 987, y: 527, w: 151, h: 228 },
  { name: 'run_6', x: 1168, y: 525, w: 159, h: 229 },
  { name: 'run_7', x: 1364, y: 528, w: 154, h: 229 },
  // Row 3: Jump, Fall, Land & Action poses (8 frames)
  { name: 'jump_anticipation', x: 20, y: 789, w: 160, h: 217 },
  { name: 'jump_launch', x: 221, y: 786, w: 162, h: 220 },
  { name: 'jump_apex', x: 411, y: 765, w: 170, h: 213 },
  { name: 'jump_fall', x: 610, y: 768, w: 145, h: 209 },
  { name: 'land', x: 785, y: 786, w: 163, h: 218 },
  { name: 'point', x: 982, y: 783, w: 179, h: 224 },
  { name: 'celebrate', x: 1192, y: 774, w: 157, h: 235 },
  { name: 'cool_idle', x: 1391, y: 768, w: 122, h: 243 },
];

export const GROUND_FRAMES: SpriteFrameSpec[] = [
  // Row 0
  { name: 'ground_wide', x: 30, y: 86, w: 409, h: 209, collider: { topInset: 22, bottomInset: 4, leftInset: 6, rightInset: 6 } },
  { name: 'ground_med', x: 481, y: 80, w: 241, h: 215, collider: { topInset: 26, bottomInset: 4, leftInset: 6, rightInset: 6 } },
  { name: 'ground_sq', x: 765, y: 91, w: 196, h: 204, collider: { topInset: 20, bottomInset: 4, leftInset: 6, rightInset: 6 } },
  { name: 'ground_step_l', x: 993, y: 80, w: 246, h: 215, collider: { topInset: 26, bottomInset: 4, leftInset: 6, rightInset: 6 } },
  { name: 'ground_step_r', x: 1278, y: 80, w: 214, h: 215, collider: { topInset: 26, bottomInset: 4, leftInset: 6, rightInset: 6 } },
  // Row 1
  { name: 'dirt_0', x: 30, y: 364, w: 250, h: 222, collider: { topInset: 4, bottomInset: 4, leftInset: 4, rightInset: 4 } },
  { name: 'dirt_1', x: 324, y: 364, w: 218, h: 221, collider: { topInset: 4, bottomInset: 4, leftInset: 4, rightInset: 4 } },
  { name: 'dirt_2', x: 598, y: 364, w: 203, h: 221, collider: { topInset: 4, bottomInset: 4, leftInset: 4, rightInset: 4 } },
  { name: 'ground_tall', x: 846, y: 347, w: 360, h: 238, collider: { topInset: 26, bottomInset: 4, leftInset: 6, rightInset: 6 } },
  { name: 'ground_slab', x: 1247, y: 406, w: 268, h: 143, collider: { topInset: 22, bottomInset: 8, leftInset: 10, rightInset: 10 } },
  // Row 2
  { name: 'grass_cap_med', x: 14, y: 704, w: 322, h: 158, collider: { topInset: 20, bottomInset: 8, leftInset: 8, rightInset: 8 } },
  { name: 'grass_cap_wide', x: 353, y: 684, w: 371, h: 189, collider: { topInset: 20, bottomInset: 8, leftInset: 8, rightInset: 8 } },
  { name: 'ground_roots', x: 737, y: 667, w: 454, h: 214, collider: { topInset: 24, bottomInset: 8, leftInset: 8, rightInset: 8 } },
  { name: 'ground_mossy', x: 1206, y: 655, w: 310, h: 248, collider: { topInset: 24, bottomInset: 16, leftInset: 8, rightInset: 8 } },
];

export const PLATFORM_FRAMES: SpriteFrameSpec[] = [
  // Row 0: Grassy floating platforms
  { name: 'plat_grass_xs', x: 27, y: 75, w: 210, h: 136, collider: { topInset: 20, bottomInset: 24, leftInset: 14, rightInset: 14 } },
  { name: 'plat_grass_sm', x: 274, y: 76, w: 283, h: 135, collider: { topInset: 20, bottomInset: 22, leftInset: 14, rightInset: 14 } },
  { name: 'plat_grass_md', x: 591, y: 71, w: 382, h: 151, collider: { topInset: 24, bottomInset: 26, leftInset: 16, rightInset: 16 } },
  { name: 'plat_grass_lg', x: 1009, y: 62, w: 507, h: 160, collider: { topInset: 28, bottomInset: 26, leftInset: 16, rightInset: 16 } },
  // Row 1: Root & vine islands
  { name: 'island_roots_md', x: 25, y: 265, w: 372, h: 206, collider: { topInset: 26, bottomInset: 58, leftInset: 18, rightInset: 18 } },
  { name: 'island_vines_md', x: 430, y: 268, w: 337, h: 200, collider: { topInset: 24, bottomInset: 56, leftInset: 18, rightInset: 18 } },
  { name: 'island_stone_md', x: 810, y: 271, w: 373, h: 181, collider: { topInset: 24, bottomInset: 34, leftInset: 18, rightInset: 18 } },
  { name: 'island_roots_sm', x: 1244, y: 274, w: 220, h: 204, collider: { topInset: 22, bottomInset: 64, leftInset: 16, rightInset: 16 } },
  // Row 2: Deep mossy islands
  { name: 'island_rock_sm', x: 18, y: 523, w: 241, h: 213, collider: { topInset: 24, bottomInset: 62, leftInset: 18, rightInset: 18 } },
  { name: 'island_rock_md', x: 301, y: 509, w: 340, h: 247, collider: { topInset: 26, bottomInset: 80, leftInset: 20, rightInset: 20 } },
  { name: 'island_rock_lg', x: 670, y: 495, w: 500, h: 288, collider: { topInset: 30, bottomInset: 96, leftInset: 24, rightInset: 24 } },
  { name: 'island_ruin_md', x: 1203, y: 497, w: 309, h: 280, collider: { topInset: 36, bottomInset: 94, leftInset: 20, rightInset: 20 } },
  // Row 3: Bridges & stone ledges
  { name: 'bridge_wood', x: 27, y: 817, w: 250, h: 111, collider: { topInset: 10, bottomInset: 24, leftInset: 12, rightInset: 12 } },
  { name: 'plat_stone', x: 314, y: 810, w: 277, h: 140, collider: { topInset: 12, bottomInset: 32, leftInset: 16, rightInset: 16 } },
  { name: 'plat_stone_moss', x: 616, y: 808, w: 288, h: 153, collider: { topInset: 16, bottomInset: 36, leftInset: 16, rightInset: 16 } },
  { name: 'plank_wood', x: 928, y: 831, w: 260, h: 70, collider: { topInset: 8, bottomInset: 16, leftInset: 12, rightInset: 12 } },
  { name: 'bridge_broken', x: 1216, y: 810, w: 298, h: 127, collider: { topInset: 14, bottomInset: 34, leftInset: 14, rightInset: 14 } },
];

export const NATURE_DECOR_FRAMES: SpriteFrameSpec[] = [
  // Row 0: Grass tufts, sprouts, flowers
  { name: 'grass_tuft_sm', x: 15, y: 62, w: 126, h: 89 },
  { name: 'grass_tuft_md', x: 164, y: 33, w: 143, h: 124 },
  { name: 'grass_tuft_lg', x: 320, y: 14, w: 177, h: 145 },
  { name: 'grass_golden', x: 516, y: 29, w: 148, h: 128 },
  { name: 'sprout_sm', x: 683, y: 65, w: 117, h: 92 },
  { name: 'sprout_twin', x: 815, y: 65, w: 130, h: 94 },
  { name: 'flower_white', x: 962, y: 43, w: 88, h: 111 },
  { name: 'flower_yellow', x: 1065, y: 46, w: 88, h: 108 },
  { name: 'flower_red', x: 1168, y: 48, w: 86, h: 106 },
  { name: 'flower_blue', x: 1264, y: 39, w: 75, h: 115 },
  { name: 'flower_pink', x: 1354, y: 46, w: 80, h: 107 },
  { name: 'flower_purple', x: 1446, y: 43, w: 76, h: 108 },
  // Row 1: Flower patches & mushrooms
  { name: 'flower_pair', x: 20, y: 206, w: 151, h: 115 },
  { name: 'flower_patch', x: 200, y: 197, w: 188, h: 124 },
  { name: 'mushroom_red', x: 448, y: 198, w: 109, h: 123 },
  { name: 'mushroom_brown', x: 616, y: 195, w: 122, h: 126 },
  { name: 'mushroom_amber', x: 790, y: 202, w: 107, h: 119 },
  { name: 'mushroom_blue', x: 948, y: 202, w: 121, h: 119 },
  { name: 'mushroom_twin', x: 1111, y: 211, w: 167, h: 110 },
  { name: 'mushroom_cluster', x: 1329, y: 188, w: 188, h: 136 },
  // Row 2: Leaves & bushes
  { name: 'leaf_green', x: 33, y: 370, w: 78, h: 100 },
  { name: 'leaf_autumn', x: 166, y: 379, w: 114, h: 91 },
  { name: 'sapling_4leaf', x: 318, y: 353, w: 146, h: 117 },
  { name: 'bush_sm', x: 486, y: 369, w: 138, h: 109 },
  { name: 'bush_md', x: 641, y: 361, w: 176, h: 117 },
  { name: 'bush_lg', x: 836, y: 359, w: 178, h: 120 },
  { name: 'bush_flowers', x: 1033, y: 349, w: 178, h: 130 },
  { name: 'twig_leaves', x: 1247, y: 365, w: 118, h: 112 },
  { name: 'bush_berries', x: 1387, y: 350, w: 131, h: 128 },
  // Row 3: Hanging roots & moss
  { name: 'roots_hang_sm', x: 15, y: 499, w: 109, h: 153 },
  { name: 'roots_hang_lg', x: 161, y: 500, w: 175, h: 155 },
  { name: 'roots_curl', x: 360, y: 507, w: 165, h: 159 },
  { name: 'moss_drape_sm', x: 540, y: 506, w: 121, h: 113 },
  { name: 'moss_drape_md', x: 683, y: 511, w: 242, h: 130 },
  { name: 'moss_drape_dirt', x: 945, y: 512, w: 241, h: 135 },
  { name: 'vine_branch', x: 1215, y: 509, w: 175, h: 125 },
  { name: 'vine_curl', x: 1407, y: 507, w: 115, h: 146 },
  // Row 4: Small accent stones
  { name: 'pebble_sm', x: 30, y: 690, w: 103, h: 95 },
  { name: 'pebble_clay', x: 186, y: 699, w: 97, h: 82 },
  { name: 'pebble_flat', x: 333, y: 717, w: 99, h: 59 },
  { name: 'pebble_group', x: 475, y: 696, w: 152, h: 91 },
  { name: 'rock_moss_sm', x: 661, y: 688, w: 136, h: 96 },
  { name: 'rock_pile_sm', x: 829, y: 683, w: 142, h: 104 },
  { name: 'rock_boulder_sm', x: 997, y: 683, w: 126, h: 104 },
  { name: 'rock_moss_twin', x: 1147, y: 675, w: 147, h: 119 },
  { name: 'rock_moss_fern', x: 1316, y: 672, w: 201, h: 125 },
  // Row 5: Ferns, glowing plants, logs & stumps
  { name: 'fern_tall', x: 20, y: 830, w: 134, h: 138 },
  { name: 'fern_wide', x: 170, y: 825, w: 195, h: 143 },
  { name: 'broadleaf', x: 383, y: 834, w: 185, h: 136 },
  { name: 'glow_sprout_1', x: 581, y: 837, w: 143, h: 122 },
  { name: 'glow_sprout_3', x: 751, y: 829, w: 126, h: 143 },
  { name: 'log_fallen', x: 904, y: 846, w: 231, h: 119 },
  { name: 'tree_stump', x: 1156, y: 842, w: 164, h: 126 },
  { name: 'vine_strip', x: 1338, y: 833, w: 179, h: 132 },
];

export const ROCK_DECOR_FRAMES: SpriteFrameSpec[] = [
  // Row 0: Small stones
  { name: 'stone_0', x: 33, y: 57, w: 78, h: 65 },
  { name: 'stone_1', x: 160, y: 25, w: 124, h: 103 },
  { name: 'stone_clay', x: 319, y: 34, w: 108, h: 89 },
  { name: 'stone_flat', x: 459, y: 50, w: 127, h: 69 },
  { name: 'stone_tall', x: 625, y: 21, w: 108, h: 109 },
  { name: 'stone_moss', x: 764, y: 33, w: 126, h: 96 },
  { name: 'stone_trio', x: 923, y: 25, w: 160, h: 115 },
  { name: 'stone_moss_tall', x: 1103, y: 33, w: 121, h: 99 },
  { name: 'stone_cluster_a', x: 1247, y: 38, w: 134, h: 94 },
  { name: 'stone_cluster_b', x: 1402, y: 42, w: 117, h: 87 },
  // Row 1: Medium boulders
  { name: 'boulder_chunky', x: 24, y: 155, w: 187, h: 131 },
  { name: 'boulder_peak', x: 243, y: 152, w: 186, h: 140 },
  { name: 'boulder_low', x: 465, y: 199, w: 198, h: 101 },
  { name: 'boulder_moss', x: 705, y: 160, w: 239, h: 141 },
  { name: 'boulder_cracked', x: 990, y: 157, w: 229, h: 144 },
  { name: 'boulder_layered', x: 1266, y: 160, w: 243, h: 141 },
  // Row 2: Large boulders & ruins
  { name: 'megalith_spire', x: 18, y: 308, w: 204, h: 199 },
  { name: 'megalith_mound', x: 260, y: 332, w: 249, h: 170 },
  { name: 'megalith_moss', x: 528, y: 347, w: 237, h: 156 },
  { name: 'megalith_grass', x: 784, y: 329, w: 228, h: 172 },
  { name: 'megalith_vines', x: 1029, y: 328, w: 249, h: 177 },
  { name: 'megalith_spiral_ruin', x: 1299, y: 323, w: 220, h: 188 },
  // Row 3: Cairns
  { name: 'cairn_0', x: 43, y: 520, w: 179, h: 160 },
  { name: 'cairn_1', x: 303, y: 512, w: 171, h: 167 },
  { name: 'cairn_2', x: 561, y: 533, w: 183, h: 142 },
  { name: 'cairn_3', x: 816, y: 510, w: 168, h: 168 },
  { name: 'cairn_moss', x: 1057, y: 518, w: 153, h: 160 },
  { name: 'cairn_rubble', x: 1264, y: 533, w: 254, h: 143 },
  // Row 4: Slabs, Rune Stones & Crystal Cluster
  { name: 'slab_brown', x: 17, y: 697, w: 237, h: 138 },
  { name: 'slab_moss', x: 284, y: 714, w: 236, h: 126 },
  { name: 'rune_spiral', x: 556, y: 698, w: 196, h: 140 },
  { name: 'rune_obelisk', x: 818, y: 681, w: 159, h: 165 },
  { name: 'mound_moss', x: 1037, y: 707, w: 204, h: 134 },
  { name: 'crystal_cluster', x: 1295, y: 683, w: 216, h: 162 },
  // Row 5: Pebble scatters
  { name: 'scatter_0', x: 21, y: 875, w: 202, h: 113 },
  { name: 'scatter_1', x: 275, y: 875, w: 193, h: 117 },
  { name: 'scatter_2', x: 502, y: 856, w: 233, h: 128 },
  { name: 'scatter_3', x: 777, y: 861, w: 214, h: 126 },
  { name: 'scatter_4', x: 1038, y: 867, w: 226, h: 125 },
  { name: 'scatter_5', x: 1296, y: 866, w: 204, h: 117 },
];

export const MONKEY_FRAMES: SpriteFrameSpec[] = [
  // Row 0: Idle (6 frames)
  { name: 'monkey_idle_0', x: 41, y: 46, w: 125, h: 142 },
  { name: 'monkey_idle_1', x: 208, y: 45, w: 125, h: 143 },
  { name: 'monkey_idle_2', x: 371, y: 44, w: 126, h: 144 },
  { name: 'monkey_idle_3', x: 539, y: 44, w: 126, h: 144 },
  { name: 'monkey_idle_4', x: 706, y: 46, w: 127, h: 142 },
  { name: 'monkey_idle_5', x: 871, y: 45, w: 126, h: 144 },
  // Row 1: Walk patrol (6 frames)
  { name: 'monkey_walk_0', x: 44, y: 225, w: 152, h: 132 },
  { name: 'monkey_walk_1', x: 243, y: 226, w: 141, h: 132 },
  { name: 'monkey_walk_2', x: 424, y: 225, w: 150, h: 132 },
  { name: 'monkey_walk_3', x: 615, y: 224, w: 135, h: 134 },
  { name: 'monkey_walk_4', x: 793, y: 224, w: 139, h: 134 },
  { name: 'monkey_walk_5', x: 972, y: 224, w: 150, h: 134 },
  // Row 2: Attack preparation (4 frames)
  { name: 'monkey_prepare_0', x: 56, y: 396, w: 128, h: 135 },
  { name: 'monkey_prepare_1', x: 244, y: 395, w: 126, h: 137 },
  { name: 'monkey_prepare_2', x: 427, y: 394, w: 157, h: 138 },
  { name: 'monkey_prepare_3', x: 619, y: 388, w: 145, h: 142 },
  // Row 3: Throw wind-up & release follow-through (frames 0,1,3,4; skips frame 2 with baked projectile)
  { name: 'monkey_throw_0', x: 47, y: 572, w: 141, h: 138 },
  { name: 'monkey_throw_1', x: 243, y: 564, w: 165, h: 145 },
  { name: 'monkey_throw_2', x: 751, y: 571, w: 194, h: 139 },
  { name: 'monkey_throw_3', x: 984, y: 571, w: 180, h: 139 },
  // Row 4a: Hit recoil (3 frames)
  { name: 'monkey_hit_0', x: 43, y: 753, w: 161, h: 140 },
  { name: 'monkey_hit_1', x: 241, y: 751, w: 187, h: 142 },
  { name: 'monkey_hit_2', x: 459, y: 749, w: 175, h: 144 },
  // Row 4b: Defeat collapse & poof (5 frames)
  { name: 'monkey_defeat_0', x: 751, y: 795, w: 188, h: 98 },
  { name: 'monkey_defeat_1', x: 1007, y: 779, w: 166, h: 114 },
  { name: 'monkey_defeat_2', x: 1234, y: 779, w: 199, h: 115 },
  { name: 'monkey_defeat_3', x: 1491, y: 776, w: 177, h: 119 },
  { name: 'monkey_defeat_4', x: 1745, y: 770, w: 120, h: 124 },
  // Row 5: Banana projectile spin (6 frames) & impact splash (3 frames)
  { name: 'banana_0', x: 67, y: 955, w: 48, h: 62 },
  { name: 'banana_1', x: 227, y: 963, w: 62, h: 54 },
  { name: 'banana_2', x: 383, y: 960, w: 58, h: 60 },
  { name: 'banana_3', x: 529, y: 964, w: 68, h: 49 },
  { name: 'banana_4', x: 704, y: 951, w: 40, h: 69 },
  { name: 'banana_5', x: 848, y: 992, w: 69, h: 45 },
  { name: 'banana_splat_0', x: 1024, y: 946, w: 93, h: 89 },
  { name: 'banana_splat_1', x: 1192, y: 936, w: 107, h: 104 },
  { name: 'banana_splat_2', x: 1365, y: 932, w: 104, h: 109 },
];

export const QUESTION_BOX_FRAMES: SpriteFrameSpec[] = [
  { name: 'qbox_idle', x: 12, y: 75, w: 140, h: 136 },
  { name: 'qbox_active', x: 187, y: 52, w: 175, h: 159 },
  { name: 'qbox_used', x: 398, y: 2, w: 152, h: 209 },
];

export const START_MENU_BG_FRAMES: SpriteFrameSpec[] = [
  { name: 'bck_clouds', x: 106, y: 100, w: 922, h: 146 },
  { name: 'bck_sun', x: 1479, y: 58, w: 371, h: 371 },
  { name: 'bck_skyline', x: 14, y: 565, w: 1884, h: 200 },
  { name: 'bck_city', x: 14, y: 806, w: 1885, h: 237 },
];

export const STAGE2_GROUND_FRAMES: SpriteFrameSpec[] = [
  // Row 0: Savanna golden grass-topped terrain slabs (all aligned to bottom y=177)
  { name: 's2_g_left', x: 7, y: 43, w: 234, h: 134, collider: { topInset: 46, bottomInset: 2, leftInset: 6, rightInset: 4 } },
  { name: 's2_g_mid_a', x: 247, y: 27, w: 354, h: 150, collider: { topInset: 56, bottomInset: 2, leftInset: 4, rightInset: 4 } },
  { name: 's2_g_short', x: 607, y: 83, w: 115, h: 94, collider: { topInset: 12, bottomInset: 2, leftInset: 4, rightInset: 4 } },
  { name: 's2_g_long', x: 725, y: 76, w: 588, h: 101, collider: { topInset: 18, bottomInset: 2, leftInset: 4, rightInset: 4 } },
  { name: 's2_g_mid_b', x: 1319, y: 28, w: 354, h: 149, collider: { topInset: 56, bottomInset: 2, leftInset: 4, rightInset: 4 } },
  { name: 's2_g_right', x: 1679, y: 43, w: 234, h: 134, collider: { topInset: 46, bottomInset: 2, leftInset: 4, rightInset: 6 } },
  // Cliff overhangs & solid dirt fills
  { name: 's2_cliff_left', x: 7, y: 196, w: 234, h: 214, collider: { topInset: 20, bottomInset: 16, leftInset: 10, rightInset: 10 } },
  { name: 's2_cliff_right', x: 1679, y: 196, w: 234, h: 214, collider: { topInset: 20, bottomInset: 16, leftInset: 10, rightInset: 10 } },
  { name: 's2_dirt_wide', x: 246, y: 423, w: 355, h: 234, collider: { topInset: 4, bottomInset: 4, leftInset: 4, rightInset: 4 } },
  { name: 's2_dirt_med', x: 1438, y: 423, w: 236, h: 234, collider: { topInset: 4, bottomInset: 4, leftInset: 4, rightInset: 4 } },
  { name: 's2_dirt_strip', x: 606, y: 671, w: 235, h: 114, collider: { topInset: 4, bottomInset: 4, leftInset: 4, rightInset: 4 } },
  { name: 's2_dirt_sq', x: 607, y: 423, w: 114, h: 114, collider: { topInset: 4, bottomInset: 4, leftInset: 4, rightInset: 4 } },
  // Standalone floating earth & golden-grass chunks
  { name: 's2_float_sm', x: 1263, y: 743, w: 131, h: 125, collider: { topInset: 16, bottomInset: 18, leftInset: 8, rightInset: 8 } },
  { name: 's2_float_md', x: 1439, y: 728, w: 194, h: 153, collider: { topInset: 30, bottomInset: 26, leftInset: 10, rightInset: 10 } },
  { name: 's2_float_lg', x: 1679, y: 715, w: 194, h: 166, collider: { topInset: 32, bottomInset: 26, leftInset: 10, rightInset: 10 } },
  // Savanna grass tufts & natural earth steps
  { name: 's2_tuft_sm', x: 867, y: 711, w: 72, h: 66 },
  { name: 's2_tuft_md', x: 976, y: 687, w: 89, h: 98 },
  { name: 's2_tuft_lg', x: 1079, y: 683, w: 114, h: 102 },
  { name: 's2_step_low', x: 366, y: 743, w: 115, h: 42, collider: { topInset: 4, bottomInset: 2, leftInset: 4, rightInset: 4 } },
  { name: 's2_step_stair', x: 486, y: 703, w: 116, h: 82, collider: { topInset: 6, bottomInset: 2, leftInset: 6, rightInset: 6 } },
];

export const STAGE2_PLATFORM_FRAMES: SpriteFrameSpec[] = [
  { name: 's2_plat_grass_xs', x: 145, y: 112, w: 163, h: 159, collider: { topInset: 28, bottomInset: 54, leftInset: 12, rightInset: 12 } },
  { name: 's2_plat_grass_md', x: 425, y: 116, w: 474, h: 177, collider: { topInset: 26, bottomInset: 42, leftInset: 16, rightInset: 16 } },
  { name: 's2_plat_grass_lg', x: 1015, y: 79, w: 782, h: 268, collider: { topInset: 60, bottomInset: 72, leftInset: 22, rightInset: 22 } },
  { name: 's2_plat_grass_xl', x: 92, y: 353, w: 868, h: 287, collider: { topInset: 62, bottomInset: 72, leftInset: 22, rightInset: 22 } },
  { name: 's2_plat_sand_lg', x: 1100, y: 415, w: 629, h: 209, collider: { topInset: 6, bottomInset: 40, leftInset: 22, rightInset: 22 } },
  { name: 's2_plat_sand_md', x: 240, y: 734, w: 561, h: 214, collider: { topInset: 8, bottomInset: 48, leftInset: 20, rightInset: 20 } },
  { name: 's2_plat_rock', x: 991, y: 728, w: 518, h: 256, collider: { topInset: 18, bottomInset: 98, leftInset: 22, rightInset: 22 } },
  { name: 's2_plat_spike', x: 1616, y: 707, w: 204, h: 288, collider: { topInset: 28, bottomInset: 120, leftInset: 14, rightInset: 14 } },
];

export const STAGE2_TREE_FRAMES: SpriteFrameSpec[] = [
  { name: 's2_tree_sapling', x: 63, y: 584, w: 197, h: 185 },
  { name: 's2_tree_medium', x: 323, y: 479, w: 325, h: 290 },
  { name: 's2_tree_tall', x: 683, y: 307, w: 437, h: 462 },
  { name: 's2_tree_canopy', x: 1151, y: 352, w: 731, h: 417 },
];

export const STAGE2_PROPS_FRAMES: SpriteFrameSpec[] = [
  // Question crates (identical bottom y=283 across idle/active/used)
  { name: 's2_qbox_idle', x: 179, y: 147, w: 140, h: 136 },
  { name: 's2_qbox_active', x: 354, y: 124, w: 173, h: 160 },
  { name: 's2_qbox_used', x: 565, y: 84, w: 152, h: 199 },
  // Savanna sandstone boulders
  { name: 's2_rock_0', x: 835, y: 177, w: 130, h: 90 },
  { name: 's2_rock_1', x: 980, y: 161, w: 154, h: 106 },
  { name: 's2_rock_2', x: 1147, y: 145, w: 177, h: 118 },
  { name: 's2_rock_3', x: 1327, y: 154, w: 184, h: 106 },
  { name: 's2_rock_4', x: 1526, y: 147, w: 201, h: 120 },
  // Wooden rope bridges (plank deck surface aligned cleanly across left/mid/right)
  { name: 's2_bridge_left', x: 178, y: 364, w: 468, h: 328, collider: { topInset: 118, bottomInset: 42, leftInset: 12, rightInset: 6 } },
  { name: 's2_bridge_mid', x: 694, y: 470, w: 515, h: 184, collider: { topInset: 12, bottomInset: 14, leftInset: 4, rightInset: 4 } },
  { name: 's2_bridge_right', x: 1247, y: 364, w: 488, h: 329, collider: { topInset: 120, bottomInset: 42, leftInset: 6, rightInset: 12 } },
];

export const STAGE2_LADDER_FRAMES: SpriteFrameSpec[] = [
  { name: 's2_ladder_med', x: 485, y: 405, w: 166, h: 542 },
  { name: 's2_ladder_tall', x: 740, y: 140, w: 167, h: 807 },
  { name: 's2_ladder_seg_top', x: 1000, y: 147, w: 155, h: 229 },
  { name: 's2_ladder_seg_mid', x: 1000, y: 429, w: 155, h: 209 },
  { name: 's2_ladder_seg_bot', x: 1000, y: 698, w: 156, h: 241 },
  { name: 's2_ladder_rail_top', x: 1230, y: 140, w: 216, h: 176 },
  { name: 's2_ladder_rail_mid', x: 1230, y: 383, w: 216, h: 246 },
  { name: 's2_ladder_base', x: 1234, y: 776, w: 196, h: 163 },
];

export const STAGE2_ENEMY_FRAMES: SpriteFrameSpec[] = [
  // Row 0: Idle (4 frames)
  { name: 'scorpion_idle_0', x: 508, y: 87, w: 186, h: 121 },
  { name: 'scorpion_idle_1', x: 747, y: 87, w: 182, h: 121 },
  { name: 'scorpion_idle_2', x: 982, y: 87, w: 182, h: 121 },
  { name: 'scorpion_idle_3', x: 1213, y: 87, w: 186, h: 121 },
  // Row 1: Walk patrol (4 frames)
  { name: 'scorpion_walk_0', x: 464, y: 242, w: 197, h: 125 },
  { name: 'scorpion_walk_1', x: 725, y: 239, w: 196, h: 128 },
  { name: 'scorpion_walk_2', x: 978, y: 239, w: 196, h: 128 },
  { name: 'scorpion_walk_3', x: 1240, y: 244, w: 197, h: 123 },
  // Row 2: Prepare stinger charge (4 frames, sparks included)
  { name: 'scorpion_prepare_0', x: 439, y: 402, w: 201, h: 127 },
  { name: 'scorpion_prepare_1', x: 714, y: 398, w: 200, h: 131 },
  { name: 'scorpion_prepare_2', x: 988, y: 385, w: 200, h: 144 },
  { name: 'scorpion_prepare_3', x: 1264, y: 385, w: 199, h: 144 },
  // Row 3: Throw/Spit (4 frames) + Golden Orb Projectiles (4 frames)
  { name: 'scorpion_throw_0', x: 349, y: 561, w: 203, h: 128 },
  { name: 'scorpion_throw_1', x: 661, y: 557, w: 201, h: 131 },
  { name: 'scorpion_throw_2', x: 1003, y: 557, w: 197, h: 132 },
  { name: 'scorpion_throw_3', x: 1340, y: 565, w: 193, h: 124 },
  { name: 'scorpion_orb_0', x: 569, y: 615, w: 46, h: 27 },
  { name: 'scorpion_orb_1', x: 888, y: 615, w: 70, h: 27 },
  { name: 'scorpion_orb_2', x: 1237, y: 615, w: 65, h: 27 },
  { name: 'scorpion_orb_3', x: 1557, y: 619, w: 23, h: 9 },
  // Row 4: Hit recoil (3 frames)
  { name: 'scorpion_hit_0', x: 591, y: 727, w: 200, h: 120 },
  { name: 'scorpion_hit_1', x: 855, y: 731, w: 204, h: 117 },
  { name: 'scorpion_hit_2', x: 1126, y: 702, w: 182, h: 146 },
  // Row 5: Defeat collapse (4 frames)
  { name: 'scorpion_defeat_0', x: 443, y: 883, w: 218, h: 117 },
  { name: 'scorpion_defeat_1', x: 740, y: 886, w: 189, h: 114 },
  { name: 'scorpion_defeat_2', x: 1007, y: 897, w: 167, h: 103 },
  { name: 'scorpion_defeat_3', x: 1253, y: 887, w: 214, h: 113 },
];

export const ASSET_MANIFEST: ManifestSheetDef[] = [
  {
    key: ASSET_KEYS.DENI,
    label: 'Deni Character Animation Sprite Sheet',
    category: 'characters',
    path: '/assets/aistudio/Deni_Character_Animation_Sprite_Sheet_a465b403.png',
    expectedWidth: 1536,
    expectedHeight: 1024,
    frames: DENI_FRAMES,
  },
  {
    key: ASSET_KEYS.GROUND_TILESET,
    label: '01 Ground Tileset',
    category: 'tilesets',
    path: '/assets/aistudio/Lembar_Sprite_Tile_Tanah_Pixel_Art_e7962e98.png',
    expectedWidth: 1536,
    expectedHeight: 1024,
    frames: GROUND_FRAMES,
  },
  {
    key: ASSET_KEYS.FLOATING_PLATFORMS,
    label: '02 Floating Platforms',
    category: 'platforms',
    path: '/assets/aistudio/Lembaran_Sprite_Platform_Pixel_Art_98585c70.png',
    expectedWidth: 1536,
    expectedHeight: 1024,
    frames: PLATFORM_FRAMES,
  },
  {
    key: ASSET_KEYS.NATURE_DECOR,
    label: '03 Terrain Decorations — Nature',
    category: 'decorations',
    path: '/assets/aistudio/Lembar_Sprite_Alam_Pixel_Art_a3c2861d.png',
    expectedWidth: 1536,
    expectedHeight: 1024,
    frames: NATURE_DECOR_FRAMES,
  },
  {
    key: ASSET_KEYS.ROCK_DECOR,
    label: '03 Terrain Decorations — Rocks & Runes',
    category: 'decorations',
    path: '/assets/aistudio/Lembar_Sprite_Batu_Pixel_Art_24ae3b75.png',
    expectedWidth: 1536,
    expectedHeight: 1024,
    frames: ROCK_DECOR_FRAMES,
  },
  {
    key: ASSET_KEYS.MONKEY,
    label: 'Forest Monkey Enemy & Banana Sprite Sheet',
    category: 'characters',
    path: '/assets/aistudio/monkey_ca920cfc.png',
    expectedWidth: 1920,
    expectedHeight: 1080,
    frames: MONKEY_FRAMES,
  },
  {
    key: ASSET_KEYS.QUESTION_BOX,
    label: 'Question Box Sprite Sheet',
    category: 'decorations',
    path: '/assets/aistudio/box_pertanyaan_fe411d66.png',
    expectedWidth: 563,
    expectedHeight: 246,
    frames: QUESTION_BOX_FRAMES,
  },
  {
    key: ASSET_KEYS.START_MENU_BG,
    label: 'Start Screen Clouds & Sun (bck.png)',
    category: 'decorations',
    path: '/assets/aistudio/asset_bck_909e6d4f.png',
    expectedWidth: 1920,
    expectedHeight: 1080,
    frames: START_MENU_BG_FRAMES,
  },
  {
    key: ASSET_KEYS.START_MENU_CITY,
    label: 'Start Screen City Layer (kota.png)',
    category: 'decorations',
    path: '/assets/aistudio/kota_40682535.png',
    expectedWidth: 1920,
    expectedHeight: 1080,
    frames: [],
  },
  {
    key: ASSET_KEYS.START_MENU_CITY_SHADOW,
    label: 'Start Screen City Silhouette Shadow (bayangan_kota.png)',
    category: 'decorations',
    path: '/assets/aistudio/bayangan_kota_e51acba5.png',
    expectedWidth: 1920,
    expectedHeight: 1080,
    frames: [],
  },
  {
    key: ASSET_KEYS.STAGE2_GROUND,
    label: 'Stage 2 Savanna Ground Tileset',
    category: 'tilesets',
    path: '/stage2/Lembar Sprite Tile Tanah Pixel Art.png',
    expectedWidth: 1920,
    expectedHeight: 1080,
    frames: STAGE2_GROUND_FRAMES,
  },
  {
    key: ASSET_KEYS.STAGE2_PLATFORMS,
    label: 'Stage 2 Savanna Floating Platforms',
    category: 'platforms',
    path: '/stage2/Lembaran Sprite Platform Pixel Art.png',
    expectedWidth: 1920,
    expectedHeight: 1080,
    frames: STAGE2_PLATFORM_FRAMES,
  },
  {
    key: ASSET_KEYS.STAGE2_TREES,
    label: 'Stage 2 Savanna Acacia Trees',
    category: 'decorations',
    path: '/stage2/lembaran Sprite Pohon.png',
    expectedWidth: 1920,
    expectedHeight: 1080,
    frames: STAGE2_TREE_FRAMES,
  },
  {
    key: ASSET_KEYS.STAGE2_PROPS,
    label: 'Stage 2 Bridges, Sandstone Rocks & Boxes',
    category: 'decorations',
    path: '/stage2/jembatan kayu, batu dan box.png',
    expectedWidth: 1920,
    expectedHeight: 1080,
    frames: STAGE2_PROPS_FRAMES,
  },
  {
    key: ASSET_KEYS.STAGE2_LADDERS,
    label: 'Stage 2 Wooden Ladders',
    category: 'decorations',
    path: '/stage2/tangga.png',
    expectedWidth: 1920,
    expectedHeight: 1080,
    frames: STAGE2_LADDER_FRAMES,
  },
  {
    key: ASSET_KEYS.STAGE2_ENEMY,
    label: 'Stage 2 Savanna Scorpion Enemy',
    category: 'characters',
    path: '/stage2/enemy.png',
    expectedWidth: 1920,
    expectedHeight: 1080,
    frames: STAGE2_ENEMY_FRAMES,
  },
  {
    key: ASSET_KEYS.STAGE2_BG,
    label: 'Stage 2 Savanna Background (bck-savana.png)',
    category: 'decorations',
    path: '/assets/aistudio/bck-savana_c2b55a5c.png',
    expectedWidth: 1920,
    expectedHeight: 1080,
    frames: [],
  },
];

export function getFrameSpec(sheetKey: string, frameName: string): SpriteFrameSpec | undefined {
  const sheet = ASSET_MANIFEST.find((s) => s.key === sheetKey);
  return sheet?.frames.find((f) => f.name === frameName);
}

/**
 * Registers exact non-destructive sub-frames onto every loaded Phaser texture
 * and sets NEAREST filter mode so pixel art stays razor crisp.
 */
export function registerManifestFrames(
  scene: Phaser.Scene,
  failedKeys: Set<string>,
  loadErrors: Map<string, string>
): AssetLoadEntry[] {
  const report: AssetLoadEntry[] = [];

  for (const sheet of ASSET_MANIFEST) {
    const exists = scene.textures.exists(sheet.key) && !failedKeys.has(sheet.key);
    if (!exists) {
      report.push({
        key: sheet.key,
        label: sheet.label,
        category: sheet.category,
        path: sheet.path,
        expectedWidth: sheet.expectedWidth,
        expectedHeight: sheet.expectedHeight,
        loaded: false,
        error: loadErrors.get(sheet.key) ?? `Failed to load asset at ${sheet.path}`,
        naturalWidth: 0,
        naturalHeight: 0,
        frameCount: 0,
      });
      continue;
    }

    const texture = scene.textures.get(sheet.key);
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    const sourceImage = texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const naturalWidth = sourceImage?.width ?? 0;
    const naturalHeight = sourceImage?.height ?? 0;

    let addedCount = 0;
    for (const frame of sheet.frames) {
      if (!texture.has(frame.name)) {
        texture.add(frame.name, 0, frame.x, frame.y, frame.w, frame.h);
      }
      addedCount += 1;
    }

    report.push({
      key: sheet.key,
      label: sheet.label,
      category: sheet.category,
      path: sheet.path,
      expectedWidth: sheet.expectedWidth,
      expectedHeight: sheet.expectedHeight,
      loaded: true,
      error: null,
      naturalWidth,
      naturalHeight,
      frameCount: addedCount,
    });
  }

  return report;
}

export interface AnimationDef {
  key: string;
  frames: string[];
  frameRate: number;
  repeat: number;
  label: string;
}

export const DENI_ANIMATIONS: AnimationDef[] = [
  {
    key: 'deni-idle',
    label: 'Idle (with blink)',
    frames: ['idle_0', 'idle_1', 'idle_2', 'idle_3', 'idle_4', 'idle_5', 'idle_6', 'idle_7'],
    frameRate: 7,
    repeat: -1,
  },
  {
    key: 'deni-walk',
    label: 'Walk Cycle',
    frames: ['walk_0', 'walk_1', 'walk_2', 'walk_3', 'walk_4', 'walk_5', 'walk_6', 'walk_7'],
    frameRate: 10,
    repeat: -1,
  },
  {
    key: 'deni-run',
    label: 'Run Cycle',
    frames: ['run_0', 'run_1', 'run_2', 'run_3', 'run_4', 'run_5', 'run_6', 'run_7'],
    frameRate: 14,
    repeat: -1,
  },
  {
    key: 'deni-jump',
    label: 'Jump Ascent',
    frames: ['jump_launch', 'jump_apex'],
    frameRate: 10,
    repeat: 0,
  },
  {
    key: 'deni-fall',
    label: 'Fall Descent',
    frames: ['jump_fall'],
    frameRate: 6,
    repeat: -1,
  },
  {
    key: 'deni-land',
    label: 'Landing',
    frames: ['land'],
    frameRate: 12,
    repeat: 0,
  },
  {
    key: 'deni-celebrate',
    label: 'Celebrate',
    frames: ['celebrate'],
    frameRate: 6,
    repeat: -1,
  },
  {
    key: 'deni-point',
    label: 'Point / Interact',
    frames: ['point'],
    frameRate: 6,
    repeat: 0,
  },
  {
    key: 'deni-cool-idle',
    label: 'Relaxed Stand',
    frames: ['cool_idle'],
    frameRate: 4,
    repeat: -1,
  },
];

export function registerDeniAnimations(scene: Phaser.Scene): void {
  if (!scene.textures.exists(ASSET_KEYS.DENI)) return;

  for (const anim of DENI_ANIMATIONS) {
    if (scene.anims.exists(anim.key)) continue;
    scene.anims.create({
      key: anim.key,
      frames: anim.frames.map((frame) => ({ key: ASSET_KEYS.DENI, frame })),
      frameRate: anim.frameRate,
      repeat: anim.repeat,
    });
  }
}

export const MONKEY_ANIMATIONS: AnimationDef[] = [
  {
    key: 'monkey-sheet-idle',
    label: 'Monkey Idle',
    frames: [
      'monkey_idle_0',
      'monkey_idle_1',
      'monkey_idle_2',
      'monkey_idle_3',
      'monkey_idle_4',
      'monkey_idle_5',
    ],
    frameRate: 6,
    repeat: -1,
  },
  {
    key: 'monkey-sheet-walk',
    label: 'Monkey Patrol Walk',
    frames: [
      'monkey_walk_0',
      'monkey_walk_1',
      'monkey_walk_2',
      'monkey_walk_3',
      'monkey_walk_4',
      'monkey_walk_5',
    ],
    frameRate: 9,
    repeat: -1,
  },
  {
    key: 'monkey-sheet-prepare',
    label: 'Monkey Attack Preparation',
    frames: [
      'monkey_prepare_0',
      'monkey_prepare_1',
      'monkey_prepare_2',
      'monkey_prepare_3',
    ],
    frameRate: 9,
    repeat: 0,
  },
  {
    key: 'monkey-sheet-throw',
    label: 'Monkey Throw Banana',
    frames: [
      'monkey_throw_0',
      'monkey_throw_1',
      'monkey_throw_2',
      'monkey_throw_3',
    ],
    frameRate: 11,
    repeat: 0,
  },
  {
    key: 'monkey-sheet-hit',
    label: 'Monkey Hit Recoil',
    frames: ['monkey_hit_0', 'monkey_hit_1', 'monkey_hit_2'],
    frameRate: 10,
    repeat: 0,
  },
  {
    key: 'monkey-sheet-defeat',
    label: 'Monkey Defeat',
    frames: [
      'monkey_defeat_0',
      'monkey_defeat_1',
      'monkey_defeat_2',
      'monkey_defeat_3',
      'monkey_defeat_4',
    ],
    frameRate: 10,
    repeat: 0,
  },
  {
    key: 'monkey-banana-spin',
    label: 'Banana Projectile Spin',
    frames: [
      'banana_0',
      'banana_1',
      'banana_2',
      'banana_3',
      'banana_4',
      'banana_5',
    ],
    frameRate: 14,
    repeat: -1,
  },
  {
    key: 'monkey-banana-splat',
    label: 'Banana Impact Splat',
    frames: ['banana_splat_0', 'banana_splat_1', 'banana_splat_2'],
    frameRate: 14,
    repeat: 0,
  },
];

export function registerMonkeyAnimations(scene: Phaser.Scene): void {
  if (!scene.textures.exists(ASSET_KEYS.MONKEY)) return;

  for (const anim of MONKEY_ANIMATIONS) {
    if (scene.anims.exists(anim.key)) continue;
    scene.anims.create({
      key: anim.key,
      frames: anim.frames.map((frame) => ({ key: ASSET_KEYS.MONKEY, frame })),
      frameRate: anim.frameRate,
      repeat: anim.repeat,
    });
  }
}

export const SCORPION_ANIMATIONS: AnimationDef[] = [
  {
    key: 'scorpion-idle',
    label: 'Scorpion Idle',
    frames: ['scorpion_idle_0', 'scorpion_idle_1', 'scorpion_idle_2', 'scorpion_idle_3'],
    frameRate: 6,
    repeat: -1,
  },
  {
    key: 'scorpion-walk',
    label: 'Scorpion Patrol Walk',
    frames: ['scorpion_walk_0', 'scorpion_walk_1', 'scorpion_walk_2', 'scorpion_walk_3'],
    frameRate: 8,
    repeat: -1,
  },
  {
    key: 'scorpion-prepare',
    label: 'Scorpion Charge Stinger',
    frames: [
      'scorpion_prepare_0',
      'scorpion_prepare_1',
      'scorpion_prepare_2',
      'scorpion_prepare_3',
    ],
    frameRate: 9,
    repeat: 0,
  },
  {
    key: 'scorpion-throw',
    label: 'Scorpion Spit Energy Orb',
    frames: ['scorpion_throw_0', 'scorpion_throw_1', 'scorpion_throw_2', 'scorpion_throw_3'],
    frameRate: 11,
    repeat: 0,
  },
  {
    key: 'scorpion-hit',
    label: 'Scorpion Hit Recoil',
    frames: ['scorpion_hit_0', 'scorpion_hit_1', 'scorpion_hit_2'],
    frameRate: 10,
    repeat: 0,
  },
  {
    key: 'scorpion-defeat',
    label: 'Scorpion Defeat',
    frames: [
      'scorpion_defeat_0',
      'scorpion_defeat_1',
      'scorpion_defeat_2',
      'scorpion_defeat_3',
    ],
    frameRate: 9,
    repeat: 0,
  },
  {
    key: 'scorpion-orb-spin',
    label: 'Scorpion Energy Orb Pulse',
    frames: ['scorpion_orb_0', 'scorpion_orb_1', 'scorpion_orb_2'],
    frameRate: 12,
    repeat: -1,
  },
];

export function registerScorpionAnimations(scene: Phaser.Scene): void {
  if (!scene.textures.exists(ASSET_KEYS.STAGE2_ENEMY)) return;

  for (const anim of SCORPION_ANIMATIONS) {
    if (scene.anims.exists(anim.key)) continue;
    scene.anims.create({
      key: anim.key,
      frames: anim.frames.map((frame) => ({ key: ASSET_KEYS.STAGE2_ENEMY, frame })),
      frameRate: anim.frameRate,
      repeat: anim.repeat,
    });
  }
}
