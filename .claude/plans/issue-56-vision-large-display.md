# 実装プラン：/vision を大画面ビジョン（2m×4m 横長）向けに画面追従サイズへ調整

---

## 対象Issue

- **Issue番号**：#56
- **タイトル**：[改善] /vision を大画面ビジョン（2m×4m 横長）向けに画面追従サイズへ調整
- **URL**：https://github.com/hfujii-gif/declaration-tree/issues/56

---

## ステータス

- [x] プラン作成中
- [x] レビュー待ち
- [x] 承認済み → 実装開始可能
- [x] 実装完了
- [x] PR作成済み

---

## 前提・問題の整理

本番ビジョンは 縦2m × 横4m（アスペクト比 **2:1**）の横長。見かけの大きさを決めるのは物理サイズではなく
**再生PCが出力する解像度（ピクセル数）**。現状 /vision は主要要素が「ピクセル固定」で作られているため、
高解像度で映すほど木・文字が画面に占める割合が小さくなる。

現状の固定サイズ（＝小さく映る原因）:
- 木：`components/vision/CenterTree.module.scss` の `.tree` が `825px × 460px`、`.canopy` が `640px × 400px`、`.treeWrap` の `scale(1.05)`
- カウンター：`app/vision/page.module.scss` の `.counter` が `font-size: 2.5rem` 固定
- 中央宣言テキスト・達成テキスト：`lib/animations.ts` の `clamp(...)` の**上限**が効いていて大画面でも一定以上大きくならない

> 引き伸ばし（16:9出力を2:1面へ拡大）は再生PC/ビジョン側の出力設定の話であり、CSSでは解決不可。
> 本Issueは「解像度が上がっても小さくならない」ことを担保する。引き伸ばしの有無は実機の目視で確認する。

---

## 実装対象ファイル

### 新規作成するファイル
```
なし
```

### 編集するファイル
```
app/vision/page.tsx                    … --screen-scale(=innerHeight/1080) を html に設定する layout effect（resize対応・cleanup付き）
app/vision/page.module.scss           … .counter の font-size・bottom を var(--screen-scale,1) 追従に
components/vision/CenterTree.module.scss … .treeWrap の base scale を var(--screen-scale,1) 追従に変更（base係数1.9）
lib/animations.ts                      … 宣言/達成テキストの clamp 上限を引き上げ
```

---

## 依存関係の確認

| 依存するファイル/Issue | 状態 |
|---|---|
| lib/constants.ts | ✅ 完了（本Issueでは変更しない） |
| types/index.ts | ✅ 完了（変更なし） |
| lib/firebase.ts | ✅ 完了（変更なし） |
| 先行Issue | なし（#56 が /vision リサイズ系の起点） |

---

## 実装方針

### 採用する方式：ビューポート高さ基準のスケーリング（比率は JS で算出）

横長（2:1）の壁では**高さが制約側**になるため、主要要素のサイズを「基準高さ」に対する
ビューポート高さの比率 `--screen-scale` で追従させ、各要素はそれを掛けるだけにする。

> **実装メモ（当初案からの修正）**：当初は `--screen-scale: calc(100vh / 1080)` を純CSSで置く想定だったが、
> CSS の `calc(100vh / 1080)` は**単位なしの数値ではなく長さ（vh）**になり、`2.5rem * (vh値)` や
> `scale(1.9 * (vh値))` といった乗算が不正になる（`scale()`/`bottom`/`font-size` が無効化される）。
> そのため実値は **JS（`page.tsx` の layout effect）で `window.innerHeight / 1080`（単位なしの数値）を
> `html` 要素に `setProperty('--screen-scale', ...)` する**方式に変更した。resize でも更新し、
> クリーンアップでリスナー解除・`removeProperty` する。各使用箇所は `var(--screen-scale, 1)` とし、
> JS 適用前・SSR 時は等倍(1)＝従来の見た目にフォールバックする。

- 木：`.treeWrap { transform: translateX(-50%) scale(calc(1.9 * var(--screen-scale, 1))); }`
  - `transform-origin: bottom center` は維持。段階拡大（`.canopy` の scale）・パルス（`[data-tree-inner]`、GSAP）は
    別要素なので競合せず、乗算で合成される。base 係数は 1.9（1080pで画面高の約80%）。
  - canvas 吸収演出（#44）は `data-canopy` の実測 rect を使うため、CSS transform 下でも座標は正しく追従する（挙動不変）。
- カウンター：`font-size` と `bottom` を `calc(... * var(--screen-scale, 1))` で追従させる。
- 宣言/達成テキスト（`lib/animations.ts`）：`clamp(下限, vmin値, 上限)` の**上限を引き上げ**て、大画面で頭打ちに
  ならないようにする。横長では `vmin == vh`（landscape では常に高さ側）なので、上の高さ基準と一貫する。

### なぜこの方式か
- 木・カウンター・テキストを**同じ「高さ基準」**に揃えるので、解像度が変わっても比率が一定・一貫する。
- 2:1 の横長で木は中央に大きく収まり、左右の余白は背景（星景）とレア装飾が埋める既存構図を崩さない。
- 変更は数ファイル・数行に収まり、イベント前でも低リスク。

### 初回適用のポップ対策
- 出力が1080p以外だと、フォールバック(1)→JS実値への切替時に `.treeWrap` の `transition: transform 1.2s`
  でロード時に木が拡大する“ポップ”が見え得る。これを防ぐため、初回適用は**ペイント前に走る layout effect**
  （SSR警告を避けるためクライアントのみ `useLayoutEffect` を使う同型ラッパー）で行う。

### 代替案（不採用）
- 全体を固定サイズの「デザインキャンバス」で包み `transform: scale()` で contain 表示：均一に拡大できるが、
  既存の %指定レイアウト・背景 cover・装飾配置を作り直す必要があり、本番前の変更としては影響範囲が大きい。

---

## 考慮が必要な点

### エラーハンドリング
- 見た目（CSS）＋ `--screen-scale` を設定する JS のみ。Firebase・API等のロジックには触れないため新たな例外処理は不要。

### メモリリーク対策
- `--screen-scale` 用に `window` の `resize` リスナーを1つ追加する。クリーンアップで `removeEventListener` し、
  `--screen-scale` も `removeProperty` する。GSAP・rAF は追加しない。

### 型の定義
- 型追加なし（`lib/animations.ts` は既存の文字列 `fontSize` 引数の値を変えるのみ）。

### その他
- **装飾（クジラ/マンタ等）は本Issueの対象外**。これらも固定px canvas だが、Issueの完了条件は木・カウンター・
  テキストに限定されている。装飾のサイズ追従は必要なら別Issueで対応する（本PRのスコープを絞る）。
- **`--screen-scale` は他のCSSモジュールにも継承される**（カスタムプロパティはモジュールスコープ外）。命名は
  衝突しないよう `--screen-scale` とする。
- マジックナンバー方針：基準高さ `1080` はレイアウト定数としてSCSS内にコメント付きで置く（`lib/constants.ts`
  はロジック定数用のため、CSSのデザイン基準値はSCSS側に留める。既存の `CANOPY_W` 等と同じ扱い）。

---

## レビューで確認してほしい決定事項

1. **基準高さと木の基準サイズ**：`--screen-scale = 100vh/1080` は「1080pで今の見た目＝等倍」。
   1080pでの木がまだ小さいと感じる場合は、木の base 係数（現状 `1.05`）を上げて全体的に大きくできる。
   「解像度非依存にする」だけで良いか、「そもそも今より大きく見せたい」かで係数を決めたい。
2. **装飾のサイズ追従はスコープ外**で良いか（必要なら別Issue化）。

---

## 完了条件

- [ ] 本番と同じPCを実機ビジョンに接続しフルスクリーンで、木・カウンター・宣言/達成テキストが十分大きく映る
- [ ] 横に間延び／レターボックスで極端に小さくならない（引き伸ばしは出力設定側でも確認）
- [ ] 1920×1080・高解像度いずれの出力でも木・文字が極端に小さくならない（比率が一定）
- [ ] canvas 吸収演出（宣言→木への吸い込み）の着地位置がスケール後もズレない
- [ ] `npm run build` が通ること
- [ ] `npx tsc --noEmit` でエラーがないこと
- [ ] `npm run lint` でエラーがないこと

---

## 承認コメント欄

> プランを確認したら以下に承認コメントを記入してください。

**承認者**：ユーザー（会話内で承認）
**承認日**：2026-07-15
**コメント**：決定事項は未指定のためデフォルト方針（解像度非依存＝1080pで等倍、装飾はスコープ外）で実装。
