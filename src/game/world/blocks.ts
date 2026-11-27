import type { Material } from "../../audio/sounds";

/** Block ids stored in the world grid (one byte each). 0 is always air. Never renumber: saves use these. */
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
  CoalOre: 21,
  IronOre: 22,
  Bedrock: 23,
  CraftingTable: 24,
  Furnace: 25,
  Chest: 26,
  Torch: 27,
  Farmland: 28,
  Wheat: 29,
  Sapling: 30,
  Bed: 31,
} as const;
export type BlockId = (typeof Block)[keyof typeof Block];

/** Texture tiles in the atlas (see textures/atlas.ts). Never renumber without repainting the atlas. */
export const Tile = {
  GrassTop: 0, GrassSide: 1, Dirt: 2, Stone: 3, WoodSide: 4, WoodTop: 5, Leaves: 6, Sand: 7,
  Planks: 8, Rose: 9, Snow: 10, SnowSide: 11, Ice: 12, Water: 13, CactusSide: 14, CactusTop: 15,
  SandstoneSide: 16, SandstoneTop: 17, PineLeaves: 18, Glass: 19, Brick: 20, Cobble: 21,
  PalmSide: 22, Lantern: 23,
  Crack1: 24, Crack2: 25, Crack3: 26, Crack4: 27,
  CoalOre: 28, IronOre: 29, Bedrock: 30, TableTop: 31, TableSide: 32,
  FurnaceFront: 33, FurnaceSide: 34, FurnaceTop: 35, ChestFront: 36, ChestSide: 37, ChestTop: 38,
  Torch: 39, FarmlandTop: 40, Wheat0: 41, Wheat1: 42, Wheat2: 43, Wheat3: 44,
  Sapling: 45, PineSapling: 46, BedTop: 47, BedSide: 48,
} as const;
export type TileId = (typeof Tile)[keyof typeof Tile];

/**
 * How a block is drawn:
 * - opaque: solid cube, hides faces behind it and blocks light
 * - cutout: see-through gaps (leaves, glass, plants, torches), drawn with alpha testing
 * - water:  translucent, not solid, you can swim in it
 */
export type RenderPass = "opaque" | "cutout" | "water";

/**
 * Shape of the mesh:
 * - cube:  a full block
 * - cross: two crossed quads (plants, torches); `size` shrinks it
 * - box:   a lower box of `height` (bed)
 */
export type Shape = { kind: "cube" } | { kind: "cross"; size: number; height: number } | { kind: "box"; height: number };

export interface BlockDef {
  id: BlockId;
  name: string;
  /** [top, sides, bottom] texture tiles */
  tiles: readonly [TileId, TileId, TileId];
  /** Tile for the side it faces (furnace, chest); the facing is stored in meta (0 +z, 1 -x, 2 -z, 3 +x). */
  front?: TileId;
  /** Tile per meta value instead of `tiles` (crop growth, sapling kind). */
  variants?: readonly TileId[];
  pass: RenderPass;
  shape: Shape;
  solid: boolean;
  /** Seconds to mine by hand. Infinity = unbreakable in survival. */
  hardness: number;
  sound: Material;
  /** Light given off, 0–15. */
  light: number;
  /** Needs a block underneath (torches, plants): breaks if that block is removed. */
  needsSupport?: boolean;
  /** Does something when used (chests, crafting table, furnace, bed). */
  interactive?: boolean;
}

const CUBE: Shape = { kind: "cube" };

interface Extra {
  pass?: RenderPass;
  shape?: Shape;
  solid?: boolean;
  light?: number;
  front?: TileId;
  variants?: readonly TileId[];
  needsSupport?: boolean;
  interactive?: boolean;
}

const def = (
  id: BlockId, name: string, tiles: readonly [TileId, TileId, TileId], sound: Material, hardness: number, extra: Extra = {},
): BlockDef => ({
  id, name, tiles, sound, hardness,
  pass: extra.pass ?? "opaque",
  shape: extra.shape ?? CUBE,
  solid: extra.solid ?? true,
  light: extra.light ?? 0,
  front: extra.front,
  variants: extra.variants,
  needsSupport: extra.needsSupport,
  interactive: extra.interactive,
});

const PLANT: Extra = { pass: "cutout", shape: { kind: "cross", size: 0.9, height: 0.9 }, solid: false, needsSupport: true };

const all: BlockDef[] = [
  def(Block.Grass, "Grass", [Tile.GrassTop, Tile.GrassSide, Tile.Dirt], "grass", 0.45),
  def(Block.Dirt, "Dirt", [Tile.Dirt, Tile.Dirt, Tile.Dirt], "dirt", 0.4),
  def(Block.Stone, "Stone", [Tile.Stone, Tile.Stone, Tile.Stone], "stone", 1.1),
  def(Block.Wood, "Wood", [Tile.WoodTop, Tile.WoodSide, Tile.WoodTop], "wood", 0.8),
  def(Block.Leaves, "Leaves", [Tile.Leaves, Tile.Leaves, Tile.Leaves], "leaves", 0.15, { pass: "cutout" }),
  def(Block.Sand, "Sand", [Tile.Sand, Tile.Sand, Tile.Sand], "sand", 0.35),
  def(Block.Planks, "Planks", [Tile.Planks, Tile.Planks, Tile.Planks], "wood", 0.7),
  def(Block.Rose, "Rose", [Tile.Rose, Tile.Rose, Tile.Rose], "glass", 0.5),
  def(Block.Snow, "Snow", [Tile.Snow, Tile.Snow, Tile.Snow], "snow", 0.3),
  def(Block.SnowyGrass, "Snowy grass", [Tile.Snow, Tile.SnowSide, Tile.Dirt], "snow", 0.45),
  def(Block.Ice, "Ice", [Tile.Ice, Tile.Ice, Tile.Ice], "glass", 0.5),
  def(Block.Water, "Water", [Tile.Water, Tile.Water, Tile.Water], "water", 0, { pass: "water", solid: false }),
  def(Block.Cactus, "Cactus", [Tile.CactusTop, Tile.CactusSide, Tile.CactusTop], "leaves", 0.35),
  def(Block.Sandstone, "Sandstone", [Tile.SandstoneTop, Tile.SandstoneSide, Tile.SandstoneTop], "stone", 0.8),
  def(Block.PineLeaves, "Pine leaves", [Tile.PineLeaves, Tile.PineLeaves, Tile.PineLeaves], "leaves", 0.15, { pass: "cutout" }),
  def(Block.Glass, "Glass", [Tile.Glass, Tile.Glass, Tile.Glass], "glass", 0.3, { pass: "cutout" }),
  def(Block.Brick, "Brick", [Tile.Brick, Tile.Brick, Tile.Brick], "stone", 1.0),
  def(Block.Cobble, "Cobblestone", [Tile.Cobble, Tile.Cobble, Tile.Cobble], "stone", 1.0),
  def(Block.PalmWood, "Palm wood", [Tile.WoodTop, Tile.PalmSide, Tile.WoodTop], "wood", 0.7),
  def(Block.Lantern, "Lantern", [Tile.Lantern, Tile.Lantern, Tile.Lantern], "glass", 0.3, { light: 15 }),
  def(Block.CoalOre, "Coal ore", [Tile.CoalOre, Tile.CoalOre, Tile.CoalOre], "stone", 1.5),
  def(Block.IronOre, "Iron ore", [Tile.IronOre, Tile.IronOre, Tile.IronOre], "stone", 1.8),
  def(Block.Bedrock, "Bedrock", [Tile.Bedrock, Tile.Bedrock, Tile.Bedrock], "stone", Infinity),
  def(Block.CraftingTable, "Crafting table", [Tile.TableTop, Tile.TableSide, Tile.Planks], "wood", 1.0, { interactive: true }),
  def(Block.Furnace, "Furnace", [Tile.FurnaceTop, Tile.FurnaceSide, Tile.FurnaceTop], "stone", 1.6, { front: Tile.FurnaceFront, interactive: true }),
  def(Block.Chest, "Chest", [Tile.ChestTop, Tile.ChestSide, Tile.ChestTop], "wood", 1.0, { front: Tile.ChestFront, interactive: true }),
  def(Block.Torch, "Torch", [Tile.Torch, Tile.Torch, Tile.Torch], "wood", 0, {
    pass: "cutout", shape: { kind: "cross", size: 0.35, height: 0.7 }, solid: false, light: 14, needsSupport: true,
  }),
  def(Block.Farmland, "Farmland", [Tile.FarmlandTop, Tile.Dirt, Tile.Dirt], "dirt", 0.4),
  def(Block.Wheat, "Wheat", [Tile.Wheat0, Tile.Wheat0, Tile.Wheat0], "leaves", 0, {
    ...PLANT, variants: [Tile.Wheat0, Tile.Wheat1, Tile.Wheat2, Tile.Wheat3],
  }),
  def(Block.Sapling, "Sapling", [Tile.Sapling, Tile.Sapling, Tile.Sapling], "leaves", 0, {
    ...PLANT, variants: [Tile.Sapling, Tile.PineSapling],
  }),
  def(Block.Bed, "Bed", [Tile.BedTop, Tile.BedSide, Tile.Planks], "wood", 0.4, {
    pass: "cutout", shape: { kind: "box", height: 0.56 }, interactive: true,
  }),
];

/** Lookup table indexed by block id. */
export const BLOCKS: readonly (BlockDef | undefined)[] = (() => {
  const table: (BlockDef | undefined)[] = [];
  for (const b of all) table[b.id] = b;
  return table;
})();

export const blockDef = (id: number): BlockDef | undefined => BLOCKS[id];

/** A full, non-see-through cube: hides the faces of neighbours and stops light. */
export const isOpaque = (id: number): boolean => {
  const b = BLOCKS[id];
  return !!b && b.pass === "opaque" && b.shape.kind === "cube";
};

/** Something you collide with and can stand on. */
export const isSolidBlock = (id: number): boolean => BLOCKS[id]?.solid ?? false;

/** Something the crosshair can point at (everything but air and water). */
export const isTargetable = (id: number): boolean => id !== Block.Air && id !== Block.Water;

/** Texture for one face of a block, taking facing and variants (from meta) into account. */
export function faceTile(def: BlockDef, meta: number, face: "top" | "bottom" | "side", dir?: [number, number, number]): TileId {
  if (def.variants) return def.variants[Math.min(meta, def.variants.length - 1)];
  if (face === "top") return def.tiles[0];
  if (face === "bottom") return def.tiles[2];
  if (def.front && dir) {
    const facing = FACING_DIRS[meta & 3];
    if (facing[0] === dir[0] && facing[2] === dir[2]) return def.front;
  }
  return def.tiles[1];
}

/** Facing values stored in meta: 0 → +z, 1 → -x, 2 → -z, 3 → +x. */
export const FACING_DIRS: readonly [number, number, number][] = [[0, 0, 1], [-1, 0, 0], [0, 0, -1], [1, 0, 0]];

/** The facing (0–3) that points from a block toward a position (so it faces the player). */
export function facingToward(bx: number, bz: number, px: number, pz: number): number {
  const dx = px - (bx + 0.5);
  const dz = pz - (bz + 0.5);
  if (Math.abs(dx) > Math.abs(dz)) return dx > 0 ? 3 : 1;
  return dz > 0 ? 0 : 2;
}
