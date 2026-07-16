import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { TILE_MAP } from '../data/tiles'
import type {
  CanvasElement,
  CanvasPoint,
  ContextMenuState,
  ElementPosition,
  PlacementMode,
  Scene,
  SymbolType,
  TextElement,
} from '../types'
import {
  clamp,
  getElementDimensions,
  getSymbolBaseDimensions,
  MAX_WORKSPACE_HEIGHT,
  MAX_WORKSPACE_WIDTH,
  MIN_WORKSPACE_HEIGHT,
  MIN_WORKSPACE_WIDTH,
  snap,
  SYMBOL_LABELS,
  TILE_HEIGHT,
  TILE_WIDTH,
} from '../utils/layout'

interface EditTextRequest {
  id: string
  token: number
}

interface WorkspaceProps {
  scene: Scene
  showGrid: boolean
  snapToGrid: boolean
  placementMode: PlacementMode
  editTextRequest: EditTextRequest | null
  onDropTile: (tileId: string, x: number, y: number) => void
  onSelectElement: (id: string, additive: boolean) => void
  onSelectRange: (ids: string[], additive: boolean) => void
  onClearSelection: () => void
  onMoveElements: (positions: ElementPosition[]) => void
  onDeleteDragged: (ids: string[]) => void
  onTrashHover: (active: boolean) => void
  onPlaceSymbol: (symbolType: SymbolType, x: number, y: number) => void
  onCommitDrawing: (points: CanvasPoint[]) => void
  onCommitText: (text: string, x: number, y: number, id?: string) => void
  onFinishTextEditing: () => void
  onToggleTileFace: (id: string) => void
  onOpenContextMenu: (state: ContextMenuState) => void
  onResize: (width: number, height: number) => void
  onResizeSymbol: (id: string, scale: number) => void
  onBeginDrag: () => void
  onEndDrag: () => void
}

interface DragState {
  pointerId: number
  startClientX: number
  startClientY: number
  primaryId: string
  starts: ElementPosition[]
  bounds: { left: number; top: number; right: number; bottom: number }
  moved: boolean
  inTrash: boolean
}

interface MarqueeState {
  startX: number
  startY: number
  currentX: number
  currentY: number
  visible: boolean
  additive: boolean
}

interface TextEditorState {
  id?: string
  x: number
  y: number
  value: string
}

interface DrawingState {
  pointerId: number
  points: CanvasPoint[]
}

interface SymbolResizeState {
  pointerId: number
  id: string
  startClientX: number
  startClientY: number
  startScale: number
  baseWidth: number
  baseHeight: number
}

const isPalettePoint = (clientX: number, clientY: number) => {
  const palette = document.querySelector<HTMLElement>('.palette-panel')
  if (!palette) return false
  const bounds = palette.getBoundingClientRect()
  return clientX >= bounds.left
    && clientX <= bounds.right
    && clientY >= bounds.top
    && clientY <= bounds.bottom
}

const intersectionIds = (
  elements: CanvasElement[],
  left: number,
  top: number,
  right: number,
  bottom: number,
) => elements.filter((element) => {
  const dimensions = getElementDimensions(element)
  return element.x < right
    && element.x + dimensions.width > left
    && element.y < bottom
    && element.y + dimensions.height > top
}).map((element) => element.id)

export const Workspace = forwardRef<HTMLDivElement, WorkspaceProps>((props, ref) => {
  const propsRef = useRef(props)
  propsRef.current = props
  const dragRef = useRef<DragState | null>(null)
  const marqueeRef = useRef<MarqueeState | null>(null)
  const resizeRef = useRef<{ startX: number; startY: number; width: number; height: number } | null>(null)
  const drawingRef = useRef<DrawingState | null>(null)
  const symbolResizeRef = useRef<SymbolResizeState | null>(null)
  const [marquee, setMarquee] = useState<MarqueeState | null>(null)
  const [editor, setEditor] = useState<TextEditorState | null>(null)
  const [drawing, setDrawing] = useState<DrawingState | null>(null)

  useEffect(() => {
    if (!props.editTextRequest) return
    const item = props.scene.elements.find(
      (element): element is TextElement => element.id === props.editTextRequest?.id && element.kind === 'text',
    )
    if (item && !item.locked) setEditor({ id: item.id, x: item.x, y: item.y, value: item.text })
  }, [props.editTextRequest, props.scene.elements])

  const beginElementDrag = (event: ReactPointerEvent<HTMLButtonElement>, element: CanvasElement) => {
    if (event.button !== 0) return
    event.stopPropagation()
    props.onSelectElement(element.id, event.shiftKey)
    if (element.locked) return

    event.currentTarget.setPointerCapture(event.pointerId)
    const selectedElements = props.scene.elements.filter((item) => item.selected && !item.locked)
    const group = element.selected
      ? selectedElements
      : event.shiftKey
        ? [...selectedElements, element]
        : [element]
    const uniqueGroup = group.filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index)
    const bounds = uniqueGroup.reduce((result, item) => {
      const dimensions = getElementDimensions(item)
      return {
        left: Math.min(result.left, item.x),
        top: Math.min(result.top, item.y),
        right: Math.max(result.right, item.x + dimensions.width),
        bottom: Math.max(result.bottom, item.y + dimensions.height),
      }
    }, { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity })

    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      primaryId: element.id,
      starts: uniqueGroup.map((item) => ({ id: item.id, x: item.x, y: item.y })),
      bounds,
      moved: false,
      inTrash: false,
    }
    props.onBeginDrag()
  }

  const moveElementDrag = useCallback((clientX: number, clientY: number) => {
    const currentProps = propsRef.current
    const drag = dragRef.current
    if (!drag) return
    if (!drag.moved && Math.hypot(clientX - drag.startClientX, clientY - drag.startClientY) <= 3) return
    drag.moved = true

    const inTrash = isPalettePoint(clientX, clientY)
    if (inTrash) {
      if (!drag.inTrash) currentProps.onMoveElements(drag.starts)
      drag.inTrash = true
      currentProps.onTrashHover(true)
      return
    }
    if (drag.inTrash) {
      drag.inTrash = false
      currentProps.onTrashHover(false)
    }

    const primary = drag.starts.find((item) => item.id === drag.primaryId)
    if (!primary) return
    const rawX = primary.x + clientX - drag.startClientX
    const rawY = primary.y + clientY - drag.startClientY
    let deltaX = snap(rawX, currentProps.snapToGrid) - primary.x
    let deltaY = snap(rawY, currentProps.snapToGrid) - primary.y
    deltaX = clamp(deltaX, -drag.bounds.left, currentProps.scene.width - drag.bounds.right)
    deltaY = clamp(deltaY, -drag.bounds.top, currentProps.scene.height - drag.bounds.bottom)

    currentProps.onMoveElements(drag.starts.map((item) => ({
      id: item.id,
      x: Math.round(item.x + deltaX),
      y: Math.round(item.y + deltaY),
    })))
  }, [])

  const endElementDrag = useCallback((clientX: number, clientY: number) => {
    const currentProps = propsRef.current
    const drag = dragRef.current
    if (!drag) return
    const droppedInTrash = drag.moved && (drag.inTrash || isPalettePoint(clientX, clientY))
    if (droppedInTrash) currentProps.onMoveElements(drag.starts)
    dragRef.current = null
    currentProps.onTrashHover(false)
    currentProps.onEndDrag()
    if (droppedInTrash) currentProps.onDeleteDragged(drag.starts.map((item) => item.id))
  }, [])

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (dragRef.current?.pointerId === event.pointerId) moveElementDrag(event.clientX, event.clientY)
    }
    const handlePointerEnd = (event: PointerEvent) => {
      if (dragRef.current?.pointerId === event.pointerId) endElementDrag(event.clientX, event.clientY)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerEnd)
    window.addEventListener('pointercancel', handlePointerEnd)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerEnd)
      window.removeEventListener('pointercancel', handlePointerEnd)
    }
  }, [moveElementDrag, endElementDrag])

  const beginSymbolResize = (event: ReactPointerEvent<HTMLButtonElement>, element: CanvasElement) => {
    if (event.button !== 0 || element.kind !== 'symbol' || element.locked) return
    event.preventDefault()
    event.stopPropagation()
    const base = getSymbolBaseDimensions(element.symbolType)
    event.currentTarget.setPointerCapture(event.pointerId)
    symbolResizeRef.current = {
      pointerId: event.pointerId,
      id: element.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startScale: element.scale,
      baseWidth: base.width,
      baseHeight: base.height,
    }
    props.onBeginDrag()
  }

  useEffect(() => {
    const moveSymbolResize = (event: PointerEvent) => {
      const resize = symbolResizeRef.current
      if (!resize || resize.pointerId !== event.pointerId) return
      const delta = Math.max(event.clientX - resize.startClientX, event.clientY - resize.startClientY)
      const baseSize = Math.max(resize.baseWidth, resize.baseHeight)
      propsRef.current.onResizeSymbol(resize.id, clamp(resize.startScale + delta / baseSize, 0.5, 3))
    }
    const endSymbolResize = (event: PointerEvent) => {
      const resize = symbolResizeRef.current
      if (!resize || resize.pointerId !== event.pointerId) return
      symbolResizeRef.current = null
      propsRef.current.onEndDrag()
    }
    window.addEventListener('pointermove', moveSymbolResize)
    window.addEventListener('pointerup', endSymbolResize)
    window.addEventListener('pointercancel', endSymbolResize)
    return () => {
      window.removeEventListener('pointermove', moveSymbolResize)
      window.removeEventListener('pointerup', endSymbolResize)
      window.removeEventListener('pointercancel', endSymbolResize)
    }
  }, [])

  const canvasPoint = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return {
      x: clamp(event.clientX - bounds.left, 0, props.scene.width),
      y: clamp(event.clientY - bounds.top, 0, props.scene.height),
    }
  }

  const beginCanvasPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    if (props.placementMode === 'draw' || props.placementMode === 'line') {
      const point = canvasPoint(event)
      const state = { pointerId: event.pointerId, points: [point] }
      drawingRef.current = state
      setDrawing(state)
      props.onClearSelection()
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }
    if (event.target !== event.currentTarget) return
    const point = canvasPoint(event)
    const state: MarqueeState = {
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y,
      visible: false,
      additive: event.shiftKey,
    }
    marqueeRef.current = state
    setMarquee(state)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveCanvasPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const activeDrawing = drawingRef.current
    if (activeDrawing?.pointerId === event.pointerId) {
      const point = canvasPoint(event)
      const previous = activeDrawing.points.at(-1)
      if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) >= 2) {
        const next = { ...activeDrawing, points: props.placementMode === 'line' ? [activeDrawing.points[0], point] : [...activeDrawing.points, point] }
        drawingRef.current = next
        setDrawing(next)
      }
      return
    }
    const state = marqueeRef.current
    if (!state) return
    const point = canvasPoint(event)
    const next = {
      ...state,
      currentX: point.x,
      currentY: point.y,
      visible: state.visible || Math.hypot(point.x - state.startX, point.y - state.startY) > 4,
    }
    marqueeRef.current = next
    setMarquee(next)
  }

  const finishCanvasPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const activeDrawing = drawingRef.current
    if (activeDrawing?.pointerId === event.pointerId) {
      const point = canvasPoint(event)
      const points = props.placementMode === 'line' ? [activeDrawing.points[0], point] : [...activeDrawing.points, point]
      drawingRef.current = null
      setDrawing(null)
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      if (points.length >= 2 && Math.hypot(points.at(-1)!.x - points[0].x, points.at(-1)!.y - points[0].y) > 3) {
        props.onCommitDrawing(points)
      }
      return
    }
    const state = marqueeRef.current
    if (!state) return
    marqueeRef.current = null
    setMarquee(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (state.visible) {
      const left = Math.min(state.startX, state.currentX)
      const top = Math.min(state.startY, state.currentY)
      const right = Math.max(state.startX, state.currentX)
      const bottom = Math.max(state.startY, state.currentY)
      props.onSelectRange(intersectionIds(props.scene.elements, left, top, right, bottom), state.additive)
      return
    }

    if (props.placementMode === 'text') {
      setEditor({ x: state.startX, y: state.startY, value: '' })
    } else if (props.placementMode !== 'select' && props.placementMode !== 'draw' && props.placementMode !== 'line') {
      props.onPlaceSymbol(props.placementMode, state.startX, state.startY)
    } else {
      props.onClearSelection()
    }
  }

  const finishTextEditor = (cancelled = false) => {
    if (!editor) return
    const text = editor.value.trim()
    if (!cancelled && text) props.onCommitText(text, editor.x, editor.y, editor.id)
    setEditor(null)
    props.onFinishTextEditing()
  }

  const beginResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    resizeRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      width: props.scene.width,
      height: props.scene.height,
    }
    props.onBeginDrag()
  }

  const moveResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const resize = resizeRef.current
    if (!resize) return
    props.onResize(
      clamp(resize.width + event.clientX - resize.startX, MIN_WORKSPACE_WIDTH, MAX_WORKSPACE_WIDTH),
      clamp(resize.height + event.clientY - resize.startY, MIN_WORKSPACE_HEIGHT, MAX_WORKSPACE_HEIGHT),
    )
  }

  const endResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!resizeRef.current) return
    resizeRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    props.onEndDrag()
  }

  const openContextMenu = (event: React.MouseEvent<HTMLButtonElement>, element: CanvasElement) => {
    event.preventDefault()
    event.stopPropagation()
    const canvas = event.currentTarget.closest('.workspace-canvas')?.getBoundingClientRect()
    if (!canvas) return
    props.onOpenContextMenu({
      elementId: element.id,
      clientX: event.clientX,
      clientY: event.clientY,
      canvasX: clamp(event.clientX - canvas.left, 0, props.scene.width),
      canvasY: clamp(event.clientY - canvas.top, 0, props.scene.height),
    })
  }

  const openWorkspaceContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    const canvas = event.currentTarget.getBoundingClientRect()
    props.onOpenContextMenu({
      elementId: null,
      clientX: event.clientX,
      clientY: event.clientY,
      canvasX: clamp(event.clientX - canvas.left, 0, props.scene.width),
      canvasY: clamp(event.clientY - canvas.top, 0, props.scene.height),
    })
  }

  const marqueeStyle = marquee ? {
    left: Math.min(marquee.startX, marquee.currentX),
    top: Math.min(marquee.startY, marquee.currentY),
    width: Math.abs(marquee.currentX - marquee.startX),
    height: Math.abs(marquee.currentY - marquee.startY),
  } : undefined
  const selectedSymbol = props.scene.elements.find((element): element is CanvasElement & { kind: 'symbol' } => element.kind === 'symbol' && element.selected && !element.locked) ?? null

  return (
    <div
      ref={ref}
      className={`workspace-canvas${props.showGrid ? ' show-grid' : ''}${props.placementMode === 'draw' || props.placementMode === 'line' ? ' drawing-mode' : ''}`}
      style={{ width: props.scene.width, height: props.scene.height }}
      onPointerDown={beginCanvasPointer}
      onPointerMove={moveCanvasPointer}
      onPointerUp={finishCanvasPointer}
      onPointerCancel={finishCanvasPointer}
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
        props.onDropTile(tileId, event.clientX - bounds.left - TILE_WIDTH / 2, event.clientY - bounds.top - TILE_HEIGHT / 2)
      }}
      onContextMenu={openWorkspaceContextMenu}
      aria-label="麻雀牌・文字・記号・画像・線の作業エリア"
    >
      {props.scene.elements.length === 0 && !editor && (
        <div className="empty-canvas" aria-hidden="true">
          <div className="empty-tile-stack"><span>東</span><span>一</span><span>●</span></div>
          <p><strong>ここに牌姿を作ります</strong><span>牌一覧からクリック、またはドラッグして追加</span></p>
        </div>
      )}

      {props.scene.elements.map((element) => {
        const dimensions = getElementDimensions(element)
        const lockedLabel = element.locked ? '、ロック中' : ''
        const commonProps = {
          type: 'button' as const,
          className: `placed-item placed-${element.kind}${element.selected ? ' selected' : ''}${element.locked ? ' locked' : ''}`,
          style: {
            left: element.x,
            top: element.y,
            zIndex: element.zIndex,
            width: dimensions.width,
            height: dimensions.height,
          },
          onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
            if (props.placementMode !== 'draw') beginElementDrag(event, element)
          },
          onContextMenu: (event: React.MouseEvent<HTMLButtonElement>) => openContextMenu(event, element),
        }

        if (element.kind === 'tile') {
          const tile = TILE_MAP.get(element.tileId)
          if (!tile) return null
          return (
            <button
              key={element.id}
              {...commonProps}
              className={`${commonProps.className}${element.faceDown ? ' face-down' : ''}`}
              onDoubleClick={(event) => {
                event.stopPropagation()
                if (!element.locked) props.onToggleTileFace(element.id)
              }}
              aria-label={`${tile.label}${element.faceDown ? '、裏向き' : ''}${element.selected ? '、選択中' : ''}${lockedLabel}`}
            >
              {element.faceDown ? (
                <span className="tile-back" style={{ transform: `translate(-50%, -50%) rotate(${element.rotation}deg)` }} />
              ) : (
                <img
                  src={tile.asset}
                  alt={tile.label}
                  draggable={false}
                  style={{ transform: `translate(-50%, -50%) rotate(${element.rotation}deg)` }}
                />
              )}
              {element.locked && <span className="lock-badge" aria-hidden="true">🔒</span>}
            </button>
          )
        }

        if (element.kind === 'text') {
          const baseWidth = Math.max(44, Math.ceil(element.text.length * element.fontSize * 1.05) + 16)
          const baseHeight = Math.ceil(element.fontSize * 1.5) + 8
          return (
            <button
              key={element.id}
              {...commonProps}
              className={`${commonProps.className}${editor?.id === element.id ? ' editing' : ''}`}
              onDoubleClick={() => !element.locked && setEditor({ id: element.id, x: element.x, y: element.y, value: element.text })}
              aria-label={`文字「${element.text}」${element.selected ? '、選択中' : ''}${lockedLabel}`}
            >
              <span
                className="text-visual"
                style={{
                  color: element.color,
                  fontSize: element.fontSize,
                  fontFamily: element.fontFamily,
                  width: baseWidth,
                  height: baseHeight,
                  transform: `translate(-50%, -50%) rotate(${element.rotation}deg)`,
                }}
              >{element.text}</span>
              {element.locked && <span className="lock-badge" aria-hidden="true">🔒</span>}
            </button>
          )
        }

        if (element.kind === 'image') {
          return (
            <button key={element.id} {...commonProps} aria-label={`画像「${element.name}」${element.selected ? '、選択中' : ''}${lockedLabel}`}>
              <img
                className="image-visual"
                src={element.src}
                alt=""
                draggable={false}
                style={{
                  width: element.width,
                  height: element.height,
                  opacity: element.opacity,
                  transform: `translate(-50%, -50%) rotate(${element.rotation}deg)`,
                }}
              />
              {element.locked && <span className="lock-badge" aria-hidden="true">🔒</span>}
            </button>
          )
        }

        if (element.kind === 'drawing') {
          return (
            <button key={element.id} {...commonProps} aria-label={`手描き線${element.selected ? '、選択中' : ''}${lockedLabel}`}>
              <svg
                className="drawing-visual"
                viewBox={`0 0 ${element.width} ${element.height}`}
                style={{ width: element.width, height: element.height, transform: `translate(-50%, -50%) rotate(${element.rotation}deg)` }}
                aria-hidden="true"
              >
                <polyline
                  points={element.points.map((point) => `${point.x},${point.y}`).join(' ')}
                  fill="none"
                  stroke={element.color}
                  strokeWidth={element.strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {element.locked && <span className="lock-badge" aria-hidden="true">🔒</span>}
            </button>
          )
        }

        const base = getSymbolBaseDimensions(element.symbolType)
        const visualWidth = base.width * element.scale
        const visualHeight = base.height * element.scale
        const visualTransform = `translate(-50%, -50%) rotate(${element.rotation}deg)`
        return (
          <button key={element.id} {...commonProps} aria-label={`${SYMBOL_LABELS[element.symbolType]}${element.selected ? '、選択中' : ''}${lockedLabel}`}>
            {element.symbolType === 'triangle' ? (
              <svg
                className="symbol-visual symbol-triangle"
                viewBox="0 0 99 66"
                style={{ width: visualWidth, height: visualHeight, transform: visualTransform }}
                aria-hidden="true"
              >
                <polygon points="49.5,5 94,61 5,61" fill="none" stroke={element.color} strokeWidth={element.strokeWidth} strokeLinejoin="round" />
              </svg>
            ) : (
              <span
                className={`symbol-visual symbol-${element.symbolType}`}
                style={{
                  width: visualWidth,
                  height: visualHeight,
                  transform: visualTransform,
                  color: element.color,
                  borderWidth: element.symbolType === 'rectangle' || element.symbolType === 'circle' ? element.strokeWidth : undefined,
                  fontSize: element.symbolType === 'cross' ? 49 * element.scale : undefined,
                }}
              >{element.symbolType === 'cross' ? '✕' : ''}</span>
            )}
            {element.locked && <span className="lock-badge" aria-hidden="true">🔒</span>}
          </button>
        )
      })}

      {editor && (
        <input
          className="workspace-text-editor export-hidden"
          style={{ left: editor.x, top: editor.y }}
          value={editor.value}
          autoFocus
          placeholder="文字を入力"
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) => setEditor({ ...editor, value: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) event.currentTarget.blur()
            if (event.key === 'Escape') finishTextEditor(true)
          }}
          onBlur={() => finishTextEditor()}
        />
      )}

      {marquee?.visible && <div className="selection-marquee export-hidden" style={marqueeStyle} />}

      {drawing && (
        <svg className="drawing-preview export-hidden" viewBox={`0 0 ${props.scene.width} ${props.scene.height}`} aria-hidden="true">
          <polyline points={drawing.points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#244a40" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}

      {selectedSymbol && (() => {
        const dimensions = getElementDimensions(selectedSymbol)
        return <button
          type="button"
          className="element-resize-handle export-hidden"
          aria-label="選択中の図形の大きさを変更"
          style={{ left: selectedSymbol.x + dimensions.width - 10, top: selectedSymbol.y + dimensions.height - 10 }}
          onPointerDown={(event) => beginSymbolResize(event, selectedSymbol)}
        />
      })()}

      <button
        type="button"
        className="workspace-resize-handle export-hidden"
        aria-label="作業エリアのサイズをドラッグして変更"
        onPointerDown={beginResize}
        onPointerMove={moveResize}
        onPointerUp={endResize}
        onPointerCancel={endResize}
      />
    </div>
  )
})

Workspace.displayName = 'Workspace'
