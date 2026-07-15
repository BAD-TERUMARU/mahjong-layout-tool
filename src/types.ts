export type Suit = 'man' | 'pin' | 'sou' | 'honor'

export type Rotation = 0 | 90 | 180 | 270

export interface TileDefinition {
  id: string
  label: string
  shortLabel: string
  suit: Suit
  rank: number
  asset: string
  baseId: string
  isRed?: boolean
  order: number
}

export interface PlacedTile {
  id: string
  tileId: string
  x: number
  y: number
  rotation: Rotation
  selected: boolean
  zIndex: number
}

export interface TextItem {
  id: string
  text: string
  x: number
  y: number
  rotation: Rotation
  selected: boolean
  zIndex: number
  color: string
  fontSize: number
}

export interface Scene {
  tiles: PlacedTile[]
  texts: TextItem[]
}

export interface SavedLayout {
  version: 1
  savedAt: string
  scene: Scene
  settings: {
    showGrid: boolean
    snapToGrid: boolean
  }
}

