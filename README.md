# 麻雀牌レイアウトツール

麻雀の問題作成、牌姿の説明、講義資料づくりに使えるブラウザ完結型の配置ツールです。

## 起動

```bash
npm install
npm run dev
```

本番ビルドは `npm run build`、静的プレビューは `npm run preview` で実行できます。

## 公開URL

GitHub Pages: https://inocchilife.github.io/mahjong-layout-tool/

`main`ブランチへpushすると、GitHub Actionsがlint・ビルド・Pages公開を自動実行します。

## 主な機能

- 全34種＋赤牌3種のクリック／ドラッグ配置
- マウス・タッチでの移動、複数選択、削除、90度回転
- Undo / Redo、選択牌または全牌の整列、グリッド吸着
- 物理的な牌枚数を守る13枚／14枚のランダム配牌と自動理牌
- 牌のシャッフル、文字注釈の追加と移動
- localStorageへの自動保存・手動保存・復元
- 配置と文字を含むJSONの書き出し／読み込み
- 作業エリアのみのPNG保存（グリッド有無を選択可能）

## 牌画像の差し替え

表示データは `src/data/tiles.ts` に集約しています。画像は `public/tiles/` にあり、`man1.png`〜`man9.png`、`pin1.png`〜`pin9.png`、`sou1.png`〜`sou9.png`、字牌、赤牌の同名ファイルを差し替えると全画面へ反映されます。
