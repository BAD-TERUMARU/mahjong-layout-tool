import { useEffect } from 'react'

interface HelpModalProps {
  onClose: () => void
}

const Shortcut = ({ children }: { children: string }) => <kbd>{children}</kbd>

export const HelpModal = ({ onClose }: HelpModalProps) => {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" aria-describedby="help-intro" onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="操作ガイドを閉じる">×</button>
        <header className="help-header">
          <span className="eyebrow">OPERATION GUIDE</span>
          <h2 id="help-title">麻雀牌レイアウトツールの使い方</h2>
          <p id="help-intro">牌姿の作成、講義資料の注釈、問題図の作成を、配置から保存まで一つの画面で行えます。</p>
        </header>

        <nav className="help-index" aria-label="操作ガイドの目次">
          <a href="#help-start">はじめる</a>
          <a href="#help-edit">編集する</a>
          <a href="#help-insert">文字・図形</a>
          <a href="#help-save">保存・共有</a>
        </nav>

        <div className="help-content">
          <section className="help-section" id="help-start">
            <div className="help-section-heading"><span>01</span><h3>まずは牌を置く</h3></div>
            <div className="help-steps">
              <div><b>1</b><p><strong>牌一覧から選ぶ</strong><span>左側の牌をクリックすると、グリッド線にそろった開始位置から空いている場所へ追加されます。牌をそのままワークスペースへドラッグして、好きな場所に置くこともできます。</span></p></div>
              <div><b>2</b><p><strong>連続して配置する</strong><span>自動配置は一定の間隔で横に並び、移動済みの牌も避けます。上部の牌数メモリは同じ開始位置を基準に、追加した牌の枚数を13枚まで表示します。</span></p></div>
              <div><b>3</b><p><strong>配牌をすばやく作る</strong><span>「配牌」タブの13枚・14枚を使うと、赤牌を含むルールに沿ったランダムな手牌を作成できます。作成後は自動で理牌されます。</span></p></div>
            </div>
          </section>

          <section className="help-section" id="help-edit">
            <div className="help-section-heading"><span>02</span><h3>選択・移動・編集</h3></div>
            <div className="help-grid">
              <article><strong>選択と複数選択</strong><p>要素をクリックして選択します。何もない場所をクリックすると選択解除。空白をドラッグすると、囲んだ牌・文字・図形をまとめて選択できます。</p></article>
              <article><strong>移動と整列</strong><p>選択した要素はドラッグで移動できます。複数選択も一緒に移動します。「ホーム」タブの「牌を整列」で、選択中の牌または全牌を横一列にそろえます。</p></article>
              <article><strong>牌を裏返す</strong><p>ワークスペース上の牌をダブルクリックすると表・裏を切り替えられます。牌の種類は保持されるため、もう一度ダブルクリックすれば元に戻ります。</p></article>
              <article><strong>右クリックのメニュー</strong><p>要素の上だけでなく、ワークスペースの空白を右クリックしても操作できます。複製、貼り付け、ロック、重なり順、プロパティ編集などを実行できます。</p></article>
              <article><strong>配置ツールを解除する</strong><p>選択中の文字・図形・線ツールは、同じツールをもう一度クリックするか、Escキーで「選択」モードに戻せます。</p></article>
            </div>
            <div className="help-tip"><strong>ヒント</strong><span>牌・文字・図形・画像は、左の牌一覧エリアへドラッグしてドロップすると削除できます。削除後も「元に戻す」で復元できます。</span></div>
          </section>

          <section className="help-section" id="help-insert">
            <div className="help-section-heading"><span>03</span><h3>文字・図形・画像を加える</h3></div>
            <div className="help-feature-list">
              <div><strong>文字</strong><span>「挿入」タブで「クリック文字」を選び、ワークスペースをクリックして入力します。文字を選択すると、ホームタブでフォント、サイズ、色を変更できます。</span></div>
              <div><strong>図形・線・手書き</strong><span>長方形、三角形、丸、バツ、牌5枚分・高さ1マスの波線、直線、曲線、矢印、手書き線を連続配置できます。線は既存の牌や線の上からでも描けます。曲線は、まず始点から終点までドラッグし、次にふくらませたい位置をクリックして確定します。図形を選択し、外枠のハンドルをドラッグするとサイズを変えられます。</span></div>
              <div><strong>画像</strong><span>「画像を追加」から選ぶほか、画像ファイルをワークスペースへドラッグ＆ドロップ、またはコピー＆ペーストして追加できます。選択後はドラッグでサイズ変更できます。</span></div>
              <div><strong>色のパレット</strong><span>ホームタブの <b>A</b> ボタンから細かな色を選び、カスタム色として登録できます。登録済みの色は文字と図形で共通して使えます。</span></div>
            </div>
          </section>

          <section className="help-section" id="help-save">
            <div className="help-section-heading"><span>04</span><h3>保存・呼び出し・共有</h3></div>
            <div className="help-steps compact">
              <div><b>1</b><p><strong>保存する</strong><span>「保存・出力」タブの「保存」を押し、名前を入力します。保存するたびに保存ページへ追加されます。</span></p></div>
              <div><b>2</b><p><strong>あとから開く</strong><span>「保存ページ」では、保存済みレイアウトの読み込み、タイトル変更、削除ができます。画像を含むデータは、このブラウザの大容量保存領域に保存されます。</span></p></div>
              <div><b>3</b><p><strong>共有する</strong><span>保存ページの「共有ファイル保存」をクリックして保存するか、デスクトップ・フォルダへドラッグして出力します。受け取った人は共有ファイルをワークスペースへドラッグ＆ドロップするだけで、保存された画面を開けます。</span></p></div>
            </div>
          </section>

          <section className="help-section help-shortcuts" aria-labelledby="shortcut-title">
            <div className="help-section-heading"><span>⌨</span><h3 id="shortcut-title">よく使うショートカット</h3></div>
            <div className="shortcut-list">
              <span><Shortcut>Delete / Backspace</Shortcut> 選択を削除</span>
              <span><Shortcut>Ctrl / ⌘ + Z</Shortcut> 元に戻す</span>
              <span><Shortcut>Ctrl / ⌘ + Y</Shortcut> やり直す</span>
              <span><Shortcut>Ctrl / ⌘ + C / V</Shortcut> コピー・貼り付け</span>
              <span><Shortcut>Ctrl / ⌘ + D</Shortcut> 複製</span>
              <span><Shortcut>矢印</Shortcut> 少し移動</span>
              <span><Shortcut>Shift + 矢印</Shortcut> 大きく移動</span>
              <span><Shortcut>Esc</Shortcut> 選択・配置ツールを解除</span>
              <span><Shortcut>選択中の配置ツールをクリック</Shortcut> 配置ツールを解除</span>
            </div>
          </section>
        </div>
        <footer className="help-footer"><button className="primary-button" type="button" onClick={onClose}>レイアウト作成をはじめる</button></footer>
      </section>
    </div>
  )
}
