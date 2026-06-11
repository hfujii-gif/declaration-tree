# 実装プラン：Issue #45 /vision マイルストーン／満開演出のサイバー化

## 対象Issue

- **Issue番号**：#45
- **タイトル**：[Phase3] /vision マイルストーン／満開演出のサイバー化
- **URL**：https://github.com/hfujii-gif/declaration-tree/issues/45
- **ラベル**：phase-3-frontend

---

## Context（なぜこの変更を行うか）

#43/#44 で /vision はサイバー化（発光する木＋デジタルレイン樹冠＋宣言テキストのパーティクル吸収）された。
一方で **マイルストーン演出（2,500/5,000/7,500）と満開演出（10,000）は #11 当時の暖色トーンのまま**
（金色のグロー・光線、紙吹雪、ピンクの花びら）で、新しいサイバーな世界観から浮いている。

本Issueで `lib/animations.ts` の `playMilestone` / `playFullBloom` をサイバー風に作り直す：
- 暖色（金/ピンク）→ シアン/青/白のデジタル発光
- 紙吹雪・花びら → グロー付きの“データの粒”・グリッチ・光のリング
- **満開（10,000）は「光が画面全体に広がる」演出に変更**（仕様 #41 の明示要件）

公開APIの形・呼び出し側（page.tsx の二重発動防止・?stage=/?celebrate= プレビュー）は変えない。

---

## 現状把握

- `lib/animations.ts`
  - 公開API：`playMilestone(stage, count, layer, tree)` / `playFullBloom(layer, tree)`（page.tsx が呼ぶ）
  - 内部ヘルパー：`addFlash` `addShockwave` `addGlow` `addRays` `burstConfetti` `burstPetals`
    `showText` `pulseTree` `addSparkles` `makeEl` `ensurePlugins`
  - 色定数：`CONFETTI_COLORS`(金/ピンク/緑/青/白) `PETAL_COLOR`(ピンク) `TEXT_GOLD`(金)
  - これらヘルパーは **マイルストーン／満開専用**（宣言吸収 `playDeclaration` は別系統）なので、
    暖色をサイバー配色に置き換えても他演出に影響しない。
- `app/vision/page.tsx`：`firedIndexRef` で二重発動を防止し、stage 1-3 は `playMilestone`、
  10,000 は `playFullBloom` を呼ぶ。`?celebrate=` プレビューも同じAPIを叩く。**本Issueでは変更しない**。
- `components/vision/CenterTree.tsx`：`data-bloomed` で満開時に樹冠の発光が最大化（#43/#44 で既にサイバー）。
  本Issueでは原則触らない（必要なら発光の微調整のみ）。

---

## 実装対象ファイル

### 編集
```
lib/animations.ts   … マイルストーン／満開のヘルパーと公開2関数をサイバー化
```
### 触らない
```
app/vision/page.tsx          … 二重発動防止・プレビュー・呼び出しは現状維持
components/vision/CenterTree.* … data-bloomed は #43/#44 で対応済み（必要時のみ微調整）
lib/constants.ts             … しきい値は MILESTONES を継続使用。演出の色/時間は animations.ts ローカル定数
```

---

## 実装方針（すべて lib/animations.ts 内）

### 1. 配色をサイバーに差し替え
- `CONFETTI_COLORS` → シアン/白/青/淡緑のデジタル配色（例：`#38E1FF` `#FFFFFF` `#6EA8FF` `#78F5A0` `#BFEBFF`）
- `PETAL_COLOR` は廃止（満開は花びらをやめる）／`TEXT_GOLD` → サイバーのアクセント（シアン）に置換

### 2. 既存ヘルパーをサイバー発光に再塗装（構造は流用）
- `addShockwave`：リングの border/box-shadow を**シアン**に（中央から広がる光輪）
- `addGlow`：放射グラデを**シアン〜白**に
- `addRays`：光のシャフトを**シアン/白**に
- `showText`：金→**白＋シアンの強グロー**（`gold` 引数は「強調(highlight)」の意味に内部リネーム）。
  入場に軽いグリッチ感（わずかな横ブレ）を足してもよい
- `addSparkles`：余韻のキラキラを**シアン/白の発光ドット**に
- `pulseTree`：現状のまま流用（木を一瞬パルス）

### 3. 紙吹雪→“データの粒”、新規グリッチ
- `burstConfetti` を**グロー付きの小さな粒（データビット）**に再塗装（box-shadow でシアン発光、サイズ小さめ）。
  Physics2D の放物線バーストは流用
- **新規 `addGlitch(tl, layer, at)`**：一瞬の**スキャンライン掃引／RGBずれフラッシュ**でデジタル感を出す
  （高段階・満開で使用）。短時間で生成DOMを破棄

### 4. 満開（playFullBloom）＝「光が画面全体に広がる」
- 花びら(`burstPetals`)を廃止し、**新規 `addScreenBloom(tl, layer, at)`** を主役にする：
  木のキャノピー起点（`ORIGIN_TOP`）からシアン〜白の光が**ビューポート全体を覆うまで拡大**して満ちる
  （大きめのスケール／200vmax 級）→ ゆっくり減衰。白フラッシュも重ねて“光に包まれる”感を出す
- 併せて：`addGlitch`・シアン光線・データビット・シアンのキラキラ余韻・`pulseTree`・`showText("10,000人達成！")`
- 木の満開定着（`data-bloomed`）は CenterTree が担当（既存）

### 5. 公開2関数の段階構成は維持
- `playMilestone` の stage 1/2/3 で部品を足して派手にする構成はそのまま、各部品をサイバー版に差し替え
- `playFullBloom` は上記の screen-bloom 主役に再構成
- ラベルは `${count.toLocaleString()}人達成！！` を継続（しきい値は引数 count＝MILESTONES 由来）

### 6. メモリリーク対策（現行パターン踏襲）
- 生成した演出DOMは各 tween の `onComplete` で `remove()`、`gsap.delayedCall` 後に破棄（既存方式）
- ページ側 `clearCelebrations()` がアンマウント時に layer 全消し＋木の transform 復帰（既存）。新ヘルパーもこの傘に入る

---

## 実装ステップ（承認後）

1. develop から `feature/issue-45-vision-milestone-cyber` を作成。本プランを規約の保存先へ複製。
2. 色定数をサイバー配色へ差し替え（CONFETTI→データビット色／TEXT_GOLD→シアン、PETAL 廃止）。
3. `addShockwave`/`addGlow`/`addRays`/`showText`/`addSparkles`/`burstConfetti` をサイバー再塗装。
4. `addGlitch`・`addScreenBloom` を新規追加。`burstPetals` を撤去。
5. `playMilestone`（stage 1-3）・`playFullBloom` をサイバー構成に再編。
6. `npx tsc --noEmit` / `npm run lint` / `npm run build` を通す。
7. `npm run dev` で `?celebrate=2500|5000|7500|10000`・`?stage=5` を使い目視確認（Firebase書き込み不要）。
8. コミット → develop へPR（Closes #45）。マージは人間。

---

## 考慮が必要な点

- **二重発動防止は page.tsx 側（firedIndexRef）で担保済み**。本Issueは演出の中身のみ変更し、呼び出し契約を壊さない。
- **プレビュー動作**：`?celebrate=`/`?stage=` が新演出でそのまま動くこと（APIシグネチャ不変で自動的に満たす）。
- **型**：`any` 禁止。新ヘルパーも `(tl, layer, at)` など既存と同じ型付け。
- **マジックナンバー**：しきい値は MILESTONES。色・時間など純粋な見た目パラメータは animations.ts のローカル定数に集約。
- **長時間稼働**：演出は一過性。生成DOM/Tween を必ず破棄（既存パターン＋clearCelebrations）。
- **負荷**：満開の screen-bloom は1〜数枚の要素＋blur で実現し、粒子は数百個以内に抑える（大画面GPU配慮）。

---

## 完了条件（Issueより転記）

- [ ] マイルストーン到達演出がサイバー風になっている
- [ ] 10,000人達成で光が画面全体に広がる演出になっている
- [ ] 同じマイルストーンで二重発動しない（既存 firedIndexRef を維持）
- [ ] `npm run build` / `npx tsc --noEmit` / `npm run lint` が通る

---

## 検証方法

- `npm run dev` → 以下のURLで目視（Firebase書き込み不要・クライアントのみで発火）：
  - `http://localhost:3000/vision?celebrate=2500` … stage1 マイルストーン（サイバー）
  - `?celebrate=5000` / `?celebrate=7500` … 段階が上がるほど派手（グリッチ・光線増）
  - `?celebrate=10000` … 満開＝光が画面全体に広がる
  - `?stage=5` … 満開定着（樹冠の発光最大）状態の確認
- 二重発動しないこと（同一プレビューで演出が2回走らない）。
- 演出後にDOMが残らないこと（DevTools で layer 配下が空に戻る）。
- ビルド一式（tsc/lint/build）パス。

---

## 承認コメント欄

**承認者**：  
**承認日**：  
**コメント**：
