import { useEffect, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import './App.css'
import { ContextMenu } from './components/ContextMenu'
import { HelpModal } from './components/HelpModal'
import { PropertyEditor } from './components/PropertyEditor'
import { SavedLayoutsDialog } from './components/SavedLayoutsDialog'
import { TilePalette } from './components/TilePalette'
import { Toolbar } from './components/Toolbar'
import { Workspace } from './components/Workspace'
import { WorkspaceSizeControls } from './components/WorkspaceSizeControls'
import { TILE_MAP } from './data/tiles'
import { useSceneHistory } from './hooks/useSceneHistory'
import type {
  CanvasElement,
  ContextMenuState,
  ElementPosition,
  NamedSavedLayout,
  PlacementMode,
  Rotation,
  SavedLayout,
  Scene,
  SymbolElement,
  SymbolType,
  TextElement,
  TileElement,
} from './types'
import {
  DEFAULT_WORKSPACE_HEIGHT,
  DEFAULT_WORKSPACE_WIDTH,
  GRID_SIZE,
  MAX_WORKSPACE_HEIGHT,
  MAX_WORKSPACE_WIDTH,
  MIN_WORKSPACE_HEIGHT,
  MIN_WORKSPACE_WIDTH,
  TILE_GAP,
  TILE_HEIGHT,
  TILE_WIDTH,
  clamp,
  createId,
  getElementDimensions,
  getSceneContentBounds,
  makeSymbol,
  makeText,
  makeTile,
  randomHand,
  snap,
} from './utils/layout'

const AUTO_SAVE_KEY = 'mahjong-layout-tool:auto-v1'
const MANUAL_SAVE_KEY = 'mahjong-layout-tool:manual-v1'
const SAVED_LAYOUTS_KEY = 'mahjong-layout-tool:saved-pages-v1'
const HELP_KEY = 'mahjong-layout-tool:help-seen'
const EMPTY_SCENE: Scene = {
  elements: [],
  width: DEFAULT_WORKSPACE_WIDTH,
  height: DEFAULT_WORKSPACE_HEIGHT,
}

const isRotation = (value: unknown): value is Rotation =>
  value === 0 || value === 90 || value === 180 || value === 270

const isSymbolType = (value: unknown): value is SymbolType =>
  value === 'rectangle' || value === 'cross' || value === 'circle' || value === 'triangle'

const normalizeTextColor = (value: unknown) => {
  if (typeof value !== 'string') return '#172c27'
  const normalized = value.toLowerCase().replace(/\s/g, '')
  if (normalized === '#fff' || normalized === '#ffffff' || normalized === '#f4f0df') return '#172c27'
  return value
}

const parseElement = (value: unknown): CanvasElement | null => {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  if (typeof item.id !== 'string' || typeof item.x !== 'number' || typeof item.y !== 'number') return null
  const base = {
    id: item.id,
    x: Math.max(0, Math.round(item.x)),
    y: Math.max(0, Math.round(item.y)),
    rotation: isRotation(item.rotation) ? item.rotation : 0 as Rotation,
    selected: Boolean(item.selected),
    zIndex: typeof item.zIndex === 'number' ? item.zIndex : 1,
    locked: Boolean(item.locked),
  }
  if (item.kind === 'tile' && typeof item.tileId === 'string' && TILE_MAP.has(item.tileId)) {
    return { ...base, kind: 'tile', tileId: item.tileId, faceDown: Boolean(item.faceDown) }
  }
  if (item.kind === 'text' && typeof item.text === 'string') {
    return {
      ...base,
      kind: 'text',
      text: item.text,
      color: normalizeTextColor(item.color),
      fontSize: typeof item.fontSize === 'number' ? clamp(item.fontSize, 12, 72) : 22,
    }
  }
  if (item.kind === 'symbol' && isSymbolType(item.symbolType)) {
    return {
      ...base,
      kind: 'symbol',
      symbolType: item.symbolType,
      color: typeof item.color === 'string' ? item.color : item.symbolType === 'cross' ? '#b13f34' : '#244a40',
      strokeWidth: typeof item.strokeWidth === 'number' ? clamp(item.strokeWidth, 1, 12) : 4,
      scale: typeof item.scale === 'number' ? clamp(item.scale, 0.5, 3) : 1,
    }
  }
  return null
}

const migrateVersionOne = (data: Record<string, unknown>): SavedLayout | null => {
  const oldScene = data.scene as Record<string, unknown> | undefined
  if (!oldScene || !Array.isArray(oldScene.tiles) || !Array.isArray(oldScene.texts)) return null
  const tiles = oldScene.tiles.map((value) => {
    if (!value || typeof value !== 'object') return null
    return parseElement({ ...(value as Record<string, unknown>), kind: 'tile' })
  }).filter((item): item is CanvasElement => item !== null)
  const texts = oldScene.texts.map((value) => {
    if (!value || typeof value !== 'object') return null
    return parseElement({ ...(value as Record<string, unknown>), kind: 'text' })
  }).filter((item): item is CanvasElement => item !== null)
  const settings = data.settings as Record<string, unknown> | undefined
  return {
    version: 3,
    savedAt: typeof data.savedAt === 'string' ? data.savedAt : new Date().toISOString(),
    scene: { elements: [...tiles, ...texts], width: DEFAULT_WORKSPACE_WIDTH, height: DEFAULT_WORKSPACE_HEIGHT },
    settings: {
      showGrid: settings?.showGrid !== false,
      snapToGrid: settings?.snapToGrid === true,
    },
  }
}

const parseSavedLayout = (raw: string | null): SavedLayout | null => {
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as Record<string, unknown>
    if (data.version === 1) return migrateVersionOne(data)
    const scene = data.scene as Record<string, unknown> | undefined
    if ((data.version !== 2 && data.version !== 3) || !scene || !Array.isArray(scene.elements)) return null
    const elements = scene.elements.map(parseElement).filter((item): item is CanvasElement => item !== null)
    const settings = data.settings as Record<string, unknown> | undefined
    const initialScene: Scene = {
      elements,
      width: clamp(typeof scene.width === 'number' ? scene.width : DEFAULT_WORKSPACE_WIDTH, MIN_WORKSPACE_WIDTH, MAX_WORKSPACE_WIDTH),
      height: clamp(typeof scene.height === 'number' ? scene.height : DEFAULT_WORKSPACE_HEIGHT, MIN_WORKSPACE_HEIGHT, MAX_WORKSPACE_HEIGHT),
    }
    const bounds = getSceneContentBounds(initialScene)
    return {
      version: 3,
      savedAt: typeof data.savedAt === 'string' ? data.savedAt : new Date().toISOString(),
      scene: {
        ...initialScene,
        width: Math.max(initialScene.width, bounds.width),
        height: Math.max(initialScene.height, bounds.height),
      },
      settings: {
        showGrid: settings?.showGrid !== false,
        snapToGrid: settings?.snapToGrid === true,
      },
    }
  } catch {
    return null
  }
}

const readNamedSavedLayouts = (): NamedSavedLayout[] => {
  try {
    const data = JSON.parse(localStorage.getItem(SAVED_LAYOUTS_KEY) ?? '[]') as unknown
    if (!Array.isArray(data)) return []
    return data.flatMap((value) => {
      if (!value || typeof value !== 'object') return []
      const item = value as Record<string, unknown>
      const layout = parseSavedLayout(JSON.stringify(item.layout))
      if (typeof item.id !== 'string' || typeof item.name !== 'string' || !layout) return []
      return [{
        id: item.id,
        name: item.name,
        savedAt: typeof item.savedAt === 'string' ? item.savedAt : layout.savedAt,
        layout,
      }]
    })
  } catch {
    return []
  }
}

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

const App = () => {
  const [initialLayout] = useState(() => parseSavedLayout(localStorage.getItem(AUTO_SAVE_KEY)))
  const history = useSceneHistory(initialLayout?.scene ?? EMPTY_SCENE)
  const scene = history.scene
  const [showGrid, setShowGrid] = useState(initialLayout?.settings.showGrid ?? true)
  const [snapToGrid, setSnapToGrid] = useState(initialLayout?.settings.snapToGrid ?? false)
  const [screenshotGrid, setScreenshotGrid] = useState(true)
  const [placementMode, setPlacementMode] = useState<PlacementMode>('select')
  const [editTextRequest, setEditTextRequest] = useState<{ id: string; token: number } | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [propertyElementId, setPropertyElementId] = useState<string | null>(null)
  const [clipboard, setClipboard] = useState<CanvasElement[]>([])
  const [trashActive, setTrashActive] = useState(false)
  const [savedLayouts, setSavedLayouts] = useState<NamedSavedLayout[]>(readNamedSavedLayouts)
  const [savedLayoutsOpen, setSavedLayoutsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(() => localStorage.getItem(HELP_KEY) !== '1')
  const [toast, setToast] = useState('')
  const workspaceRef = useRef<HTMLDivElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const toastTimerRef = useRef<number | null>(null)

  const notify = (message: string) => {
    setToast(message)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(''), 2400)
  }

  const makeSavedLayout = (): SavedLayout => ({
    version: 3,
    savedAt: new Date().toISOString(),
    scene,
    settings: { showGrid, snapToGrid },
  })

  useEffect(() => {
    localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify({
      version: 3,
      savedAt: new Date().toISOString(),
      scene,
      settings: { showGrid, snapToGrid },
    } satisfies SavedLayout))
  }, [scene, showGrid, snapToGrid])

  const nextZIndex = () => Math.max(0, ...scene.elements.map((element) => element.zIndex)) + 1

  const addTile = (tileId: string, dropX?: number, dropY?: number) => {
    const tileCount = scene.elements.filter((element) => element.kind === 'tile').length
    const defaultX = 24 + tileCount * (TILE_WIDTH + TILE_GAP)
    const x = dropX ?? defaultX
    const y = dropY ?? 32
    const width = clamp(Math.max(scene.width, x + TILE_WIDTH + 24), MIN_WORKSPACE_WIDTH, MAX_WORKSPACE_WIDTH)
    history.commit({
      ...scene,
      width,
      elements: [
        ...scene.elements,
        makeTile(
          tileId,
          clamp(snap(x, snapToGrid), 0, width - TILE_WIDTH),
          clamp(snap(y, snapToGrid), 0, scene.height - TILE_HEIGHT),
          nextZIndex(),
        ),
      ],
    })
  }

  const selectElement = (id: string, additive: boolean) => {
    const target = scene.elements.find((element) => element.id === id)
    if (!target) return
    const preserveGroup = target.selected && !additive
    history.updateLive({
      ...scene,
      elements: scene.elements.map((element) => ({
        ...element,
        selected: element.id === id
          ? additive ? !element.selected : true
          : additive || preserveGroup ? element.selected : false,
      })),
    })
  }

  const selectRange = (ids: string[], additive: boolean) => {
    const selectedIds = new Set(ids)
    history.updateLive({
      ...scene,
      elements: scene.elements.map((element) => ({
        ...element,
        selected: additive ? element.selected || selectedIds.has(element.id) : selectedIds.has(element.id),
      })),
    })
  }

  const clearSelection = () => {
    if (!scene.elements.some((element) => element.selected)) return
    history.updateLive({ ...scene, elements: scene.elements.map((element) => ({ ...element, selected: false })) })
  }

  const moveElements = (positions: ElementPosition[]) => {
    const byId = new Map(positions.map((position) => [position.id, position]))
    history.updateLive({
      ...scene,
      elements: scene.elements.map((element) => {
        const position = byId.get(element.id)
        return position && !element.locked ? { ...element, x: position.x, y: position.y } : element
      }),
    })
  }

  const deleteElements = (ids: string[]) => {
    const targetIds = new Set(ids)
    const elements = scene.elements.filter((element) => !targetIds.has(element.id) || element.locked)
    if (elements.length === scene.elements.length) return
    history.commit({ ...scene, elements })
    notify('牌一覧へドロップした配置物を削除しました')
  }

  const deleteSelected = () => {
    const elements = scene.elements.filter((element) => !element.selected || element.locked)
    if (elements.length === scene.elements.length) return
    history.commit({ ...scene, elements })
  }

  const toggleTileFace = (id: string) => {
    history.commit({
      ...scene,
      elements: scene.elements.map((element) => element.id === id && element.kind === 'tile' && !element.locked
        ? { ...element, faceDown: !element.faceDown }
        : element),
    })
  }

  const rotateSelected = () => {
    if (!scene.elements.some((element) => element.selected && !element.locked)) return
    history.commit({
      ...scene,
      elements: scene.elements.map((element) => {
        if (!element.selected || element.locked) return element
        const rotation = ((element.rotation + 90) % 360) as Rotation
        const rotated = { ...element, rotation } as CanvasElement
        const dimensions = getElementDimensions(rotated)
        return {
          ...rotated,
          x: clamp(rotated.x, 0, scene.width - dimensions.width),
          y: clamp(rotated.y, 0, scene.height - dimensions.height),
        }
      }),
    })
  }

  const alignTiles = () => {
    const tiles = scene.elements.filter((element) => element.kind === 'tile' && !element.locked)
    if (!tiles.length) return
    const selectedTiles = tiles.filter((tile) => tile.selected)
    const targets = selectedTiles.length ? selectedTiles : tiles
    const targetIds = new Set(targets.map((tile) => tile.id))
    const totalWidth = targets.length * TILE_WIDTH + Math.max(0, targets.length - 1) * TILE_GAP
    const width = clamp(Math.max(scene.width, totalWidth + 40), MIN_WORKSPACE_WIDTH, MAX_WORKSPACE_WIDTH)
    const startX = clamp(Math.min(...targets.map((tile) => tile.x)), 20, width - totalWidth - 20)
    const y = clamp(Math.min(...targets.map((tile) => tile.y)), 20, scene.height - TILE_HEIGHT)
    history.commit({
      ...scene,
      width,
      elements: scene.elements.map((element) => {
        const index = targets.findIndex((target) => target.id === element.id)
        return targetIds.has(element.id)
          ? { ...element, x: startX + index * (TILE_WIDTH + TILE_GAP), y, rotation: 0 as Rotation }
          : element
      }),
    })
    notify(selectedTiles.length ? `${selectedTiles.length}枚を等間隔で整列しました` : 'すべての牌を等間隔で整列しました')
  }

  const generateHand = (count: 13 | 14) => {
    const tileIds = randomHand(count)
    const totalWidth = count * TILE_WIDTH + (count - 1) * TILE_GAP
    const width = clamp(Math.max(scene.width, totalWidth + 40), MIN_WORKSPACE_WIDTH, MAX_WORKSPACE_WIDTH)
    const startX = Math.max(20, (width - totalWidth) / 2)
    const zStart = nextZIndex()
    const nonTiles = scene.elements.filter((element) => element.kind !== 'tile').map((element) => ({ ...element, selected: false }))
    history.commit({
      ...scene,
      width,
      elements: [
        ...nonTiles,
        ...tileIds.map((tileId, index) => makeTile(tileId, startX + index * (TILE_WIDTH + TILE_GAP), 76, zStart + index)),
      ],
    })
    notify(`${count}枚の配牌を生成し、理牌しました`)
  }

  const shuffleTiles = () => {
    const tileIds = scene.elements
      .filter((element): element is TileElement => element.kind === 'tile' && !element.locked)
      .map((tile) => tile.tileId)
    if (!tileIds.length) return
    for (let index = tileIds.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1))
      ;[tileIds[index], tileIds[target]] = [tileIds[target], tileIds[index]]
    }
    let tileIndex = 0
    history.commit({
      ...scene,
      elements: scene.elements.map((element) => element.kind === 'tile' && !element.locked
        ? { ...element, tileId: tileIds[tileIndex++] }
        : element),
    })
    notify('配置位置を保ったまま牌をシャッフルしました')
  }

  const commitText = (text: string, x = 40, y?: number, id?: string) => {
    if (id) {
      history.commit({
        ...scene,
        elements: scene.elements.map((element) => element.id === id && element.kind === 'text' && !element.locked
          ? { ...element, text }
          : element),
      })
      return
    }
    const textCount = scene.elements.filter((element) => element.kind === 'text').length
    const item = makeText(text, x, y ?? Math.min(scene.height - 50, 180 + textCount * 48), nextZIndex())
    const dimensions = getElementDimensions(item)
    item.x = clamp(item.x, 0, scene.width - dimensions.width)
    item.y = clamp(item.y, 0, scene.height - dimensions.height)
    history.commit({ ...scene, elements: [...scene.elements, item] })
  }

  const placeSymbol = (symbolType: SymbolType, x: number, y: number) => {
    const item = makeSymbol(symbolType, x, y, nextZIndex())
    const dimensions = getElementDimensions(item)
    item.x = clamp(snap(x - dimensions.width / 2, snapToGrid), 0, scene.width - dimensions.width)
    item.y = clamp(snap(y - dimensions.height / 2, snapToGrid), 0, scene.height - dimensions.height)
    history.commit({ ...scene, elements: [...scene.elements, item] })
  }

  const duplicateSelected = () => {
    const sources = scene.elements.filter((element) => element.selected)
    if (!sources.length) return
    const zStart = nextZIndex()
    const copies = sources.map((source, index) => {
      const dimensions = getElementDimensions(source)
      return {
        ...source,
        id: createId(source.kind),
        x: clamp(source.x + 18, 0, scene.width - dimensions.width),
        y: clamp(source.y + 18, 0, scene.height - dimensions.height),
        selected: true,
        locked: false,
        zIndex: zStart + index,
      }
    }) as CanvasElement[]
    history.commit({
      ...scene,
      elements: [...scene.elements.map((element) => ({ ...element, selected: false })), ...copies],
    })
  }

  const copySelected = () => {
    const sources = scene.elements.filter((element) => element.selected)
    if (!sources.length) return
    setClipboard(sources.map((element) => ({ ...element })))
    notify(`${sources.length}件をコピーしました`)
  }

  const pasteClipboard = (anchor?: { x: number; y: number }) => {
    if (!clipboard.length) return
    const minX = Math.min(...clipboard.map((element) => element.x))
    const minY = Math.min(...clipboard.map((element) => element.y))
    const offsetX = anchor ? anchor.x - minX : 20
    const offsetY = anchor ? anchor.y - minY : 20
    const zStart = nextZIndex()
    const copies = clipboard.map((source, index) => {
      const dimensions = getElementDimensions(source)
      return {
        ...source,
        id: createId(source.kind),
        x: clamp(source.x + offsetX, 0, scene.width - dimensions.width),
        y: clamp(source.y + offsetY, 0, scene.height - dimensions.height),
        selected: true,
        locked: false,
        zIndex: zStart + index,
      }
    }) as CanvasElement[]
    history.commit({
      ...scene,
      elements: [...scene.elements.map((element) => ({ ...element, selected: false })), ...copies],
    })
  }

  const moveSelectedBy = (requestedX: number, requestedY: number) => {
    const selected = scene.elements.filter((element) => element.selected && !element.locked)
    if (!selected.length) return
    const bounds = selected.reduce((result, element) => {
      const dimensions = getElementDimensions(element)
      return {
        left: Math.min(result.left, element.x),
        top: Math.min(result.top, element.y),
        right: Math.max(result.right, element.x + dimensions.width),
        bottom: Math.max(result.bottom, element.y + dimensions.height),
      }
    }, { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity })
    const deltaX = clamp(requestedX, -bounds.left, scene.width - bounds.right)
    const deltaY = clamp(requestedY, -bounds.top, scene.height - bounds.bottom)
    history.commit({
      ...scene,
      elements: scene.elements.map((element) => element.selected && !element.locked
        ? { ...element, x: element.x + deltaX, y: element.y + deltaY }
        : element),
    })
  }

  const toggleLock = (id: string) => {
    history.commit({
      ...scene,
      elements: scene.elements.map((element) => element.id === id ? { ...element, locked: !element.locked } : element),
    })
  }

  const moveLayer = (id: string, direction: 'front' | 'back') => {
    const target = scene.elements.find((element) => element.id === id)
    if (!target || target.locked) return
    const zIndex = direction === 'front'
      ? Math.max(0, ...scene.elements.map((element) => element.zIndex)) + 1
      : Math.min(0, ...scene.elements.map((element) => element.zIndex)) - 1
    history.commit({
      ...scene,
      elements: scene.elements.map((element) => element.id === id ? { ...element, zIndex } : element),
    })
  }

  const saveProperties = (
    id: string,
    properties: { text?: string; color: string; fontSize?: number; scale?: number; strokeWidth?: number },
  ) => {
    history.commit({
      ...scene,
      elements: scene.elements.map((element) => {
        if (element.id !== id || element.locked || element.kind === 'tile') return element
        const updated: TextElement | SymbolElement = element.kind === 'text'
          ? {
              ...element,
              text: properties.text ?? element.text,
              color: properties.color,
              fontSize: clamp(properties.fontSize ?? element.fontSize, 12, 72),
            }
          : {
              ...element,
              color: properties.color,
              scale: clamp(properties.scale ?? element.scale, 0.5, 3),
              strokeWidth: clamp(properties.strokeWidth ?? element.strokeWidth, 1, 12),
            }
        const dimensions = getElementDimensions(updated)
        return {
          ...updated,
          x: clamp(updated.x, 0, scene.width - dimensions.width),
          y: clamp(updated.y, 0, scene.height - dimensions.height),
        }
      }),
    })
    setPropertyElementId(null)
  }

  const openContextMenu = (state: ContextMenuState) => {
    if (state.elementId === null) {
      setContextMenu(state)
      return
    }
    const target = scene.elements.find((element) => element.id === state.elementId)
    if (!target) return
    if (!target.selected) selectElement(target.id, false)
    setContextMenu(state)
  }

  const resizeWorkspace = (width: number, height: number, live = false) => {
    const bounds = getSceneContentBounds(scene)
    const nextScene = {
      ...scene,
      width: clamp(Math.max(width, bounds.width), MIN_WORKSPACE_WIDTH, MAX_WORKSPACE_WIDTH),
      height: clamp(Math.max(height, bounds.height), MIN_WORKSPACE_HEIGHT, MAX_WORKSPACE_HEIGHT),
    }
    if (live) history.updateLive(nextScene)
    else history.commit(nextScene)
  }

  const saveLocal = () => {
    localStorage.setItem(MANUAL_SAVE_KEY, JSON.stringify(makeSavedLayout()))
    notify('配置、表裏、ロック、文字、記号を保存しました')
  }

  const loadLayout = (layout: SavedLayout, message: string) => {
    history.load(layout.scene)
    setShowGrid(layout.settings.showGrid)
    setSnapToGrid(layout.settings.snapToGrid)
    setPlacementMode('select')
    setContextMenu(null)
    notify(message)
  }

  const loadLocal = () => {
    const layout = parseSavedLayout(localStorage.getItem(MANUAL_SAVE_KEY))
    if (!layout) {
      notify('ブラウザ保存データがありません')
      return
    }
    loadLayout(layout, '保存した配置を復元しました')
  }

  const saveNamedLayout = (name: string) => {
    const layout = makeSavedLayout()
    const saved: NamedSavedLayout = {
      id: createId('saved-layout'),
      name,
      savedAt: layout.savedAt,
      layout: {
        ...layout,
        scene: { ...layout.scene, elements: layout.scene.elements.map((element) => ({ ...element })) },
      },
    }
    const next = [saved, ...savedLayouts]
    try {
      localStorage.setItem(SAVED_LAYOUTS_KEY, JSON.stringify(next))
      setSavedLayouts(next)
      notify(`「${name}」を保存しました`)
    } catch {
      notify('保存容量が不足しています。不要な保存ページを削除してください')
    }
  }

  const loadNamedLayout = (id: string) => {
    const saved = savedLayouts.find((item) => item.id === id)
    if (!saved) return
    loadLayout(saved.layout, `「${saved.name}」を呼び出しました`)
    setSavedLayoutsOpen(false)
  }

  const deleteNamedLayout = (id: string) => {
    const saved = savedLayouts.find((item) => item.id === id)
    if (!saved) return
    const next = savedLayouts.filter((item) => item.id !== id)
    try {
      localStorage.setItem(SAVED_LAYOUTS_KEY, JSON.stringify(next))
      setSavedLayouts(next)
      notify(`「${saved.name}」を削除しました`)
    } catch {
      notify('保存ページを更新できませんでした')
    }
  }

  const exportJson = () => {
    downloadBlob(new Blob([JSON.stringify(makeSavedLayout(), null, 2)], { type: 'application/json' }), 'mahjong-layout.json')
    notify('JSONを書き出しました')
  }

  const importJson = async (file: File) => {
    const layout = parseSavedLayout(await file.text())
    if (!layout) {
      notify('読み込めないJSON形式です')
      return
    }
    loadLayout(layout, 'JSONから配置を読み込みました')
  }

  const saveScreenshot = async () => {
    const canvas = workspaceRef.current
    if (!canvas) return
    try {
      canvas.classList.add('is-capturing')
      if (!screenshotGrid) canvas.classList.add('capture-hide-grid')
      await new Promise(requestAnimationFrame)
      const dataUrl = await toPng(canvas, { cacheBust: true, pixelRatio: 2, backgroundColor: '#ffffff' })
      const response = await fetch(dataUrl)
      downloadBlob(await response.blob(), `mahjong-layout-${new Date().toISOString().slice(0, 10)}.png`)
      notify('作業エリアをPNGで保存しました')
    } catch {
      notify('PNGの保存に失敗しました')
    } finally {
      canvas.classList.remove('is-capturing', 'capture-hide-grid')
    }
  }

  const keyboardActions = useRef({
    deleteSelected,
    rotateSelected,
    duplicateSelected,
    copySelected,
    pasteClipboard: () => pasteClipboard(),
    moveSelectedBy,
    clearSelection,
    undo: history.undo,
    redo: history.redo,
  })
  keyboardActions.current = {
    deleteSelected,
    rotateSelected,
    duplicateSelected,
    copySelected,
    pasteClipboard: () => pasteClipboard(),
    moveSelectedBy,
    clearSelection,
    undo: history.undo,
    redo: history.redo,
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (event.key === 'Escape') {
        setContextMenu(null)
        setPropertyElementId(null)
        setPlacementMode('select')
        keyboardActions.current.clearSelection()
        return
      }
      if (target.matches('input, textarea, select')) return

      const command = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()
      if (command && key === 'c') {
        event.preventDefault()
        keyboardActions.current.copySelected()
      } else if (command && key === 'v') {
        event.preventDefault()
        keyboardActions.current.pasteClipboard()
      } else if (command && key === 'd') {
        event.preventDefault()
        keyboardActions.current.duplicateSelected()
      } else if (command && key === 'z') {
        event.preventDefault()
        if (event.shiftKey) keyboardActions.current.redo()
        else keyboardActions.current.undo()
      } else if (command && key === 'y') {
        event.preventDefault()
        keyboardActions.current.redo()
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        keyboardActions.current.deleteSelected()
      } else if (event.key.startsWith('Arrow')) {
        event.preventDefault()
        const amount = event.shiftKey ? 10 : 1
        const delta = {
          ArrowLeft: [-amount, 0],
          ArrowRight: [amount, 0],
          ArrowUp: [0, -amount],
          ArrowDown: [0, amount],
        }[event.key]
        if (delta) keyboardActions.current.moveSelectedBy(delta[0], delta[1])
      } else if (key === 'r' && !command) {
        keyboardActions.current.rotateSelected()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const selected = scene.elements.filter((element) => element.selected)
  const selectedText = selected.length === 1 && selected[0].kind === 'text' && !selected[0].locked ? selected[0] : null
  const tileCount = scene.elements.filter((element) => element.kind === 'tile').length
  const contextElement = contextMenu ? scene.elements.find((element) => element.id === contextMenu.elementId) ?? null : null
  const propertyElement = propertyElementId
    ? scene.elements.find((element): element is TextElement | SymbolElement => element.id === propertyElementId && element.kind !== 'tile') ?? null
    : null

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true"><span>牌</span></div>
        <div className="brand-copy">
          <span className="eyebrow">MAHJONG CANVAS</span>
          <h1>麻雀牌レイアウトツール</h1>
        </div>
        <div className="header-status">
          <span><i className="status-dot" />自動保存</span>
          <strong>{tileCount}<small>枚の牌</small></strong>
        </div>
      </header>

      <Toolbar
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        hasItems={scene.elements.length > 0}
        hasSelection={selected.some((element) => !element.locked)}
        canEditText={Boolean(selectedText)}
        canDuplicate={selected.length > 0}
        showGrid={showGrid}
        snapToGrid={snapToGrid}
        screenshotGrid={screenshotGrid}
        placementMode={placementMode}
        onClear={() => history.commit({ ...EMPTY_SCENE, width: scene.width, height: scene.height })}
        onUndo={history.undo}
        onRedo={history.redo}
        onAlign={alignTiles}
        onDeleteSelected={deleteSelected}
        onDuplicate={duplicateSelected}
        onRotate={rotateSelected}
        onEditSelectedText={() => selectedText && setEditTextRequest({ id: selectedText.id, token: Date.now() })}
        onRandomHand={generateHand}
        onShuffle={shuffleTiles}
        onSetPlacementMode={setPlacementMode}
        onToggleGrid={() => setShowGrid((value) => !value)}
        onToggleSnap={() => setSnapToGrid((value) => !value)}
        onSaveLocal={saveLocal}
        onLoadLocal={loadLocal}
        onOpenSavedLayouts={() => setSavedLayoutsOpen(true)}
        onExportJson={exportJson}
        onImportJson={() => importInputRef.current?.click()}
        onAddText={(text) => commitText(text)}
        onScreenshot={saveScreenshot}
        onToggleScreenshotGrid={() => setScreenshotGrid((value) => !value)}
        onHelp={() => setHelpOpen(true)}
      />

      <main className="app-body">
        <TilePalette
          onAddTile={addTile}
          placementMode={placementMode}
          trashActive={trashActive}
          onSelectPlacementMode={setPlacementMode}
        />
        <section className="workspace-panel">
          <div className="workspace-meta">
            <div>
              <span className="canvas-badge">WORKSPACE</span>
              <span>{selected.length ? `${selected.length}件を選択中` : placementMode === 'select' ? '空白をドラッグして範囲選択' : '同じツールを連続配置できます（Escで解除）'}</span>
            </div>
            <div className="workspace-meta-actions">
              <WorkspaceSizeControls
                width={scene.width}
                height={scene.height}
                onChange={(width, height) => resizeWorkspace(width, height)}
              />
              <div className="legend"><span><i className="legend-grid" />{GRID_SIZE}pxグリッド</span><span><i className="legend-select" />選択中</span></div>
            </div>
          </div>
          <div className="workspace-scroll">
            <Workspace
              ref={workspaceRef}
              scene={scene}
              showGrid={showGrid}
              snapToGrid={snapToGrid}
              placementMode={placementMode}
              editTextRequest={editTextRequest}
              onDropTile={addTile}
              onSelectElement={selectElement}
              onSelectRange={selectRange}
              onClearSelection={clearSelection}
              onMoveElements={moveElements}
              onDeleteDragged={deleteElements}
              onTrashHover={setTrashActive}
              onPlaceSymbol={placeSymbol}
              onCommitText={commitText}
              onFinishTextEditing={() => setEditTextRequest(null)}
              onToggleTileFace={toggleTileFace}
              onOpenContextMenu={openContextMenu}
              onResize={(width, height) => resizeWorkspace(width, height, true)}
              onBeginDrag={history.beginTransaction}
              onEndDrag={history.endTransaction}
            />
          </div>
        </section>
      </main>

      <input
        ref={importInputRef}
        className="visually-hidden"
        type="file"
        accept="application/json,.json"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void importJson(file)
          event.target.value = ''
        }}
      />

      {contextMenu && (
        <ContextMenu
          x={contextMenu.clientX}
          y={contextMenu.clientY}
          element={contextElement}
          hasSelection={selected.length > 0}
          canModifySelection={selected.some((element) => !element.locked)}
          canPaste={clipboard.length > 0}
          canUndo={history.canUndo}
          canRedo={history.canRedo}
          onClose={() => setContextMenu(null)}
          onDuplicate={duplicateSelected}
          onDelete={deleteSelected}
          onCopy={copySelected}
          onPaste={() => pasteClipboard({ x: contextMenu.canvasX, y: contextMenu.canvasY })}
          onAddRectangle={() => placeSymbol('rectangle', contextMenu.canvasX, contextMenu.canvasY)}
          onAddTriangle={() => placeSymbol('triangle', contextMenu.canvasX, contextMenu.canvasY)}
          onAddCircle={() => placeSymbol('circle', contextMenu.canvasX, contextMenu.canvasY)}
          onAddCross={() => placeSymbol('cross', contextMenu.canvasX, contextMenu.canvasY)}
          onSelectMode={() => setPlacementMode('select')}
          onTextMode={() => setPlacementMode('text')}
          onToggleFace={() => contextElement && toggleTileFace(contextElement.id)}
          onToggleLock={() => contextElement && toggleLock(contextElement.id)}
          onEditProperties={() => contextElement && setPropertyElementId(contextElement.id)}
          onBringFront={() => contextElement && moveLayer(contextElement.id, 'front')}
          onSendBack={() => contextElement && moveLayer(contextElement.id, 'back')}
          onUndo={history.undo}
          onRedo={history.redo}
        />
      )}

      {propertyElement && (
        <PropertyEditor
          key={propertyElement.id}
          element={propertyElement}
          onSave={(properties) => saveProperties(propertyElement.id, properties)}
          onClose={() => setPropertyElementId(null)}
        />
      )}

      {savedLayoutsOpen && (
        <SavedLayoutsDialog
          layouts={savedLayouts}
          onSave={saveNamedLayout}
          onLoad={loadNamedLayout}
          onDelete={deleteNamedLayout}
          onClose={() => setSavedLayoutsOpen(false)}
        />
      )}

      {toast && <div className="toast" role="status">✓ {toast}</div>}
      {helpOpen && <HelpModal onClose={() => { localStorage.setItem(HELP_KEY, '1'); setHelpOpen(false) }} />}
    </div>
  )
}

export default App
