import { LEVEL_01, LevelDefinition } from './level01';
import { LEVEL_02 } from './level02';

export const LEVEL_REGISTRY: LevelDefinition[] = [LEVEL_01, LEVEL_02];

export function getLevelById(id: string): LevelDefinition {
  return LEVEL_REGISTRY.find((lvl) => lvl.id === id) ?? LEVEL_01;
}
