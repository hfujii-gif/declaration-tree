# 実装プラン：Issue #31 /vision ビジュアル実装（中央の木・テキスト葉・背景）

## 対象Issue

- **Issue番号**：#31
- **タイトル**：[Phase3] /vision のビジュアル実装（中央の木・テキスト葉・背景）
- **URL**：https://github.com/hfujii-gif/declaration-tree/issues/31

---

## ステータス

- [ ] プラン作成中
- [ ] レビュー待ち
- [ ] 承認済み → 実装開始可能
- [ ] 実装完了
- [x] PR作成済み（PR #34）

### 動作確認メモ
- `npx tsc --noEmit` / `npm run lint` / `npm run build`：いずれも成功。`/vision` 静的生成。
- `npm run dev` で `/vision` → HTTP 200。背景・中央の木・雲・カウンター・各 `?stage=` を目視確認、サーバーエラーなし。
- **未検証（実Firebase必須）**：テキスト葉の出現/30秒消去/重なり回避、累計件数による木の段階成長。`.claude/rules/testing.md` の /vision テスト工程に委譲。

### 実装中の主な調整（目視レビューを重ねて確定）
- 中央の木：「自然・リアル寄り」方針。単色（`--color-leaf-3`）の有機的な葉の塊＋木目グラデの幹。
  成長は周辺クラスター追加だと浮いて見えたため、**中央の塊そのものが下端基準で段階拡大**する方式に。
- テキスト葉：横向きの葉（葉脈・縁に虫食いの切り欠き）。50文字でも切れないよう幅広（`24vw`）＋最小高さ。
  画面端で切れないようスロット範囲を内側に確保し、大きい葉が重ならない上限として `MAX_VISIBLE_LEAVES = 9`（3×3）に調整。
- プレビュー：`?stage=0〜4` で各成長段階を確認可能（`useSyncExternalStore` でハイドレーション安全）。本番では無害。

---

## 概要

/vision のビジュアルを3レイヤーで実装する。

1. **テキスト葉（一時表示）**：宣言の全文が書かれた葉が、画面のランダムな位置にフェードインし、
   **30秒（`LEAF_DISPLAY_MS`）後にフェードアウトして消える。累積しない。** 色・形・サイズにばらつき。連続投稿でも重ならない。
2. **中央の木（常設）**：枝分かれした木が中央に常設。累計が `MILESTONES`(2500/5000/7500/10000) を超えるごとに1段階大きくなる（初期＋4段階）。
3. **背景**：大地＋空。雲が流れる（CSS常時アニメ）。

CSS / SVG で実装し、カスタムイラストは使わない。**動きの作り込み（GSAP演出）は #11 のスコープ。**

---

## ⚠️ 要確認：CLAUDE.md の /vision 仕様との不整合

CLAUDE.md（80〜86行）の `/vision` 仕様は**旧モデルのまま**で、本Issueの新デザインと矛盾している。

| CLAUDE.md 現行記述 | 本Issueの新デザイン |
|---|---|
| 「新しい宣言が届くたびに葉を1枚追加」 | 葉は**30秒で消える一時表示・累積しない** |
| （葉が積み上がって木になる前提） | 木は**マイルストーンで段階成長**（葉の数では育たない） |
| 「画面下部に累計宣言数を常時表示」 | 維持（変更なし） |
| 「マイルストーン演出 2,500/5,000/7,500」 | 木のサイズ段階変化＝本Issue／祝祭テキスト・演出＝#11 |

→ このままだとレビュー/テスト工程で「仕様と実装が不一致」と判定される。
**本PRに CLAUDE.md の `/vision` 節の更新（docs）を含める方針**とする。具体的には：
- 「葉＝宣言全文を30秒だけランダム位置に表示（累積しない・重なり回避）」
- 「中央の木＝累計のマイルストーン到達ごとに段階成長」
- 「背景＝大地・空・流れる雲」
- アニメ詳細（`gsap.from(...)`）は #11 の責務である旨を明記

**この方針（CLAUDE.md を本PRで書き換える）でよいか、承認時にご確認ください。** NGなら別Issue/別PRに分離する。

---

## 実装対象ファイル

### 新規作成
```
components/vision/CenterTree.tsx          # 中央の枝分かれの木（props: stage）
components/vision/CenterTree.module.scss
components/vision/LeafLayer.tsx           # テキスト葉の描画レイヤー（presentational）
components/vision/LeafLayer.module.scss   # 葉・レイヤーのスタイル（LeafItem も共有）
components/vision/Background.tsx          # 大地・空・流れる雲
components/vision/Background.module.scss
components/vision/useTransientLeaves.ts   # ★テキスト葉のライフサイクル管理フック（下記・決定3）
```

### 編集
```
app/vision/page.tsx           # Firebase購読を再設計（累計→stage / 新着→テキスト葉）。Tree を CenterTree/LeafLayer/Background に置換
app/vision/page.module.scss   # 3レイヤーの重ね順（z-index）
components/vision/LeafItem.tsx # 菱形 → テキスト葉（全文表示・色/形/サイズばらつき・フェード）に作替
lib/constants.ts              # LEAF_DISPLAY_MS / MAX_VISIBLE_LEAVES を追加
CLAUDE.md                     # /vision 節を新デザインに更新（上記・要確認）
```

### 削除
```
components/vision/Tree.tsx          # 旧・菱形描画。CenterTree/LeafLayer へ移行
components/vision/Tree.module.scss
```

> ★ `useTransientLeaves.ts` は #31 のファイル一覧には無いが追加する（決定3で理由を記載）。
> `LeafItem` 専用SCSSは作らず `LeafLayer.module.scss` を共有する（#10で Tree.module.scss を共有していたのと同じ方針）。

---

## 依存関係の確認

| 依存 | 状態 | 備考 |
|---|---|---|
| #10（/vision データ層） | ✅ 完了（PR #32 マージ済み） | `onValue` 購読・カウンターの土台。本Issueで購読を拡張・再設計 |
| lib/firebase.ts | ✅ 完了 | `db, ref, onValue, off` を export 済み。**`onChildAdded` は未export → 追加が必要** |
| lib/constants.ts | ✅ 完了 | `MILESTONES` を再利用。`LEAF_DISPLAY_MS`/`MAX_VISIBLE_LEAVES` を追加 |
| types/index.ts | ✅ 完了 | `Declaration` を使用。葉の描画用ビューモデル型はフック内ローカルに定義（後述） |
| app/globals.scss | ✅ 完了 | `--color-bg/accent/text/error/gray` を使用。葉色バリエーション用に色を足す可能性あり |

→ `lib/firebase.ts` に **`onChildAdded` の追加 export** が必要。

---

## 設計上の決定事項

### 決定1：購読は `onValue`（累計・stage）＋ `onChildAdded`（新着葉）の2本立て
- **累計カウンター・木のstage**：既存の `onValue` を流用（`isVisible` フィルタ後の件数）。`isVisible` の切替（管理画面で非表示化）にも正しく追従できるため、カウント用途は `onValue` が最も堅牢。
- **新着のテキスト葉**：`onChildAdded` を使い、**新しく追加された宣言だけ**を1件ずつ受け取る（差分のみ＝10,000件のスナップショットを毎回受け取らずに済む）。
- **初期ロードの葉の大量発生を防ぐ**：`onChildAdded` は購読開始時に既存の全子に対しても発火する。Firebaseは「初期の child_added がすべて発火した後に value が1回発火する」順序を保証するので、
  - `onValue` の**初回コールバックで `initialLoaded = true`** にする（ref で保持）。
  - `onChildAdded` 側は `initialLoaded === true` のときだけテキスト葉を生成する。
  これで初期表示時に既存宣言ぶんの葉が一斉に湧くのを防ぐ（timestamp比較のハックが不要で堅牢）。

### 決定2：リスナー解除は `onValue`/`onChildAdded` の戻り値（unsubscribe）で個別解除
- #10 のレビュー任意指摘#1 を反映。`off(ref)` はパス上の全リスナーを解除してしまうため、
  同じ `declarations` パスに2本（value + child_added）張る本Issueでは**コールバック単位の解除が必須**。
- `const unsubValue = onValue(...)` / `const unsubChild = onChildAdded(...)` の戻り値を cleanup で両方呼ぶ。

### 決定3：テキスト葉のライフサイクルは専用フック `useTransientLeaves` に集約
- 「ランダム配置＋重なり回避＋30秒で自動消去＋上限超過時に最古を退避」は**状態を持つ複雑なロジック**で、
  page.tsx に直書きすると肥大化・可読性低下する。1つのカスタムフックに閉じ込める（過剰な抽象化ではなく、関心の分離）。
- フックの責務：
  - 状態：現在表示中の葉 `PlacedLeaf[]`（id・text・配置スロット・座標・見た目バリエーション）。
  - `spawn(declaration)`：空きスロットへランダム配置。空きが無ければ**最古の葉を即時消去**してスロットを空けてから配置（ユーザー承認済み挙動）。
  - 各葉に30秒タイマー（`LEAF_DISPLAY_MS`）。発火で葉を除去しスロットを解放。**全タイマーを ref で保持し、アンマウント時に全クリア**（メモリリーク対策）。
- `PlacedLeaf` 型はフック内ローカル定義（ドメイン型ではないので `types/index.ts` には置かない）。

### 決定4：重なり回避はスロット方式
- 配置領域＝ビューポートから「中央の木の領域」と「下部カウンター領域」を除いた**空（上部・左右）**。葉は空に浮かぶイメージ。
- 配置領域を `R×C` のスロットグリッドに分割。1葉＝1スロット。スロット内で軽くランダムジッターを加えるが**スロット境界内に収め**、隣接スロットと重ならないことを保証する。
- 同時表示数の上限＝スロット数＝`MAX_VISIBLE_LEAVES`（定数化）。
- 葉は全文（最大50文字）が読めるサイズを下限とし、サイズばらつきはスロットに収まる範囲に限定。

### 決定5：木のstageは `MILESTONES` から算出（新規しきい値は作らない）
- `stage = MILESTONES.filter((m) => count >= m).length`（0〜4）。
- stage を `CenterTree` に渡し、CSSクラス＋`transition` でサイズ（＋枝・葉の量）を滑らかに変化させる。
- **祝祭的なパルス／達成テキスト／満開は #11**。本Issueはあくまで「静的な段階の見た目とその切替」まで。

### 決定6：背景・雲はCSSのみ
- 空（上）＋大地（下）はCSSグラデーション等。雲は要素を `@keyframes` で横方向に無限ループ移動（GSAP不要・JSタイマー不使用＝リークなし）。

---

## 実装ステップ

承認後、以下の順で実装する。

1. **lib/firebase.ts に `onChildAdded` を追加 export**（import 行と export 文に追記）。
2. **lib/constants.ts に定数追加**：`LEAF_DISPLAY_MS = 30000`、`MAX_VISIBLE_LEAVES`（スロット数の上限）。
3. **components/vision/Background.tsx（＋scss）**：空・大地・流れる雲。
4. **components/vision/CenterTree.tsx（＋scss）**：props `stage` で段階成長する枝分かれの木（SVG/CSS）。
5. **components/vision/useTransientLeaves.ts**：葉のライフサイクル（spawn・配置・30秒消去・上限時の最古退避・タイマー全クリア）。
6. **components/vision/LeafItem.tsx を作替**：テキスト葉（全文・色/形/サイズばらつき・フェードのCSS）。
7. **components/vision/LeafLayer.tsx（＋scss）**：`PlacedLeaf[]` を受け取り `LeafItem` を並べる presentational。
8. **app/vision/page.tsx を再設計**：
   - `onValue`（count→stage、初回で `initialLoaded`）＋ `onChildAdded`（`initialLoaded` 後に `spawn`）。
   - cleanup で両 unsubscribe を呼ぶ。
   - 描画：`<Background />` / `<CenterTree stage={stage} />` / `<LeafLayer leaves={leaves} />` / カウンター。z-index は page.module.scss で管理。
9. **components/vision/Tree.tsx・Tree.module.scss を削除**（参照が無いことを確認）。
10. **CLAUDE.md の /vision 節を更新**（要確認の方針に従う）。
11. **検証**：`npm run build` / `npx tsc --noEmit` / `npm run lint` ＋ `npm run dev` で /vision を目視（葉の出現・30秒消去・重なり回避・stage切替・雲）。

---

## 考慮が必要な点

### メモリリーク対策（最重要・8時間稼働）
- `onValue`／`onChildAdded` の2リスナーを **戻り値（unsubscribe）で個別解除**（決定2）。
- 葉ごとの30秒タイマーを ref（Map等）で保持し、**アンマウント時に全クリア**（決定3）。
- 雲はCSSアニメのみでJSタイマー無し。

### パフォーマンス
- テキスト葉は「30秒 × 投稿ペース」かつ `MAX_VISIBLE_LEAVES` で**上限が有界**。#10の「全件常時描画（最大1万DOM）」問題はこの設計で解消する。
- 一方、**カウント用 `onValue` は変更のたびに `declarations` 全体を再取得する**（10,000件規模で帯域・CPUコスト）。本Issueでは対応せず、長時間・負荷の実機検証は **#15 / #14** に委ねる（必要なら子イベント集計へ移行を検討する follow-up）。

### 型
- `Declaration` を使用。葉の描画用ビューモデル（`PlacedLeaf`）は `useTransientLeaves.ts` 内にローカル定義。`any` 不使用。

### エラーハンドリング
- `onValue`/`onChildAdded` のエラーコールバックで `console.error`（握りつぶさない）。

### セキュリティ
- 環境変数のハードコード無し。Firebase操作は `lib/firebase.ts` 経由に統一（`onChildAdded` もそこから export）。

### スコープ境界（#11との重複回避）
- 本Issue：葉のフェードは**CSS transition**、stage変化も**CSS transition**まで。
- #11：葉出現を `gsap.from(... back.out)` で質感向上／マイルストーン到達のパルス＋達成テキスト／1万人の満開（花びら・光・テキスト）。

---

## 完了条件（Issue #31 から転記）

- [ ] 中央に枝分かれの木が表示され、累計が 2500/5000/7500/10000 を超えるごとに1段階大きくなる（初期＋4段階）
- [ ] 段階ごとに木のサイズ（＋枝・葉の量）が変化する
- [ ] 新しい宣言が届くと、その全文が書かれた葉が画面のランダムな位置にフェードインし、30秒後に消える
- [ ] 葉の色・形・サイズにばらつきがある
- [ ] 連続して宣言が来ても葉が重ならない
- [ ] 背景に大地と空が表示され、雲が流れている
- [ ] #10 の累計カウンターが引き続き正しく表示される
- [ ] 追加した購読・タイマーがアンマウント時に解除される（メモリリーク対策）
- [ ] 表示時間が lib/constants.ts の定数（LEAF_DISPLAY_MS=30000）で管理されている
- [ ] 色が CSS変数を使っている（演出用固定色を除く）
- [ ] npm run build / npx tsc --noEmit / npm run lint が通る

### 追加（本プランの方針）
- [ ] CLAUDE.md の /vision 節を新デザインに更新（※承認方針による）

---

## 承認コメント欄

> プランを確認したら以下に承認コメントを記入してください。

**承認者**：Haruto Fujii
**承認日**：2026-05-28
**コメント**：承認。CLAUDE.md の /vision 更新・useTransientLeaves フック追加を含めてプラン通り実装する。
