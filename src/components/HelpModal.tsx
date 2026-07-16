interface HelpModalProps {
  onClose: () => void
}

export const HelpModal = ({ onClose }: HelpModalProps) => (
  <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onMouseDown={(event) => event.stopPropagation()}>
      <button className="modal-close" type="button" onClick={onClose} aria-label="操作ガイドを閉じる">×</button>
      <span className="eyebrow">QUICK START</span>
      <h2 id="help-title">牌・文字・記号を自由に編集</h2>
      <div className="help-steps">
        <div><b>1</b><p><strong>連続して配置</strong><span>牌をクリック、または記号ツールを選んでWorkspaceをクリック。ツールはEscまで維持されます。</span></p></div>
        <div><b>2</b><p><strong>移動・範囲選択・削除</strong><span>空白のドラッグで複数選択。配置物を牌一覧へドロップしても削除できます。</span></p></div>
        <div><b>3</b><p><strong>右クリックで詳細操作</strong><span>複製、コピー、ロック、前面・背面、プロパティ編集をショートカットメニューから実行できます。</span></p></div>
        <div><b>4</b><p><strong>牌を裏返す</strong><span>Workspaceの牌をダブルクリックすると、表向き・裏向きを切り替えられます。</span></p></div>
      </div>
      <div className="shortcut-list">
        <span><kbd>Delete</kbd> 選択を削除</span>
        <span><kbd>Ctrl / ⌘ + D</kbd> 複製</span>
        <span><kbd>Ctrl / ⌘ + C / V</kbd> コピー・貼り付け</span>
        <span><kbd>矢印</kbd> 移動</span>
        <span><kbd>Shift + 矢印</kbd> 10px移動</span>
        <span><kbd>Esc</kbd> 選択・ツール解除</span>
      </div>
      <button className="primary-button" type="button" onClick={onClose}>はじめる</button>
    </section>
  </div>
)
