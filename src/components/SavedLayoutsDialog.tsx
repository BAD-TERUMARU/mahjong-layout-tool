import { useEffect, useState } from 'react'
import { TILE_MAP } from '../data/tiles'
import type { NamedSavedLayout } from '../types'
import { getElementDimensions } from '../utils/layout'

interface SavedLayoutsDialogProps {
  layouts: NamedSavedLayout[]
  onSave: (name: string) => void
  onLoad: (id: string) => void
  onDelete: (id: string) => void
  onClose: () => void
}

const LayoutPreview = ({ saved }: { saved: NamedSavedLayout }) => {
  const { scene } = saved.layout
  return (
    <div className="saved-layout-preview" aria-hidden="true">
      {scene.elements.map((element) => {
        const dimensions = getElementDimensions(element)
        const style = {
          left: `${element.x / scene.width * 100}%`,
          top: `${element.y / scene.height * 100}%`,
          width: `${dimensions.width / scene.width * 100}%`,
          height: `${dimensions.height / scene.height * 100}%`,
          zIndex: element.zIndex,
        }
        if (element.kind === 'tile') {
          const tile = TILE_MAP.get(element.tileId)
          return element.faceDown
            ? <span key={element.id} className="saved-preview-item saved-preview-back" style={style} />
            : tile && <img key={element.id} className="saved-preview-item" src={tile.asset} alt="" style={style} />
        }
        if (element.kind === 'text') {
          return <span key={element.id} className="saved-preview-item saved-preview-text" style={{ ...style, color: element.color, fontFamily: element.fontFamily }}>{element.text}</span>
        }
        if (element.kind === 'image') {
          return <img key={element.id} className="saved-preview-item" src={element.src} alt="" style={{ ...style, opacity: element.opacity }} />
        }
        if (element.kind === 'drawing') {
          return (
            <svg key={element.id} className="saved-preview-item" viewBox={`0 0 ${element.width} ${element.height}`} style={style}>
              <polyline points={element.points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke={element.color} strokeWidth={element.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )
        }
        return (
          <span key={element.id} className={`saved-preview-item saved-preview-symbol preview-${element.symbolType}`} style={{ ...style, color: element.color }}>
            {element.symbolType === 'cross' ? '✕' : element.symbolType === 'triangle' ? '△' : ''}
          </span>
        )
      })}
    </div>
  )
}

export const SavedLayoutsDialog = (props: SavedLayoutsDialogProps) => {
  const [name, setName] = useState(`保存ページ ${props.layouts.length + 1}`)
  const { onClose } = props

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const save = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    props.onSave(trimmed)
    setName(`保存ページ ${props.layouts.length + 2}`)
  }

  return (
    <div className="modal-backdrop saved-layouts-backdrop" role="presentation" onPointerDown={props.onClose}>
      <section className="saved-layouts-dialog" role="dialog" aria-modal="true" aria-labelledby="saved-layouts-title" onPointerDown={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={props.onClose} aria-label="閉じる">×</button>
        <div className="saved-layouts-heading">
          <div>
            <span>LAYOUT LIBRARY</span>
            <h2 id="saved-layouts-title">保存したページ</h2>
          </div>
          <strong>{props.layouts.length}<small>件</small></strong>
        </div>

        <div className="saved-layout-form">
          <label htmlFor="saved-layout-name">現在の画面を新しく保存</label>
          <div>
            <input id="saved-layout-name" value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && save()} />
            <button type="button" className="primary-button" onClick={save} disabled={!name.trim()}>保存</button>
          </div>
        </div>

        <div className="saved-layout-list">
          {props.layouts.length === 0 ? (
            <div className="saved-layout-empty"><strong>保存ページはまだありません</strong><span>名前を付けて現在の画面を保存できます。</span></div>
          ) : props.layouts.map((saved) => {
            const count = saved.layout.scene.elements.length
            return (
              <article className="saved-layout-card" key={saved.id}>
                <LayoutPreview saved={saved} />
                <div className="saved-layout-card-copy">
                  <strong>{saved.name}</strong>
                  <span>{new Date(saved.savedAt).toLocaleString('ja-JP')}</span>
                  <small>{count}個の配置物 ・ {saved.layout.scene.width} × {saved.layout.scene.height}px</small>
                </div>
                <div className="saved-layout-card-actions">
                  <button type="button" className="saved-layout-load" onClick={() => props.onLoad(saved.id)}>呼び出す</button>
                  <button type="button" className="saved-layout-delete" onClick={() => props.onDelete(saved.id)}>削除</button>
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}
