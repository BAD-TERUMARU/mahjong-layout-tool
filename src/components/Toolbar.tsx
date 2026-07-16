import { useState } from 'react'
import type { PlacementMode } from '../types'

interface ToolbarProps {
  canUndo: boolean
  canRedo: boolean
  hasItems: boolean
  hasSelection: boolean
  canEditText: boolean
  textStyle: { fontFamily: string; fontSize: number; color: string }
  isEditingSelectedText: boolean
  canDuplicate: boolean
  canEditProperties: boolean
  showGrid: boolean
  snapToGrid: boolean
  screenshotGrid: boolean
  placementMode: PlacementMode
  onClear: () => void
  onUndo: () => void
  onRedo: () => void
  onAlign: () => void
  onDeleteSelected: () => void
  onDuplicate: () => void
  onRotate: () => void
  onEditSelectedText: () => void
  onUpdateTextStyle: (style: { fontFamily?: string; fontSize?: number; color?: string }) => void
  onEditProperties: () => void
  onRandomHand: (count: 13 | 14) => void
  onShuffle: () => void
  onSetPlacementMode: (mode: PlacementMode) => void
  onToggleGrid: () => void
  onToggleSnap: () => void
  onSaveLocal: () => void
  onLoadLocal: () => void
  onOpenSavedLayouts: () => void
  onExportJson: () => void
  onImportJson: () => void
  onAddImage: () => void
  onAddText: (text: string) => void
  onScreenshot: () => void
  onToggleScreenshotGrid: () => void
  onHelp: () => void
}

type RibbonTab = 'home' | 'insert' | 'hand' | 'view' | 'file'

const ToolButton = ({
  label,
  icon,
  onClick,
  disabled,
  active,
  danger,
}: {
  label: string
  icon: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
  danger?: boolean
}) => (
  <button
    type="button"
    className={`tool-button${active ? ' active' : ''}${danger ? ' danger' : ''}`}
    onClick={onClick}
    disabled={disabled}
    aria-pressed={active}
  >
    <span aria-hidden="true">{icon}</span>
    {label}
  </button>
)

export const Toolbar = (props: ToolbarProps) => {
  const [text, setText] = useState('')
  const [activeTab, setActiveTab] = useState<RibbonTab>('home')

  const addText = () => {
    const value = text.trim()
    if (!value) return
    props.onAddText(value)
    setText('')
  }

  return (
    <section className="toolbar" aria-label="編集ツール">
      <div className="ribbon-tabs" role="tablist" aria-label="リボンタブ">
        {([
          ['home', 'ホーム'],
          ['insert', '挿入'],
          ['hand', '配牌'],
          ['view', '表示'],
          ['file', '保存・出力'],
        ] as Array<[RibbonTab, string]>).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={activeTab === id} className={activeTab === id ? 'active' : ''} onClick={() => setActiveTab(id)}>{label}</button>
        ))}
      </div>

      <div className="ribbon-content" role="tabpanel">
        {activeTab === 'home' && <div className="tool-group">
          <span className="tool-group-label">編集</span>
          <ToolButton label="元に戻す" icon="↶" onClick={props.onUndo} disabled={!props.canUndo} />
          <ToolButton label="やり直す" icon="↷" onClick={props.onRedo} disabled={!props.canRedo} />
          <ToolButton label="牌を整列" icon="≡" onClick={props.onAlign} disabled={!props.hasItems} />
          <ToolButton label="複製" icon="⧉" onClick={props.onDuplicate} disabled={!props.canDuplicate} />
          <ToolButton label="回転" icon="↻" onClick={props.onRotate} disabled={!props.hasSelection} />
          <ToolButton label="文字編集" icon="Aa" onClick={props.onEditSelectedText} disabled={!props.canEditText} />
          <ToolButton label="スタイル" icon="🎨" onClick={props.onEditProperties} disabled={!props.canEditProperties} />
          <ToolButton label="選択を削除" icon="⌫" onClick={props.onDeleteSelected} disabled={!props.hasSelection} />
          <ToolButton label="すべて削除" icon="×" onClick={props.onClear} disabled={!props.hasItems} danger />
          <div className="font-ribbon" aria-label="フォント">
            <span className="font-ribbon-label">{props.isEditingSelectedText ? '選択中の文字' : '新規文字の既定スタイル'}</span>
            <select
              aria-label="フォント"
              value={props.textStyle.fontFamily}
              onChange={(event) => props.onUpdateTextStyle({ fontFamily: event.target.value })}
            >
              <option value="serif">明朝体</option>
              <option value="sans-serif">ゴシック体</option>
              <option value="'Yu Mincho', serif">游明朝</option>
              <option value="'Yu Gothic UI', sans-serif">游ゴシック</option>
              <option value="cursive">筆記体</option>
              <option value="monospace">等幅</option>
            </select>
            <div className="font-ribbon-controls">
              <button type="button" aria-label="文字サイズを小さく" onClick={() => props.onUpdateTextStyle({ fontSize: Math.max(12, props.textStyle.fontSize - 2) })}>A−</button>
              <input
                type="number"
                min="12"
                max="72"
                aria-label="文字サイズ"
                value={props.textStyle.fontSize}
                onChange={(event) => props.onUpdateTextStyle({ fontSize: Number(event.target.value) })}
              />
              <button type="button" aria-label="文字サイズを大きく" onClick={() => props.onUpdateTextStyle({ fontSize: Math.min(72, props.textStyle.fontSize + 2) })}>A+</button>
              <label title="文字色"><span>A</span><input type="color" aria-label="文字色" value={props.textStyle.color} onChange={(event) => props.onUpdateTextStyle({ color: event.target.value })} /></label>
            </div>
          </div>
        </div>}

        {activeTab === 'insert' && <>
          <div className="tool-group placement-tools">
            <span className="tool-group-label">配置（Escで解除）</span>
            <ToolButton label="選択" icon="↖" onClick={() => props.onSetPlacementMode('select')} active={props.placementMode === 'select'} />
            <ToolButton label="クリック文字" icon="T" onClick={() => props.onSetPlacementMode('text')} active={props.placementMode === 'text'} />
            <ToolButton label="線を描く" icon="✎" onClick={() => props.onSetPlacementMode('draw')} active={props.placementMode === 'draw'} />
            <ToolButton label="長方形" icon="▭" onClick={() => props.onSetPlacementMode('rectangle')} active={props.placementMode === 'rectangle'} />
            <ToolButton label="三角形" icon="△" onClick={() => props.onSetPlacementMode('triangle')} active={props.placementMode === 'triangle'} />
            <ToolButton label="バツ" icon="✕" onClick={() => props.onSetPlacementMode('cross')} active={props.placementMode === 'cross'} />
            <ToolButton label="丸" icon="〇" onClick={() => props.onSetPlacementMode('circle')} active={props.placementMode === 'circle'} />
          </div>
          <div className="tool-group text-tool">
            <span className="tool-group-label">クイック文字</span>
            <input value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addText()} placeholder="説明を入力" aria-label="追加する文字" />
            <button className="text-add-button" type="button" onClick={addText} disabled={!text.trim()}>追加</button>
          </div>
          <div className="tool-group">
            <span className="tool-group-label">画像</span>
            <ToolButton label="画像追加" icon="▧" onClick={props.onAddImage} />
          </div>
        </>}

        {activeTab === 'hand' && <div className="tool-group">
          <span className="tool-group-label">配牌</span>
          <ToolButton label="13枚" icon="13" onClick={() => props.onRandomHand(13)} />
          <ToolButton label="14枚" icon="14" onClick={() => props.onRandomHand(14)} />
          <ToolButton label="シャッフル" icon="⤨" onClick={props.onShuffle} disabled={!props.hasItems} />
        </div>}

        {activeTab === 'view' && <div className="tool-group">
          <span className="tool-group-label">表示</span>
          <ToolButton label="グリッド" icon="▦" onClick={props.onToggleGrid} active={props.showGrid} />
          <ToolButton label="吸着" icon="⌗" onClick={props.onToggleSnap} active={props.snapToGrid} />
          <ToolButton label="操作ガイド" icon="?" onClick={props.onHelp} />
        </div>}

        {activeTab === 'file' && <>
          <div className="tool-group">
            <span className="tool-group-label">保存</span>
            <ToolButton label="ブラウザ保存" icon="↓" onClick={props.onSaveLocal} />
            <ToolButton label="復元" icon="↑" onClick={props.onLoadLocal} />
            <ToolButton label="保存ページ" icon="▤" onClick={props.onOpenSavedLayouts} />
            <ToolButton label="JSON書出" icon="{}" onClick={props.onExportJson} />
            <ToolButton label="JSON読込" icon="…" onClick={props.onImportJson} />
          </div>
          <div className="tool-group">
            <span className="tool-group-label">PNG出力</span>
            <label className="capture-grid-toggle"><input type="checkbox" checked={props.screenshotGrid} onChange={props.onToggleScreenshotGrid} />PNGにグリッド</label>
            <ToolButton label="PNG保存" icon="▣" onClick={props.onScreenshot} />
          </div>
        </>}
      </div>
    </section>
  )
}
