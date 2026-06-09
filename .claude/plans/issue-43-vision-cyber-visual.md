# 実装プラン：Issue #43 /vision サイバー風ビジュアル再実装（中央の木・背景）

## 対象Issue

- **Issue番号**：#43
- **タイトル**：[Phase3] /vision サイバー風ビジュアル再実装（中央の木・背景）
- **URL**：https://github.com/hfujii-gif/declaration-tree/issues/43
- **ラベル**：phase-3-frontend

---

## Context（なぜこの変更を行うか）

クライアントレビューを受け、/vision の演出を「リアルな緑の木＋テキスト葉」から
「サイバー風の発光する木＋宣言テキストのパーティクル吸収」へ変更することが #41 で確定した。
本Issueはその第一歩として、**常設のビジュアルレイヤー**＝中央の木と背景を作り直す。

- 中央の木：緑のリアルな木 → 光の粒子で構成された発光する木（白〜薄い水色）
- 背景：空・太陽・流れる雲・大地 → デジタル/ホログラム調

後続Issue（#44 パーティクル吸収演出、#45 マイルストーン演出）が、この新しい木を
「吸収先」「発光対象」として使う。本Issueは木と背景の見た目のみを差し替え、
**演出・配線・葉撤去は触らない**（#44/#45の担当）。

### 設計上の最重要制約：メモリリーク厳禁（8時間以上の常時稼働）
常設レイヤーは **CSS/SVG ＋ CSSアニメーションのみ**で実装する。
JSタイマー・requestAnimationFrame の常時ループ・イベントリスナーを **使わない**。
動的に動くパーティクル（テキスト→木への吸い込み等）は #44 で GSAP により
イベント単位で生成・破棄する。本Issueの木・背景は「静的＋CSSのゆらぎ」に留める。

---

## 実装対象ファイル

### 編集（作り直し）するファイル
```
components/vision/CenterTree.tsx           … サイバー風の発光する木に作り直し（コンポーネント契約は維持）
components/vision/CenterTree.module.scss   … 発光ライン＋粒子キャノピーのスタイル
components/vision/Background.tsx           … 空/太陽/雲/大地を撤去しデジタル背景へ
components/vision/Background.module.scss   … グリッド・スキャンライン・発光のスタイル
app/globals.scss                          … サイバー配色のCSS変数を「追加」
app/vision/page.module.scss               … カウンターをサイバー調（シアンの発光）に微調整（任意）
```

### このIssueでは触らないファイル
```
app/vision/page.tsx           … 配線替えは #44。木/背景の差し替えだけなら page は無改修で動く
lib/animations.ts             … #45 の担当
lib/constants.ts              … 新ビジュアル定数は不要見込み（段階成長は data-stage のCSS駆動）。
                                葉定数 LEAF_* の削除は #44
components/vision/Leaf*        … 葉撤去は #44
```

---

## コンポーネント契約の維持（重要）

`app/vision/page.tsx` と `lib/animations.ts` が現状以下に依存しているため、**外形は変えない**：

- `CenterTree` は `forwardRef<HTMLDivElement>`、props は `stage: number`（0〜4）と `bloomed?: boolean`
- ルート要素に `data-stage`・`data-bloomed` を出力し、ref を親へ公開する
- `Background` は props なし

→ これらを保てば、page.tsx を一切変えずに見た目だけ差し替わり、#44/#45 もそのまま接続できる。

---

## 実装方針

### 1. CenterTree（サイバー風の木）
- 既存SVG（viewBox `0 0 200 260`）の**幹・枝の path ジオメトリは再利用**し、塗りを差し替える。
  - 幹・枝：木目グラデーション → 白〜薄い水色の**発光ライン**（stroke + グロー filter / drop-shadow）。
  - 旧 `trunkGrad`・`leafShadow`・`bark` は不要になるので発光用の filter（feGaussianBlur 等）に置き換える。
- 葉のかたまり（`.clump` 3枚）→ **光の粒子が密集したキャノピー**に置き換える。
  - キャノピー領域に多数の小さな円（SVG `<circle>`）を配置し、CSSで `opacity`/`scale` を
    ゆっくり明滅（twinkle）させる。粒子は固定配置＋CSSアニメーションのみ（JSなし）。
  - 粒子の座標は実装時にSVG内へ静的に列挙する（乱数JSは使わずデザインとして配置）。
- 段階成長：既存の `data-stage='0..4'` で `.canopy`（粒子群）を `scale` する仕組みを踏襲し、
  段階が上がるほど粒子群が大きく・明るくなるよう調整。`transition` で滑らかに。
- 満開：`data-bloomed='true'` で粒子全体の発光を最大化（シアン→白の強グロー）。
- **#44 への配慮**：キャノピーの中心が treeWrap 基準で安定するよう構造を保ち、
  #44 が `treeRef.getBoundingClientRect()` から吸収先座標を算出できるようにしておく
  （必要なら粒子群に `data-canopy` 等のフックを付与。座標提供のための最小限の印のみ）。

### 2. Background（デジタル/ホログラム背景）
- `Background.tsx` から sun・clouds・ground の DOM を撤去し、デジタル背景の要素に置き換える。
- 構成案（すべてCSS）：
  - ベース：暗いサイバー基調のグラデーション（深い藍〜黒）。
  - 発光グリッド：`linear-gradient` の格子（遠近感のある床グリッド or 全面グリッド）。
  - 環境光の明滅・スキャンライン・薄いノイズ：CSS keyframes でゆっくり動かす。
- `drift`（雲）アニメーションは削除。CSSアニメーションは GPU フレンドリーな `transform`/`opacity` 主体。

### 3. globals.scss（CSS変数：追加のみ）
- サイバー配色を**追加**する（例）：
  - `--color-cyber-bg`（背景基調）／`--color-cyber-bg-2`（グラデ下端）
  - `--color-cyber-line`（幹・枝の発光ライン＝白〜薄水色）
  - `--color-cyber-glow`（グロー色＝シアン）
  - `--color-particle`（粒子色）／`--color-grid`（背景グリッド線）
- 旧変数（`--color-sky-*`・`--color-sun`・`--color-cloud`・`--color-trunk*`・`--color-leaf*`）は
  **削除しない**。LeafItem 等が #44 撤去まで参照するため。掃除は #44 で行う。

### 4. page.module.scss（任意の微調整）
- カウンターは現状でも視認可能。サイバー調に寄せてシアンの `text-shadow`（発光）に変更する程度に留める。

---

## 実装ステップ（承認後）

1. develop から作業ブランチを作成：`feature/issue-43-vision-cyber-visual`
2. 本プランを `.claude/plans/issue-43-vision-cyber-visual.md` として保存（規約上の保存先）。
3. `app/globals.scss` にサイバー配色のCSS変数を追加。
4. `Background.tsx` / `Background.module.scss` をデジタル背景へ作り直し。
5. `CenterTree.tsx` / `CenterTree.module.scss` を発光ライン＋粒子キャノピーへ作り直し（幹・枝ジオメトリは再利用）。
6. 段階成長（data-stage 0〜4）・満開（data-bloomed）の見た目を確認・調整。
7. `app/vision/page.module.scss` のカウンターを軽く調整（任意）。
8. ビルド確認：`npm run build` / `npx tsc --noEmit` / `npm run lint`。
9. `npm run dev` で /vision を開き、`?stage=0..4` で段階成長、`?stage=5`（満開）で見た目を目視確認。
10. コミット → develop へPR作成（base: develop、Closes #43）。マージは人間。

---

## 考慮が必要な点

### メモリリーク（最重要）
- JSタイマー・rAFループ・追加のイベントリスナーを使わない。CSSアニメーションのみ。
- これにより8時間以上の常時表示でも増加コストが発生しない。

### 後続Issueとの非干渉
- コンポーネント契約（props・ref・data-stage・data-bloomed）を厳守し、page.tsx を無改修に保つ。
- 旧CSS変数を残し、葉システム・葉定数には触れない（#44の範囲）。

### 型・コーディングルール
- `any` を使わない。CenterTree の props 型は現状の型を踏襲。
- 色は直書きせず CSS変数（`var(--color-cyber-*)`）を使う。
- コメントは日本語。

### パフォーマンス
- SVG粒子は数百個以内に抑え、`will-change` を多用しすぎない（大画面GPU負荷に配慮）。
- 明滅アニメーションは `transform`/`opacity` のみで合成（レイアウト・ペイントを誘発しない）。

---

## 完了条件（Issueより転記）

- [ ] /vision の木がサイバー風（発光・粒子）になっていること
- [ ] 背景がデジタル/ホログラム調になっていること（雲/大地が消えていること）
- [ ] 段階成長が従来通り動作すること（?stage=0..4 / 満開）
- [ ] `npm run build` / `npx tsc --noEmit` / `npm run lint` が通ること

---

## 検証方法

- `npm run dev` で `http://localhost:3000/vision` を開く。
  - 既定表示：サイバー風の木＋デジタル背景になっていること（雲・太陽・大地・緑の葉が無いこと）。
  - `?stage=1` 〜 `?stage=4`：木（粒子キャノピー）が段階的に大きく明るくなること。
  - `?stage=5`：満開（発光最大）状態になること。
- ビルド：`npm run build`（CLAUDE.md/implementation.md のチェックリスト準拠）。
- 目視で旧要素（雲・太陽・大地・緑のリアルな葉）が残っていないことを確認。

---

## 承認コメント欄

**承認者**：  
**承認日**：  
**コメント**：
