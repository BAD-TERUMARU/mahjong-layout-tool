interface HelpModalProps {
  onClose: () => void
}

export const HelpModal = ({ onClose }: HelpModalProps) => (
  <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onMouseDown={(event) => event.stopPropagation()}>
      <button className="modal-close" type="button" onClick={onClose} aria-label="操作ガイドを閉じる">×</button>
      <span className="eyebrow">QUICK START</span>
      <h2 id="help-title">直感的に牌姿をつくれます</h2>
      <div className="help-steps">
        <div><b>1</b><p><strong>牌を置く</strong><span>左の牌をクリックするか、卓へドラッグします。</span></p></div>
        <div><b>2</b><p><strong>自由に動かす</strong><span>牌や文字をドラッグ。Shift＋クリックで複数選択できます。</span></p></div>
        <div><b>3</b><p><strong>整えて保存</strong><span>整列・吸着を使い、JSONやPNGで書き出せます。</span></p></div>
      </div>
      <div className="shortcut-list">
        <span><kbd>Delete</kbd> 選択を削除</span>
        <span><kbd>R</kbd> 選択を回転</span>
        <span><kbd>Ctrl / ⌘ + Z</kbd> 元に戻す</span>
      </div>
      <button className="primary-button" type="button" onClick={onClose}>はじめる</button>
    </section>
  </div>
)

