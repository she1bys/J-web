import type { Material } from "../../audio/sounds";

/** Block ids stored in the world grid (one byte each). 0 is always air. */
export const Block = {
  Air: 0,
  Grass: 1,
  Dirt: 2,
  Stone: 3,
  Wood: 4,
  Leaves: 5,
  Sand: 6,
  Planks: 7,
  Rose: 8,
  Snow: 9,
  SnowyGrass: 10,
  Ice: 11,
  Water: 12,
  Cactus: 13,
  Sandstone: 14,
  PineLeaves: 15,
  Glass: 16,
  Brick: 17,
  Cobble: 18,
  PalmWood: 19,
  Lantern: 20,
} as const;
export type BlockId = (typeof Block)[keyof typeof Block];

/** Texture tiles in the atlas (see textures/atlas.ts). */
export const Tile = {
  GrassTop: 0, GrassSide: 1, Dirt: 2, Stone: 3, WoodSide: 4, WoodTop: 5, Leaves: 6, Sand: 7,
  Planks: 8, Rose: 9, Snow: 10, SnowSide: 11, Ice: 12, Water: 13, CactusSide: 14, CactusTop: 15,
  SandstoneSide: 16, SandstoneTop: 17, PineLeaves: 18, Glass: 19, Brick: 20, Cobble: 21,
  PalmSide: 22, Lantern: 23,
  Crack1: 24, Crack2: 25, Crack3: 26, Crack4: 27,
} as const;
export type TileId = (typeof Tile)[keyof typeof Tile];

/**
 * How a block is drawn:
 * - opaque: solid cube, hides faces behind it
 * - cutout: see-through gaps (leaves, glass), drawn with alpha testing
 * - water:  translucent, not solid, you can swim in it
 */
export type RenderPass = "opaque" | "cutout" | "water";

export interface BlockDef {
  id: BlockId;
  name: string;
  /** [top, sides, bottom] texture tiles */
  tiles: readonly [TileId, TileId, TileId];
  pass: RenderPass;
  solid: boolean;
  /** Seconds to mine by hand. */
  hardness: number;
  sound: Material;
}

const def = (
  id: BlockId, name: string, tiles: readonly [TileId, TileId, TileId], sound: Material,
  hardness: number, pass: RenderPass = "opaque", solid = true,
): BlockDef => ({ id, name, tiles, pass, solid, hardness, sound });

const all: BlockDef[] = [
  def(Block.Grass, "Grass", [Tile.GrassTop, Tile.GrassSide, Tile.Dirt], "grass", 0.45),
  def(Block.Dirt, "Dirt", [Tile.Dirt, Tile.Dirt, Tile.Dirt], "dirt", 0.4),
  def(Block.Stone, "Stone", [Tile.Stone, Tile.Stone, Tile.Stone], "stone", 1.1),
  def(Block.Wood, "Wood", [Tile.WoodTop, Tile.WoodSide, Tile.WoodTop], "wood", 0.8),
  def(Block.Leaves, "Leaves", [Tile.Leaves, Tile.Leaves, Tile.Leaves], "leaves", 0.15, "cutout"),
  def(Block.Sand, "Sand", [Tile.Sand, Tile.Sand, Tile.Sand], "sand", 0.35),
  def(Block.Planks, "Planks", [Tile.Planks, Tile.Planks, Tile.Planks], "wood", 0.7),
  def(Block.Rose, "Rose", [Tile.Rose, Tile.Rose, Tile.Rose], "glass", 0.5),
  def(Block.Snow, "Snow", [Tile.Snow, Tile.Snow, Tile.Snow], "snow", 0.3),
  def(Block.SnowyGrass, "Snowy grass", [Tile.Snow, Tile.SnowSide, Tile.Dirt], "snow", 0.45),
  def(Block.Ice, "Ice", [Tile.Ice, Tile.Ice, Tile.Ice], "glass", 0.5),
  def(Block.Water, "Water", [Tile.Water, Tile.Water, Tile.Water], "water", 0, "water", false),
  def(Block.Cactus, "Cactus", [Tile.CactusTop, Tile.CactusSide, Tile.CactusTop], "leaves", 0.35),
  def(Block.Sandstone, "Sandstone", [Tile.SandstoneTop, Tile.SandstoneSide, Tile.SandstoneTop], "stone", 0.8),
  def(Block.PineLeaves, "Pine leaves", [Tile.PineLeaves, Tile.PineLeaves, Tile.PineLeaves], "leaves", 0.15, "cutout"),
  def(Block.Glass, "Glass", [Tile.Glass, Tile.Glass, Tile.Glass], "glass", 0.3, "cutout"),
  def(Block.Brick, "Brick", [Tile.Brick, Tile.Brick, Tile.Brick], "stone", 1.0),
  def(Block.Cobble, "Cobblestone", [Tile.Cobble, Tile.Cobble, Tile.Cobble], "stone", 1.0),
  def(Block.PalmWood, "Palm wood", [Tile.WoodTop, Tile.PalmSide, Tile.WoodTop], "wood", 0.7),
  def(Block.Lantern, "Lantern", [Tile.Lantern, Tile.Lantern, Tile.Lantern], "glass", 0.3),
];

/** Lookup table indexed by block id. */
export const BLOCKS: readonly (BlockDef | undefined)[] = (() => {
  const table: (BlockDef | undefined)[] = [];
  for (const b of all) table[b.id] = b;
  return table;
})();

export const blockDef = (id: number): BlockDef | undefined => BLOCKS[id];

/** Hides the faces of neighbours (a full, non-see-through cube). */
export const isOpaque = (id: number): boolean => BLOCKS[id]?.pass === "opaque";

/** Something you collide with and can stand on. */
export const isSolidBlock = (id: number): boolean => BLOCKS[id]?.solid ?? false;

/** Something the crosshair can point at (everything but air and water). */
export const isTargetable = (id: number): boolean => id !== Block.Air && id !== Block.Water;
