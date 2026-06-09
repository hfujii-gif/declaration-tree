# 実装プラン：Issue #44 /vision 宣言テキストのパーティクル吸収演出＋葉システム撤去・配線替え

## 対象Issue

- **Issue番号**：#44
- **タイトル**：[Phase3] /vision 宣言テキストのパーティクル吸収演出＋葉システム撤去・配線替え
- **URL**：https://github.com/hfujii-gif/declaration-tree/issues/44
- **ラベル**：phase-3-frontend

---

## Context（なぜこの変更を行うか）

サイバー化（#41で仕様確定）の**最重要変更**。宣言到着時の体験を「葉を1枚追加」から
「宣言テキストのパーティクル吸収演出」に作り直す。#43 でサイバー風の木（マトリックス・デジタルレイン樹冠）が
入ったので、本Issueでその木を「吸収先」として使い、旧・葉システムを完全撤去して /vision を新演出に配線し直す。

新演出フロー（CLAUDE.md /vision）：
1. 新着宣言を検出 → 2. 画面中央に約1/3サイズで宣言テキストを大きく表示 →
3. マトリックス風に1文字ずつ分解（パーティクル化） → 4. パーティクルが中央の木に吸い込まれる →
5. 木が一瞬明るくなる（発光）。

---

## 現状把握（#43マージ後）

- `app/vision/page.tsx`：`useTransientLeaves()` の `spawn(text)` を `onChildAdded` で呼び、`<LeafLayer>` を描画。
  累計は `onValue`→`count`、マイルストーンは `playMilestone/playFullBloom`（`celebrationRef`＝Celebration レイヤー、`treeRef`＝CenterTree）。
- `components/vision/CenterTree.tsx`：canvas のデジタルレイン樹冠。`treeRef`（treeWrap div）を公開し、
  内側に `[data-tree-inner]`（パルス対象）と `[data-canopy]`（**吸収先フック**＝canvas）を持つ。
- `components/vision/Celebration.tsx`：全画面・最前面・pointer-events:none の演出ホスト（`celebrationRef`）。
- `lib/animations.ts`：GSAP 演出群。`ensurePlugins()`（SplitText/Physics2D登録）、`makeEl()`、
  `showText()`（SplitTextで1文字ずつ）、`pulseTree()`、`clearCelebrations()` などを保有。**ここに新演出を追加して再利用する**。

---

## 実装対象ファイル

### 新規作成
```
components/vision/useDeclarationStream.ts   … 宣言演出のキュー管理フック（旧 useTransientLeaves の置き換え）
```

### 編集
```
lib/animations.ts          … 宣言吸収演出 playDeclaration() を新規追加（既存GSAP基盤を再利用）
app/vision/page.tsx        … 葉システムを外し、新演出へ配線替え
lib/constants.ts           … 葉定数を削除し、宣言演出の定数を追加
app/globals.scss           … 葉CSS変数（未使用化したもの）を削除
```

### 削除
```
components/vision/LeafItem.tsx
components/vision/LeafLayer.tsx
components/vision/LeafLayer.module.scss
components/vision/useTransientLeaves.ts
```

---

## 実装方針

### 1. `playDeclaration(text, layer, tree)` を lib/animations.ts に追加
既存の `ensurePlugins()`・`makeEl()`・SplitText・Celebration レイヤー・`clearCelebrations()` を再利用する。

- **表示**：layer 直下に中央寄せのテキスト要素を生成。サイズは画面の約1/3（`max-width: ~60vw`、
  `font-size: clamp(...)`、50文字は折り返し可）。フェード＋スケールで素早く登場し、`DECLARATION_TEXT_HOLD_MS` 読ませる。
- **マトリックス分解**：`SplitText(el, { type: 'chars' })` で1文字ずつに分割。各文字を短時間
  ランダムなマトリックス文字（英数字）に数回スクランブルさせ「パーティクル化」の質感を出す。
- **吸収**：各文字を木のキャノピー中心へ飛ばす。吸収先座標は
  `tree.querySelector('[data-canopy]').getBoundingClientRect()` と `layer.getBoundingClientRect()` から算出し、
  文字ごとに `x/y` のデルタを GSAP で tween（stagger）。飛びながら縮小・緑/シアンへ色シフト・フェードして木に消える。
- **木が光る**：吸収到達に合わせ、キャノピー位置に短い発光（glow 要素を layer に生成して膨らませ消す）。
  必要に応じ `pulseTree()` の軽量版で木を一瞬だけ明るく。
- **クリーンアップ**：完走時に SplitText を `revert()`、生成DOM（テキスト・glow）を remove。タイムラインを return。
- **reduced-motion**：`prefers-reduced-motion` 時は飛行・スクランブルを省き、テキストを軽くフェードイン→アウトのみ。

> 演出の細かな見た目パラメータ（イージング・色・スクランブル回数等）は、既存の `CONFETTI_COLORS` 等と同様に
> animations.ts 内のローカル定数として持つ。ユーザー仕様に直結する時間・上限のみ lib/constants.ts に置く（下記）。

### 2. `useDeclarationStream` フック（キュー管理）
25台同時送信でも破綻しないよう、宣言演出を**直列に1件ずつ**再生する（中央スポットライトは同時に1つ）。

- `useDeclarationStream(layerRef, treeRef)` → `enqueue(text)` を返す。
- 内部に ref のキューと「再生中」フラグを持つドライバ。アイドル時に1件取り出して `playDeclaration` を呼び、
  完了（タイムラインの onComplete / Promise）で次へ。
- **キュー上限 `DECLARATION_MAX_QUEUE`**：超過分は捨てて `log` 相当の `console.warn`（無音の打ち切りにしない）。
  さらにバックログが大きいときは表示時間を短縮してドレインを早める（任意・実装で調整）。
- **メモリリーク対策**：アンマウント時に進行中タイムラインを kill し、キューを空にする。
  併せて page 側の既存 `clearCelebrations()`（layer 全消し）も効くため二重に安全。

### 3. page.tsx の配線替え
- `LeafLayer`・`useTransientLeaves` の import と `<LeafLayer>` を削除。
- `const enqueueDeclaration = useDeclarationStream(celebrationRef, treeRef)` を追加。
- `onChildAdded` 内の `spawn(d.text)` → `enqueueDeclaration(d.text)`。useEffect 依存も差し替え。
- カウンター（`isVisible=true`）・木の段階成長・マイルストーン演出は**現状維持**。

### 4. lib/constants.ts
- **削除**：`LEAF_DISPLAY_MS` / `MAX_VISIBLE_LEAVES` / `LEAF_EVICT_FADE_MS`（葉システムのみが使用）。
- **追加**（新演出の主要タイミング・上限。CLAUDE.md 準拠で値はここに集約）：
  - `DECLARATION_TEXT_HOLD_MS`（中央テキストを読ませる時間）
  - `DECLARATION_ABSORB_MS`（分解〜吸収にかける時間）
  - `DECLARATION_MAX_QUEUE`（同時バースト時のキュー上限）

### 5. app/globals.scss（CSS変数の掃除：#43で先送りした分）
- **削除**：`--color-leaf-1..4` / `--color-leaf-deep` / `--color-bloom-leaf`（葉システム撤去で未使用化）。
- **保持**：`--color-leaf-glow`（#43の樹冠グロー＝CenterTree が使用中）。
- 旧 `--color-sky-*` / `--color-sun` / `--color-cloud` / `--color-trunk*` も grep で未使用を確認できたものは削除する
  （**削除前に必ず参照ゼロを確認**し、build を緑に保つ）。

---

## 実装ステップ（承認後）

1. develop から `feature/issue-44-vision-particle-absorb` を作成。本プランを規約の保存先に複製。
2. lib/constants.ts：葉定数を削除、宣言演出定数を追加。
3. lib/animations.ts：`playDeclaration()` を追加。
4. components/vision/useDeclarationStream.ts：キュー管理フックを新規作成。
5. app/vision/page.tsx：葉撤去＋新演出へ配線替え。
6. 葉ファイル4点を削除。
7. app/globals.scss：未使用化したCSS変数を削除（grepで参照ゼロを確認してから）。
8. `npx tsc --noEmit` / `npm run lint` / `npm run build` を通す。
9. `npm run dev` で動作確認（下記検証）。
10. コミット → develop へPR（Closes #44）。マージは人間。

---

## 考慮が必要な点

- **同時送信の破綻防止**：直列再生＋キュー上限。上限超過は `console.warn` で可視化（無音打ち切り禁止）。
- **メモリリーク**：playDeclaration は完走時に必ず DOM/Tween/SplitText を破棄。フックはアンマウントで kill＋クリア。
- **吸収先座標**：`[data-canopy]` の rect を毎回算出（別モニタ移動・リサイズでもズレない）。
- **型**：`any` 禁止。`enqueue: (text: string) => void`、`playDeclaration(...): gsap.core.Timeline` を明示。
- **マジックナンバー禁止**：主要タイミング・上限は constants.ts。色/イージングは animations.ts ローカル定数。
- **非干渉**：CenterTree（#43）・マイルストーン演出（#45予定）には手を入れない。`[data-canopy]`/`[data-tree-inner]` 契約を尊重。

---

## 完了条件（Issueより転記）

- [ ] 宣言送信時に「中央に1/3サイズ表示→マトリックス分解→木へ吸収→木が発光」が再生される
- [ ] 葉が一切表示されない（葉システムが完全に撤去されている）
- [ ] カウンター・段階成長が従来通り動作する
- [ ] `npm run build` / `npx tsc --noEmit` / `npm run lint` が通る

---

## 検証方法

- `npm run dev` → `http://localhost:3000/vision` を開く。
- 別タブの `http://localhost:3000/input` から宣言を送信し、ビジョン側で
  「中央に大きくテキスト表示→1文字ずつマトリックス分解→木へ吸い込まれ→木が一瞬光る」を確認。
- 連続送信（短時間に複数）でキューが直列再生され、破綻しない／上限超過時に `console.warn` が出ることを確認。
- 葉が一切出ないこと、カウンターが増えること、`?stage=` の段階成長が従来通りであることを確認。
- ビルド一式（tsc/lint/build）パス。長時間放置でDOMノードが増え続けないこと（演出DOMが完走後に消える）を目視/DevToolsで確認。

---

## 承認コメント欄

**承認者**：  
**承認日**：  
**コメント**：
