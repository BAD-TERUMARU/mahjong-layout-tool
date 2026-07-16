import { useState, type FormEvent } from 'react'
import type { SymbolElement, TextElement } from '../types'

type EditableElement = TextElement | SymbolElement

interface PropertyEditorProps {
  element: EditableElement
  onSave: (properties: {
    text?: string
    color: string
    fontSize?: number
    scale?: number
    strokeWidth?: number
  }) => void
  onClose: () => void
}

export const PropertyEditor = ({ element, onSave, onClose }: PropertyEditorProps) => {
  const [text, setText] = useState(element.kind === 'text' ? element.text : '')
  const [color, setColor] = useState(element.color)
  const [fontSize, setFontSize] = useState(element.kind === 'text' ? element.fontSize : 22)
  const [scale, setScale] = useState(element.kind === 'symbol' ? element.scale : 1)
  const [strokeWidth, setStrokeWidth] = useState(element.kind === 'symbol' ? element.strokeWidth : 4)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (element.kind === 'text' && !text.trim()) return
    onSave({
      text: element.kind === 'text' ? text.trim() : undefined,
      color,
      fontSize: element.kind === 'text' ? fontSize : undefined,
      scale: element.kind === 'symbol' ? scale : undefined,
      strokeWidth: element.kind === 'symbol' ? strokeWidth : undefined,
    })
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="property-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="property-title"
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" type="button" onClick={onClose} aria-label="プロパティ編集を閉じる">×</button>
        <span className="eyebrow">PROPERTIES</span>
        <h2 id="property-title">プロパティ編集</h2>

        {element.kind === 'text' && (
          <>
            <label>
              文字内容
              <textarea value={text} onChange={(event) => setText(event.target.value)} autoFocus />
            </label>
            <label>
              文字サイズ
              <input type="number" min="12" max="72" value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} />
            </label>
          </>
        )}

        {element.kind === 'symbol' && (
          <>
            <label>
              サイズ倍率
              <input type="number" min="0.5" max="3" step="0.1" value={scale} onChange={(event) => setScale(Number(event.target.value))} />
            </label>
            <label>
              線の太さ
              <input type="number" min="1" max="12" value={strokeWidth} onChange={(event) => setStrokeWidth(Number(event.target.value))} />
            </label>
          </>
        )}

        <label>
          色
          <span className="color-field">
            <input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
            <code>{color}</code>
          </span>
        </label>

        <div className="property-actions">
          <button type="button" onClick={onClose}>キャンセル</button>
          <button className="primary-button" type="submit">変更を保存</button>
        </div>
      </form>
    </div>
  )
}
