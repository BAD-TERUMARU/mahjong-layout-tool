import { TILE_GROUPS } from '../data/tiles'
import type { PlacementMode, TileDefinition } from '../types'

interface TilePaletteProps {
  onAddTile: (tileId: string) => void
  placementMode: PlacementMode
  trashActive: boolean
  onSelectPlacementMode: (mode: PlacementMode) => void
}

const PaletteTile = ({ tile, onAdd }: { tile: TileDefinition; onAdd: () => void }) => (
  <button
    className="palette-tile"
    type="button"
    draggable
    onClick={onAdd}
    onDragStart={(event) => {
      event.dataTransfer.setData('application/x-mahjong-tile', tile.id)
      event.dataTransfer.effectAllowed = 'copy'
    }}
    title={`${tile.label}を追加（ドラッグもできます）`}
    aria-label={`${tile.label}を作業エリアに追加`}
  >
    <img src={tile.asset} alt={tile.label} draggable={false} />
  </button>
)

const symbolChoices: Array<{ mode: PlacementMode; icon: string; label: string; hint: string }> = [
  { mode: 'rectangle', icon: '▭', label: '長方形', hint: '牌3枚分' },
  { mode: 'circle', icon: '〇', label: '丸', hint: '牌2枚分' },
  { mode: 'triangle', icon: '△', label: '三角形', hint: '牌2枚分' },
  { mode: 'cross', icon: '✕', label: 'バツ', hint: '牌1枚分' },
  { mode: 'line', icon: '╱', label: '直線', hint: 'ドラッグで描画' },
  { mode: 'text', icon: 'T', label: 'クリック文字', hint: '自由入力' },
]

export const TilePalette = ({ onAddTile, placementMode, trashActive, onSelectPlacementMode }: TilePaletteProps) => (
  <aside className={`palette-panel${trashActive ? ' trash-active' : ''}`} aria-label="牌一覧と削除エリア">
    <div className="palette-trash-message" aria-hidden={!trashActive}>
      <strong>ここで離して削除</strong>
      <span>元に戻すで復元できます</span>
    </div>

    <div className="panel-heading">
      <div>
        <span className="eyebrow">TILE LIBRARY</span>
        <h2>牌一覧</h2>
      </div>
      <span className="panel-hint">クリック / ドラッグ</span>
    </div>

    <div className="palette-scroll">
      {TILE_GROUPS.map((group) => (
        <section className="tile-group" key={group.suit}>
          <h3>{group.label}</h3>
          <div className={`tile-grid${group.suit === 'honor' ? ' honor-grid' : ''}`}>
            {group.tiles.map((tile) => (
              <PaletteTile key={tile.id} tile={tile} onAdd={() => onAddTile(tile.id)} />
            ))}
          </div>
        </section>
      ))}

      <section className="tile-group symbol-palette-group">
        <h3>記号・文字</h3>
        <div className="symbol-palette-grid">
          {symbolChoices.map((choice) => (
            <button
              key={choice.mode}
              type="button"
              className={`symbol-palette-button${placementMode === choice.mode ? ' active' : ''}`}
              onClick={() => onSelectPlacementMode(choice.mode)}
              aria-pressed={placementMode === choice.mode}
              aria-label={`${choice.label}配置ツール`}
            >
              <b aria-hidden="true">{choice.icon}</b>
              <span>{choice.label}<small>{choice.hint}</small></span>
            </button>
          ))}
        </div>
      </section>
    </div>
  </aside>
)
