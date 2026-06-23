# 実装プラン

## 対象Issue

- **Issue番号**：#52
- **タイトル**：[改善] /vision 背景を星空キラキラ化（マトリックス的デジタルレイン）
- **URL**：https://github.com/hfujii-gif/declaration-tree/issues/52

---

## ステータス

- [x] プラン作成中
- [x] レビュー待ち
- [x] 承認済み → 実装開始可能
- [x] 実装完了
- [x] PR作成済み（#54）

---

## 方針転換の記録（重要）

当初は **CSSのみ**（radial-gradient の星空＋瞬き、repeating-linear-gradient の縦コラム×流れバンドで
デジタルレイン）で実装した。しかし参考画像のトーン再現と質感のため、レビュー前に
**シームレス化した星景動画の全画面ループ再生**へ方針変更した。あわせて中央の木も
発光SVG → 画像（`tree.png`）へ差し替えた。最終実装は以下の「最終実装」セクションを正とする。

> CSS方式の詳細（`.stars`/`.rain` の keyframes 設計など）は git 履歴（初回コミット）参照。

---

## 最終実装

### 背景（動画ループ）
- `components/vision/Background.tsx`：`<video loop muted autoPlay playsInline>` で
  `public/videos/starfield-bg-seamless.mp4` をループ再生。素材自体がシームレスなため再生制御のJSは不要
  （タイマー・rAF・リスナーを一切追加しない＝長時間8h+稼働のメモリリーク方針を維持）。
- `components/vision/Background.module.scss`：`object-fit: cover` で全画面表示。
  読み込み前の素抜け防止に暗い下地色 `--color-sky-top` を敷く。
- 素材生成：`scripts/make-seamless.sh`（ffmpeg xfade で末尾→先頭をクロスフェードし継ぎ目を消す）。
  生素材 `public/videos/starfield-bg.mp4` は `.gitignore` で除外（差し替え時にスクリプトで再生成）。

### 中央の木（画像差し替え）
- `components/vision/CenterTree.tsx`：発光SVGの幹・枝 → `public/images/tree.png`（素の `<img>`）。
  樹冠のデジタルレイン（canvas）は従来どおり維持（rAF を保持しアンマウント時に破棄）。
- `components/vision/CenterTree.module.scss`：木画像の表示スタイル。

### 定数・変数
- `app/globals.scss`：`--color-sky-top`（背景下地）と `--color-leaf-glow`（樹冠canvasのグロー）のみ。
  旧サイバー調CSSの未参照変数（`--color-cyber-*` / `--color-grid` / `--color-branch` /
  `--color-trunk-glow` / `--color-particle` / `--color-star` / `--color-rain`）は削除。

---

## メモリリーク対策（長時間8h+稼働）
- 背景は素材がシームレスループのため、再生制御のJS（タイマー・rAF・リスナー）を追加していない。
- 樹冠レイン（canvas）は既存の rAF 破棄・visibilitychange 停止の実装を維持。

---

## 完了条件（Issueより転記）

- [x] 背景が星空（夜空）のようにキラキラ瞬く表現になっている（星景動画）
- [x] キラキラがマトリックス／デジタルレイン的世界観で表現されている（樹冠レイン＋星景動画）
- [x] 木・宣言テキスト・カウンターの視認性を損なっていない
- [x] 長時間稼働のメモリリーク対策を担保（動画はJSなし／canvasは破棄実装維持）
- [x] 参考画像のトーンに沿っている（動画素材で再現）
- [x] npm run build / npx tsc --noEmit / npm run lint が通る

---

## レビュー対応（PR #54）

必須修正なし（LGTM）。任意指摘のうち以下を対応：
- 未使用CSS変数の削除（globals.scss）
- `.gitignore` のコメント不整合解消＋ `scripts/make-seamless.sh` をコミット
- `Background.tsx` / `Background.module.scss` の末尾改行追加
- 本プランファイルを動画方式へ更新（本対応）

見送り：木画像の `object-fit: cover` 見切れ確認（実機目視は別途。透過PNGのため大きな実害は想定せず）。
