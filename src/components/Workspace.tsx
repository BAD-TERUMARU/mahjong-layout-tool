import { forwardRef, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { TILE_MAP } from '../data/tiles'
import type { PlacedTile, Scene, TextItem } from '../types'
import { clamp, getTileDimensions, snap, TILE_GAP, TILE_WIDTH } from '../utils/layout'

interface WorkspaceProps {
  scene: Scene
  showGrid: boolean
  snapToGrid: boolean
  onDropTile: (tileId: string, x: number, y: number) => void
  onSelectTile: (id: string, additive: boolean) => void
  onSelectText: (id: string, additive: boolean) => void
  onClearSelection: () => void
  onMoveTile: (id: string, x: number, y: number) => void
  onMoveText: (id: string, x: number, y: number) => void
  onBeginDrag: () => void
  onEndDrag: () => void
}

interface DragState {
  kind: 'tile' | 'text'
  id: string
  startClientX: number
  startClientY: number
  startX: number
  startY: number
  width: number
  height: number
}

export const Workspace = forwardRef<HTMLDivElement, WorkspaceProps>((props, ref) => {
  const dragRef = useRef<DragState | null>(null)

  const beginDrag = (
    event: ReactPointerEvent<HTMLElement>,
    kind: 'tile' | 'text',
    item: PlacedTile | TextItem,
  ) => {
    if (event.button !== 0) return
    event.stopPropagation()
    const element = event.currentTarget
    element.setPointerCapture(event.pointerId)
    const rect = element.getBoundingClientRect()
    dragRef.current = {
      kind,
      id: item.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: item.x,
      startY: item.y,
      width: rect.width,
      height: rect.height,
    }
    props.onBeginDrag()
    if (kind === 'tile') props.onSelectTile(item.id, event.shiftKey)
    else props.onSelectText(item.id, event.shiftKey)
  }

  const moveDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const canvas = event.currentTarget.closest('.workspace-canvas')
    if (!(canvas instanceof HTMLElement)) return
    const nextX = snap(drag.startX + event.clientX - drag.startClientX, props.snapToGrid)
    const nextY = snap(drag.startY + event.clientY - drag.startClientY, props.snapToGrid)
    const x = clamp(nextX, 0, canvas.clientWidth - drag.width)
    const y = clamp(nextY, 0, canvas.clientHeight - drag.height)
    if (drag.kind === 'tile') props.onMoveTile(drag.id, x, y)
    else props.onMoveText(drag.id, x, y)
  }

  const endDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (!dragRef.current) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    props.onEndDrag()
  }

  return (
    <div
      ref={ref}
      className={`workspace-canvas${props.showGrid ? ' show-grid' : ''}`}
      style={{ minWidth: Math.max(800, props.scene.tiles.length * (TILE_WIDTH + TILE_GAP) + 40) }}
      onPointerDown={(event) => event.target === event.currentTarget && props.onClearSelection()}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('application/x-mahjong-tile')) {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
        }
      }}
      onDrop={(event) => {
        event.preventDefault()
        const tileId = event.dataTransfer.getData('application/x-mahjong-tile')
        if (!TILE_MAP.has(tileId)) return
        const bounds = event.currentTarget.getBoundingClientRect()
        props.onDropTile(tileId, event.clientX - bounds.left - 24, event.clientY - bounds.top - 33)
      }}
      aria-label="麻雀牌作業エリア"
    >
      {props.scene.tiles.length === 0 && props.scene.texts.length === 0 && (
        <div className="empty-canvas" aria-hidden="true">
          <div className="empty-tile-stack"><span>東</span><span>一</span><span>●</span></div>
          <p><strong>ここに牌姿をつくりましょう</strong><span>牌一覧からクリック、またはドラッグ</span></p>
        </div>
      )}

      {props.scene.tiles.map((placed) => {
        const tile = TILE_MAP.get(placed.tileId)
        if (!tile) return null
        const dimensions = getTileDimensions(placed.rotation)
        return (
          <button
            key={placed.id}
            type="button"
            className={`placed-item placed-tile${placed.selected ? ' selected' : ''}`}
            style={{
              left: placed.x,
              top: placed.y,
              zIndex: placed.zIndex,
              width: dimensions.width,
              height: dimensions.height,
            }}
            onPointerDown={(event) => beginDrag(event, 'tile', placed)}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            aria-label={`${tile.label}${placed.selected ? '、選択中' : ''}`}
          >
            <img
              src={tile.asset}
              alt={tile.label}
              draggable={false}
              style={{ transform: `translate(-50%, -50%) rotate(${placed.rotation}deg)` }}
            />
          </button>
        )
      })}

      {props.scene.texts.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`placed-item placed-text${item.selected ? ' selected' : ''}`}
          style={{ left: item.x, top: item.y, zIndex: item.zIndex, color: item.color, fontSize: item.fontSize, transform: `rotate(${item.rotation}deg)` }}
          onPointerDown={(event) => beginDrag(event, 'text', item)}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {item.text}
        </button>
      ))}
    </div>
  )
})

Workspace.displayName = 'Workspace'
