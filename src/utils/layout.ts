import { TILE_DEFINITIONS, TILE_MAP } from '../data/tiles'
import type { PlacedTile, Rotation, Scene } from '../types'

export const GRID_SIZE = 16
export const TILE_WIDTH = 48
export const TILE_HEIGHT = 66
export const TILE_GAP = 7

export const createId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max))

export const snap = (value: number, enabled: boolean) =>
  enabled ? Math.round(value / GRID_SIZE) * GRID_SIZE : Math.round(value)

export const getTileDimensions = (rotation: Rotation) =>
  rotation === 90 || rotation === 270
    ? { width: TILE_HEIGHT, height: TILE_WIDTH }
    : { width: TILE_WIDTH, height: TILE_HEIGHT }

export const sortTileIds = (tileIds: string[]) =>
  [...tileIds].sort((a, b) => (TILE_MAP.get(a)?.order ?? 999) - (TILE_MAP.get(b)?.order ?? 999))

export const buildWall = () => {
  const wall: string[] = []
  TILE_DEFINITIONS.filter((tile) => !tile.isRed).forEach((tile) => {
    const count = tile.rank === 5 && tile.suit !== 'honor' ? 3 : 4
    wall.push(...Array.from({ length: count }, () => tile.id))
  })
  wall.push('aka-man5', 'aka-pin5', 'aka-sou5')
  return wall
}

export const randomHand = (count: 13 | 14) => {
  const wall = buildWall()
  for (let index = wall.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1))
    ;[wall[index], wall[target]] = [wall[target], wall[index]]
  }
  return sortTileIds(wall.slice(0, count))
}

export const makeTile = (tileId: string, x: number, y: number, zIndex: number): PlacedTile => ({
  id: createId('tile'),
  tileId,
  x: Math.round(x),
  y: Math.round(y),
  rotation: 0,
  selected: false,
  zIndex,
})

export const scenesEqual = (a: Scene, b: Scene) => JSON.stringify(a) === JSON.stringify(b)

