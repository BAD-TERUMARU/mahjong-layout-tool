import { useEffect, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import './App.css'
import { HelpModal } from './components/HelpModal'
import { TilePalette } from './components/TilePalette'
import { Toolbar } from './components/Toolbar'
import { Workspace } from './components/Workspace'
import { TILE_MAP } from './data/tiles'
import { useSceneHistory } from './hooks/useSceneHistory'
import type { Rotation, SavedLayout, Scene } from './types'
import {
  GRID_SIZE,
  TILE_GAP,
  TILE_HEIGHT,
  TILE_WIDTH,
  clamp,
  createId,
  getTileDimensions,
  makeTile,
  randomHand,
  snap,
} from './utils/layout'

const AUTO_SAVE_KEY = 'mahjong-layout-tool:auto-v1'
const MANUAL_SAVE_KEY = 'mahjong-layout-tool:manual-v1'
const HELP_KEY = 'mahjong-layout-tool:help-seen'
const EMPTY_SCENE: Scene = { tiles: [], texts: [] }

const parseSavedLayout = (raw: string | null): SavedLayout | null => {
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as Partial<SavedLayout>
    if (data.version !== 1 || !data.scene || !Array.isArray(data.scene.tiles) || !Array.isArray(data.scene.texts)) return null
    const tiles = data.scene.tiles.filter(
      (tile) => tile && typeof tile.id === 'string' && typeof tile.tileId === 'string' && TILE_MAP.has(tile.tileId),
    )
    const texts = data.scene.texts.filter((item) => item && typeof item.id === 'string' && typeof item.text === 'string')
    return {
      version: 1,
      savedAt: typeof data.savedAt === 'string' ? data.savedAt : new Date().toISOString(),
      scene: { tiles, texts },
      settings: {
        showGrid: data.settings?.showGrid ?? true,
        snapToGrid: data.settings?.snapToGrid ?? false,
      },
    }
  } catch {
    return null
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
    version: 1,
    savedAt: new Date().toISOString(),
    scene,
    settings: { showGrid, snapToGrid },
  })

  useEffect(() => {
    const layout: SavedLayout = {
      version: 1,
      savedAt: new Date().toISOString(),
      scene,
      settings: { showGrid, snapToGrid },
    }
    localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(layout))
  }, [scene, showGrid, snapToGrid])

  const nextZIndex = () =>
    Math.max(0, ...scene.tiles.map((tile) => tile.zIndex), ...scene.texts.map((text) => text.zIndex)) + 1

  const addTile = (tileId: string, dropX?: number, dropY?: number) => {
    const canvas = workspaceRef.current
    const columnCount = Math.max(1, Math.floor(((canvas?.clientWidth ?? 800) - 40) / (TILE_WIDTH + TILE_GAP)))
    const index = scene.tiles.length
    const x = dropX ?? 24 + (index % columnCount) * (TILE_WIDTH + TILE_GAP)
    const y = dropY ?? 32 + Math.floor(index / columnCount) * (TILE_HEIGHT + TILE_GAP)
    const maxX = (canvas?.clientWidth ?? 800) - TILE_WIDTH
    const maxY = (canvas?.clientHeight ?? 560) - TILE_HEIGHT
    history.commit({
      ...scene,
      tiles: [...scene.tiles, makeTile(tileId, clamp(snap(x, snapToGrid), 0, maxX), clamp(snap(y, snapToGrid), 0, maxY), nextZIndex())],
    })
  }

  const selectOnly = (kind: 'tile' | 'text', id: string, additive: boolean) => {
    const maxZ = nextZIndex()
    history.updateLive({
      tiles: scene.tiles.map((tile) => ({
        ...tile,
        selected: kind === 'tile' && tile.id === id ? (additive ? !tile.selected : true) : additive ? tile.selected : false,
        zIndex: kind === 'tile' && tile.id === id ? maxZ : tile.zIndex,
      })),
      texts: scene.texts.map((item) => ({
        ...item,
        selected: kind === 'text' && item.id === id ? (additive ? !item.selected : true) : additive ? item.selected : false,
        zIndex: kind === 'text' && item.id === id ? maxZ : item.zIndex,
      })),
    })
  }

  const clearSelection = () => {
    if (![...scene.tiles, ...scene.texts].some((item) => item.selected)) return
    history.updateLive({
      tiles: scene.tiles.map((tile) => ({ ...tile, selected: false })),
      texts: scene.texts.map((text) => ({ ...text, selected: false })),
    })
  }

  const deleteSelected = () => {
    const next = {
      tiles: scene.tiles.filter((tile) => !tile.selected),
      texts: scene.texts.filter((item) => !item.selected),
    }
    if (next.tiles.length === scene.tiles.length && next.texts.length === scene.texts.length) return
    history.commit(next)
  }

  const rotateSelected = () => {
    const rotate = (rotation: Rotation) => ((rotation + 90) % 360) as Rotation
    const canvasWidth = workspaceRef.current?.clientWidth ?? 800
    const canvasHeight = workspaceRef.current?.clientHeight ?? 560
    history.commit({
      tiles: scene.tiles.map((tile) => {
        if (!tile.selected) return tile
        const rotation = rotate(tile.rotation)
        const dimensions = getTileDimensions(rotation)
        return {
          ...tile,
          rotation,
          x: clamp(tile.x, 0, canvasWidth - dimensions.width),
          y: clamp(tile.y, 0, canvasHeight - dimensions.height),
        }
      }),
      texts: scene.texts.map((text) => (text.selected ? { ...text, rotation: rotate(text.rotation) } : text)),
    })
  }

  const alignTiles = () => {
    if (!scene.tiles.length) return
    const selected = scene.tiles.filter((tile) => tile.selected)
    const targets = selected.length ? selected : scene.tiles
    const targetIds = new Set(targets.map((tile) => tile.id))
    const totalWidth = targets.length * TILE_WIDTH + (targets.length - 1) * TILE_GAP
    const canvasWidth = workspaceRef.current?.clientWidth ?? Math.max(800, totalWidth + 40)
    const startX = clamp(Math.min(...targets.map((tile) => tile.x)), 20, canvasWidth - totalWidth - 20)
    const y = Math.max(24, Math.min(...targets.map((tile) => tile.y)))
    history.commit({
      ...scene,
      tiles: scene.tiles.map((tile) => {
        const index = targets.findIndex((target) => target.id === tile.id)
        return targetIds.has(tile.id)
          ? { ...tile, x: startX + index * (TILE_WIDTH + TILE_GAP), y, rotation: 0 as Rotation }
          : tile
      }),
    })
    notify(selected.length ? `${selected.length}枚を整列しました` : 'すべての牌を整列しました')
  }

  const generateHand = (count: 13 | 14) => {
    const tileIds = randomHand(count)
    const canvasWidth = workspaceRef.current?.clientWidth ?? 800
    const totalWidth = count * TILE_WIDTH + (count - 1) * TILE_GAP
    const startX = Math.max(20, (canvasWidth - totalWidth) / 2)
    const zStart = nextZIndex()
    history.commit({
      tiles: tileIds.map((tileId, index) => makeTile(tileId, startX + index * (TILE_WIDTH + TILE_GAP), 76, zStart + index)),
      texts: scene.texts.map((text) => ({ ...text, selected: false })),
    })
    notify(`${count}枚の配牌を生成して理牌しました`)
  }

  const shuffleTiles = () => {
    const ids = scene.tiles.map((tile) => tile.tileId)
    for (let index = ids.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1))
      ;[ids[index], ids[target]] = [ids[target], ids[index]]
    }
    history.commit({ ...scene, tiles: scene.tiles.map((tile, index) => ({ ...tile, tileId: ids[index] })) })
    notify('配置位置を保ったまま牌をシャッフルしました')
  }

  const addText = (text: string) => {
    history.commit({
      ...scene,
      texts: [
        ...scene.texts,
        {
          id: createId('text'),
          text,
          x: 40,
          y: Math.min(460, 180 + scene.texts.length * 48),
          rotation: 0,
          selected: false,
          zIndex: nextZIndex(),
          color: '#f4f0df',
          fontSize: 22,
        },
      ],
    })
  }

  const saveLocal = () => {
    localStorage.setItem(MANUAL_SAVE_KEY, JSON.stringify(makeSavedLayout()))
    notify('配置と文字をブラウザに保存しました')
  }

  const loadLayout = (layout: SavedLayout, message: string) => {
    history.load(layout.scene)
    setShowGrid(layout.settings.showGrid)
    setSnapToGrid(layout.settings.snapToGrid)
    notify(message)
  }

  const loadLocal = () => {
    const layout = parseSavedLayout(localStorage.getItem(MANUAL_SAVE_KEY))
    if (!layout) {
      notify('ブラウザ保存データがありません')
      return
    }
    loadLayout(layout, '保存した配置と文字を復元しました')
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
    loadLayout(layout, 'JSONから配置と文字を読み込みました')
  }

  const saveScreenshot = async () => {
    const canvas = workspaceRef.current
    if (!canvas) return
    try {
      canvas.classList.add('is-capturing')
      if (!screenshotGrid) canvas.classList.add('capture-hide-grid')
      await new Promise(requestAnimationFrame)
      const dataUrl = await toPng(canvas, { cacheBust: true, pixelRatio: 2, backgroundColor: '#123c33' })
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
    undo: history.undo,
    redo: history.redo,
  })
  keyboardActions.current = {
    deleteSelected,
    rotateSelected,
    undo: history.undo,
    redo: history.redo,
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.matches('input, textarea, select')) return
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        keyboardActions.current.deleteSelected()
      } else if (event.key.toLowerCase() === 'r' && !event.ctrlKey && !event.metaKey) {
        keyboardActions.current.rotateSelected()
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) keyboardActions.current.redo()
        else keyboardActions.current.undo()
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        keyboardActions.current.redo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const selectedCount = [...scene.tiles, ...scene.texts].filter((item) => item.selected).length
  const itemCount = scene.tiles.length + scene.texts.length

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
          <strong>{scene.tiles.length}<small>枚の牌</small></strong>
        </div>
      </header>

      <Toolbar
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        hasItems={itemCount > 0}
        hasSelection={selectedCount > 0}
        showGrid={showGrid}
        snapToGrid={snapToGrid}
        screenshotGrid={screenshotGrid}
        onClear={() => history.commit(EMPTY_SCENE)}
        onUndo={history.undo}
        onRedo={history.redo}
        onAlign={alignTiles}
        onDeleteSelected={deleteSelected}
        onRotate={rotateSelected}
        onRandomHand={generateHand}
        onShuffle={shuffleTiles}
        onToggleGrid={() => setShowGrid((value) => !value)}
        onToggleSnap={() => setSnapToGrid((value) => !value)}
        onSaveLocal={saveLocal}
        onLoadLocal={loadLocal}
        onExportJson={exportJson}
        onImportJson={() => importInputRef.current?.click()}
        onAddText={addText}
        onScreenshot={saveScreenshot}
        onToggleScreenshotGrid={() => setScreenshotGrid((value) => !value)}
        onHelp={() => setHelpOpen(true)}
      />

      <main className="app-body">
        <TilePalette onAddTile={addTile} />
        <section className="workspace-panel">
          <div className="workspace-meta">
            <div>
              <span className="canvas-badge">WORKSPACE</span>
              <span>{selectedCount ? `${selectedCount}件を選択中` : '牌または文字を選択して編集'}</span>
            </div>
            <div className="legend"><span><i className="legend-grid" />{GRID_SIZE}pxグリッド</span><span><i className="legend-select" />選択中</span></div>
          </div>
          <div className="workspace-scroll">
            <Workspace
              ref={workspaceRef}
              scene={scene}
              showGrid={showGrid}
              snapToGrid={snapToGrid}
              onDropTile={addTile}
              onSelectTile={(id, additive) => selectOnly('tile', id, additive)}
              onSelectText={(id, additive) => selectOnly('text', id, additive)}
              onClearSelection={clearSelection}
              onMoveTile={(id, x, y) => history.updateLive({ ...scene, tiles: scene.tiles.map((tile) => tile.id === id ? { ...tile, x, y } : tile) })}
              onMoveText={(id, x, y) => history.updateLive({ ...scene, texts: scene.texts.map((text) => text.id === id ? { ...text, x, y } : text) })}
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
      {toast && <div className="toast" role="status">✓ {toast}</div>}
      {helpOpen && <HelpModal onClose={() => { localStorage.setItem(HELP_KEY, '1'); setHelpOpen(false) }} />}
    </div>
  )
}

export default App
