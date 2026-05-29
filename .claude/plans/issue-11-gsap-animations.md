# 実装プラン：Issue #11 GSAPアニメーションの実装（葉の出現・マイルストーン・満開演出）

## 対象Issue

- **Issue番号**：#11
- **タイトル**：[Phase3] GSAPアニメーションの実装（葉の出現・マイルストーン・満開演出）
- **URL**：https://github.com/hfujii-gif/declaration-tree/issues/11

---

## ステータス

- [x] プラン作成中
- [x] レビュー待ち
- [x] 承認済み → 実装開始可能
- [x] 実装完了
- [x] PR作成済み（PR #35）

---

## 作業ブランチ

```
feature/issue-11-gsap-animations
```

> 本ブランチは `develop`（#34 マージ済み = 新ビジュアル基盤あり）から作成済み（プランファイル配置のため）。
> **GSAP演出の実装本体は承認後に着手する。**

---

## 概要

/vision の3レイヤー実装（背景・中央の木・テキスト葉。#31 / PR #34 でマージ済み）の上に、
**GSAP 演出を「別レイヤー」として追加する。**
CLAUDE.md /vision 仕様の「GSAPによる演出（葉出現の質感向上・マイルストーン到達時のパルス＋達成テキスト・10,000人達成の満開演出）は別レイヤーとして実装する」に対応する。

> ⚠️ 本Issueは #31（PR #34）でビジュアル基盤が刷新されたことを受け、Issue本文・本プランとも**新アーキテクチャ前提で再設計済み**。
> 旧・菱形 `Tree.tsx` は削除されており、旧Issue本文のファイル構成・配線（`Tree.tsx` 内で `declarations.length` を監視）は無効。

---

## 前提：#34 でマージ済みの現状

- **`app/vision/page.tsx`**：`onValue` で `count`（`isVisible=true` 件数）と `stage`（0〜4 = `MILESTONES` 通過数）を算出。`onChildAdded` で新着宣言を `useTransientLeaves` の `spawn(text)` に渡す。`initialLoadedRef` で初期ロードのバーストを抑止済み。レイヤーは `<Background/>` ＋ `<CenterTree stage={stage} />` ＋ `<LeafLayer leaves={leaves} />` ＋カウンター。
- **`components/vision/CenterTree.tsx`**：`stage` を受ける SVG の木。`.treeWrap`（`transform-origin: bottom center`）と `.canopy` を CSS transition で段階成長。**パルス・達成テキストは未実装（本Issueのスコープ）。** `data-stage` と `aria-hidden` 付き。
- **`components/vision/LeafLayer.tsx` / `LeafItem.tsx`**：presentational。葉のフェードイン→フェードアウトは **CSSアニメーション**（`animationDuration = LEAF_DISPLAY_MS`）で実装済み。
- **`components/vision/useTransientLeaves.ts`**：葉のライフサイクル（生成・ランダム配置・30秒自動消去・全タイマーのアンマウント時クリア）。**同時表示が `MAX_VISIBLE_LEAVES`(=9) に達した状態で新着が来ると、最古の葉はフェードなしで即時退避**される（PR #34 レビュー任意指摘2）。
- **GSAP**：`gsap@^3.15.0` 導入済み（#6 / PR #25）。コード内での利用箇所はまだ無い（`lib/animations.ts` は未作成）。

---

## 実装対象ファイル

### 新規作成
```
lib/animations.ts                         # GSAP 演出を集約（プラグイン登録・段階別タイムライン・部品関数）
components/vision/Celebration.tsx          # 達成演出の描画レイヤー（光ベール/フラッシュ/光線/紙吹雪/テキストのDOMホスト）
components/vision/Celebration.module.scss   # 演出レイヤーのスタイル（最前面・pointer-events:none）
```

### 編集
```
app/vision/page.tsx                       # マイルストーン通過検知 → 段階別演出を発火。Celebration を最前面に追加
components/vision/CenterTree.tsx           # 満開バリアント（bloomed prop）＋パルス/モーフ対象を掴む ref・クラス
components/vision/CenterTree.module.scss    # 満開時の色（葉色→花色）・金縁発光のスタイル
components/vision/useTransientLeaves.ts    # 満杯時退避を「即時除去」→「短いフェードアウト後に除去」へ（レビュー指摘2）
components/vision/LeafItem.tsx             # 葉出現の質感向上（現状CSSフェードで不足する場合のみ）
components/vision/LeafLayer.module.scss    # 退避フェード用クラス（必要に応じて）
```

> 演出DOM（光ベール・フラッシュ・紙吹雪・光線・テキスト）は `Celebration.tsx` のレイヤー内にホストし、
> `lib/animations.ts` の関数がそのレイヤーへ要素を生成・破棄する。`document.body` 直挿しは避け、レイヤーの z-index/重なり順を制御可能にする。
> `lib/animations.ts`・`Celebration` 以外は「必要に応じて」最小限に触る。CSSで十分な箇所は二重がけしない（後述・スコープ境界）。

---

## 依存関係の確認

| 依存 | 状態 | 備考 |
|---|---|---|
| #31（/vision 3レイヤー） | ✅ 完了（PR #34 マージ済み・develop反映済み） | 本Issueはこの上に演出を載せる |
| #6（GSAP導入） | ✅ 完了（PR #25 マージ済み） | `gsap@3.15.0`。`lib/animations.ts` は本Issueで新規作成 |
| lib/constants.ts | ✅ 完了 | `MILESTONES`(2500/5000/7500/10000)・`LEAF_DISPLAY_MS`・`MAX_VISIBLE_LEAVES` を使用。**新しいしきい値は作らない** |
| app/vision/page.tsx の `count`/`stage`/`initialLoadedRef` | ✅ 完了 | マイルストーン判定の配線元 |
| useTransientLeaves.ts の満杯時退避 | ✅ 完了（即時除去） | 退避フェードを追加する対象 |

→ 追加の依存・新規 export は不要（GSAP・定数・購読はすべて既存）。

---

## 設計上の決定事項

### 決定1：マイルストーン判定は `app/vision/page.tsx` 側で `count` + `prevCountRef`
- 旧Issueは `Tree.tsx` 内で `declarations.length` を監視していたが、新設計に存在しない。判定は `count`（`isVisible=true` 件数）を持つ `page.tsx` に置く。
- `prevCountRef`（前回値）と比較し、`prev < milestone && count >= milestone` の**上向き通過の瞬間だけ**発火させる（`onValue` は毎回フルスナップショットで `count` を再計算するため、差分判定はこの方式で行う）。
- `milestone === 10000` → `animateFullBloom`、それ以外（2500/5000/7500）→ `animateMilestone`。しきい値は `MILESTONES` をそのまま使う（マジックナンバー禁止）。

### 決定2：初期ロードで過去マイルストーンを一斉発火させない（最重要の落とし穴）
- `onValue` の初回発火では、既存宣言ぶんの `count`（例：起動時に既に 6,000 件）が一気に入る。素朴に判定すると 2500・5000 の演出が同時発火してしまう。
- 既存の `initialLoadedRef`（`onValue` 初回で `true`）を流用し、**初回は `prevCountRef` を現在値で初期化するだけ・演出は出さない**。2回目以降の `count` 変化から判定を始める。
- 8時間稼働中のリロード・再接続でも、起動直後に過去マイルストーンを再生しないこと。

### 決定3：演出関数は `lib/animations.ts` に集約・DOMは渡された container に生成
- `animateMilestone(count, container)` / `animateFullBloom(container)` を純粋な「DOM要素を受け取り演出する関数」として実装。React 状態は持たせず、`page.tsx` の `containerRef.current` を渡す。
- 動的生成したテキスト・花びら・光の要素は、**各 Tween/Timeline の `onComplete` で必ず `remove()`** し、DOM に残さない。

### 決定4：葉の退避フェード（レビュー #34 指摘2）
- `useTransientLeaves.ts` の満杯時、最古の葉を即 `slice(1)` で消すのではなく、**短いフェードアウト後に除去**する。
- 実装方針（いずれか・実装時に確定）：
  - (a) 退避対象に「退避中」フラグ or CSSクラスを付与 → 短時間（例 300〜500ms）後に配列から除去。スロットは新着が即使うため、退避中の葉とは別スロット扱いにする必要がある点に注意。
  - (b) GSAP で退避対象要素を `gsap.to(el, { opacity: 0, duration: 0.3, onComplete: 除去 })`。
- **二重退避・タイマー競合に注意**（同じ葉に退避と30秒消去が同時に走らないよう、退避時は既存タイマーを `clearTimer` 済みにする — 現行ロジックを踏襲）。
- バースト時（25台同時投稿）に葉が「パッと消える」見え方の緩和が目的。過度に長いフェードは残像になるため短め（〜0.5s）に。

### 決定5：葉出現の質感向上はCSSと二重がけしない
- 現状 `LeafItem` はCSSアニメで fade-in/out 済み。GSAP `gsap.from(... back.out)` を足すと **CSSと競合し二重がけ**になる。
- 方針：まずCSSのままで体感を確認し、**物足りない場合のみ** GSAPに寄せる（その場合はCSSのfade-in側を外してGSAPに一本化）。やみくもに追加しない。

### 決定6：スコープ境界（#31 と重複しない）
- #31：木の段階成長・葉のCSSフェード・背景は実装済み。**本Issueはその上の「動きの演出」だけ**を足す。
- 本Issue：マイルストーンのパルス＋達成テキスト、満開演出、（必要なら）葉出現の質感向上、葉退避フェード。

---

## 達成演出 詳細設計（ユーザー確定）

ユーザーとの相談で以下を確定（2026-05-29）。GSAP 3.15.0 には有料プラグインが**全て同梱**されており追加インストール不要（`gsap.registerPlugin()` で有効化）。

### 確定方針
1. **段階的に派手さをUP**：2,500 は控えめ → 5,000 → 7,500 と部品を足して盛り上げ、10,000 が頂点。
2. **10,000達成後は満開のまま定着**：フィナーレ後も木は満開（花）の姿を保持する。
3. **紙吹雪・花びらは Physics2D でリアルに**：速度・角度・重力で噴き上げ→落下の弧を描く。

### 演出の共通言語
- 全段階の核は「**中央が光って木を一瞬覆い隠す → 光が引くと木が次の段階に育った姿で現れる**」。
- これにより #31 の「stage 段階成長（CSS transition）」と演出を合体させ、達成＝光に包まれて成長する一本の物語にする。
- 光ベールが木を隠している隙に stage が次段階へ切り替わるよう、演出タイムラインの中で成長の見せ場を作る。

### 使用プラグインと部品（GSAP技法）
| パーツ | 技法 / プラグイン |
|---|---|
| 中央グロー（光ベール） | radial-gradient div を `fromTo(scale:0→大, opacity)` `power2.out`、引くとき `power2.in` |
| 全画面フラッシュ | 白オーバーレイ opacity 0→0.8→0 の一瞬 |
| 達成テキスト | **SplitText** で1文字ずつ `stagger`＋`elastic.out`/`back.out(2)`、drop-shadow 発光 |
| 紙吹雪／花びら | **Physics2DPlugin** `{velocity, angle, gravity}`＋回転、`stagger` 時間差、多色 |
| 光線バースト | 線を360°配置し `scaleY:0→1` を `stagger:{from:'center'}` `expo.out`（**DrawSVGPlugin** でも可） |
| 満開モーフ | **MorphSVGPlugin** で canopy path を満開の冠へ変形＋葉色→花色＋金縁発光 |
| 花びら舞い | **MotionPathPlugin** で曲線に沿わせる（フィナーレの仕上げ・任意） |
| キラキラ | 小さな★を `repeat:-1, yoyo` でフィナーレ中だけ常駐 |

### 段階別エスカレーション（lib/animations.ts に段階別タイムラインを用意）
| 段階 | 構成 |
|---|---|
| **2,500** | 中央グロー（木の上半分を包む）→ 引いて「2,500人達成！！」＋紙吹雪 約40枚（2色）＋木の軽いパルス |
| **5,000** | グローが木を**完全に覆う**一瞬の光 → 光線バースト＋紙吹雪 約80枚（多色）＋テキスト大きめ |
| **7,500** | 全画面フラッシュ → 紙吹雪 約120枚＋光線＋木が一段弾むパルス＋テキストに金グラデ発光 |
| **10,000** | フィナーレ（下記） |

> 数値（枚数・しきい値）は実装時に `lib/animations.ts` 内の定数として定義し、マジックナンバーを散らさない。発火しきい値自体は `MILESTONES` を使用。

### 10,000人フィナーレ（timeline 構成）
ネストした `gsap.timeline()` を波状に重ねる（`tl.add(petalsTL, 0.6)` など）。
```
0.0s  全画面ホワイトアウト（フラッシュ）
0.3s  光が引くと木が満開へモーフ（MorphSVG）＋金縁発光、葉色→花色
0.5s  中央から360°の光線バースト（DrawSVG／scaleY stagger）
0.6s  花びら150枚＋紙吹雪を Physics2D で噴き上げ → 重力で落下、（任意）MotionPath で舞う
0.8s  「10,000人達成！」を SplitText で1文字ずつ elastic 登場、金グラデ＋発光＋ゆれ
2〜5s キラキラ常駐（yoyo repeat）で余韻
終盤  紙吹雪・光線・フラッシュはフェード除去。木は満開のまま定着（決定方針2）
```

### 決定7：満開の「定着」は count 由来の静的状態 ＋ フィナーレは一度きり
- `CenterTree` に `bloomed`（= `count >= 10000`）を渡し、**満開の見た目（モーフ後の冠・花色・金縁）はこの prop で静的に表現**する。
- フィナーレの一連アニメ（フラッシュ〜花びら〜テキスト）は**ライブで 10,000 を上向き通過した瞬間に一度だけ**再生（`prevCountRef` 判定、`fullBloomPlayedRef` で二度焚き防止）。
- これにより、**起動時に既に 10,000 超**（リロード・再接続）でも、フィナーレを再生せずに満開の姿だけを表示できる（決定2の初期ロード抑止と整合）。
- MorphSVG はライブ通過時の「葉→満開」変形にのみ使用。既に満開状態でのマウントは満開 path を直接描画（モーフ不要）。

### 決定8：Physics2D の負荷とクリーンアップ
- 達成演出は最大でも計5回（2500/5000/7500＋10000）かつ一過性のため、常時負荷にはならない。
- ただし紙吹雪/花びらは要素数が多い（最大150〜）。**完走後に必ず `remove()`**、生成は演出 timeline 内に限定し、DOM に残さない。
- 8時間稼働での蓄積を避けるため、`page.tsx` アンマウント時に `gsap.globalTimeline` 上の関連 Tween を `killTweensOf` で掃除（#6 申し送り）。要素数は体感を見て上限調整。

---

## 実装ステップ

承認後、以下の順で実装する。

1. **`lib/animations.ts` を新規作成（プラグイン登録＋部品＋段階別タイムライン）**
   - 冒頭で `gsap.registerPlugin(SplitText, Physics2DPlugin, DrawSVGPlugin, MorphSVGPlugin, MotionPathPlugin)`（実際に使うものだけ）。'use client' 配下からのみ呼ぶ。
   - 部品関数：光ベール／全画面フラッシュ／光線バースト／紙吹雪（Physics2D）／達成テキスト（SplitText）。各部品は「対象レイヤー要素を受け取り、生成→演出→`onComplete` で `remove()`」。
   - 公開API：`playMilestone(stage, count, layer, tree): gsap.core.Timeline`（2500/5000/7500 を段階で出し分け）と `playFullBloom(layer, tree): gsap.core.Timeline`（10000）。
   - 枚数・サイズ・色などは本ファイル内の定数で定義（マジックナンバーを散らさない）。型を明示（`any` 不使用）。演出用の固定色（金・花色）はこの層では許容。
2. **`components/vision/Celebration.tsx`（＋scss）を新規作成**
   - 最前面・`pointer-events:none` の空レイヤー。`ref` を親へ公開し、演出DOMはここに生成する。
3. **`components/vision/CenterTree.tsx` に満開バリアントを追加（決定7）**
   - `bloomed: boolean`（= `count >= 10000`）prop を追加。満開時は花色・金縁発光のクラス＋満開 canopy を表示。
   - パルス／モーフ対象（`.tree`/`.canopy`）に安定したクラス/ref を用意し、`lib/animations.ts` から掴めるようにする。MorphSVG 用に「通常 canopy path」と「満開 canopy path」を持つ。
4. **`app/vision/page.tsx` にマイルストーン検知と演出発火を追加**
   - `prevCountRef`、`fullBloomPlayedRef`、`celebrationRef`（Celebration レイヤー）、`treeRef`（CenterTree 要素）を追加。
   - `useEffect`（依存 `[count]`）：初回（`!initialLoadedRef.current`）は `prevCountRef` 初期化のみで演出は出さない。以降 `MILESTONES` の上向き通過を判定し、10000 は `playFullBloom`（`fullBloomPlayedRef` で一度きり）、それ以外は `playMilestone(stage, ...)`。末尾で `prevCountRef.current = count`。
   - `CenterTree` に `bloomed={count >= 10000}` を渡す（満開定着＝静的状態）。`<Celebration ref={celebrationRef} />` を最前面に追加。
5. **`useTransientLeaves.ts` の満杯時退避にフェードを追加**（決定4）。
   - 退避対象を即除去せず、短いフェードアウト後に `removeLeaf` 相当で除去。タイマー競合・スロット解放のタイミングに注意。
6. **（任意）葉出現の質感向上**（決定5）。CSSで十分なら本ステップはスキップ。
7. **メモリリーク対策の確認**：演出で生成した要素・Tween/Timeline が残らないこと。`page.tsx` アンマウント時に `gsap.killTweensOf(...)` ＋ Celebration レイヤー内の残留要素掃除（決定8・#6 申し送り）。
8. **検証**：`npm run build` / `npx tsc --noEmit` / `npm run lint` ＋ `npm run dev` で /vision を確認。
   - 発火は `.claude/rules/testing.md` の一括投入スクリプトまたは `?stage=` を活用。**段階ごとに派手さが上がること・二重発動しないこと・初期ロードで過去マイルストーンが出ないこと・10000後に満開が定着すること**を重点確認。

---

## 考慮が必要な点

### メモリリーク対策（最重要・8時間稼働）
- GSAP の Timeline / Tween / 動的生成 DOM を**完走後に必ず破棄**（`onComplete` で `remove()`）。
- 演出が頻発する箇所は無い（マイルストーンは最大4回・満開は1回）が、葉退避フェードは高頻度になりうるため、フェード用 Tween/タイマーが葉の除去と一緒に確実に片付くこと。
- アンマウント時に未完了の Tween が残らないよう、cleanup で `gsap.killTweensOf(celebrationRef.current)` ＋ Celebration レイヤー内の残留要素を掃除する（#6 プランからの申し送り）。

### 二重発動・初期ロード（決定1・2）
- 同一マイルストーンで2回発火しない（`prevCountRef`）。
- 初期ロード（既存宣言の読み込み）で過去マイルストーンを一斉再生しない（`initialLoadedRef`）。
- `count` は管理画面の非表示化で減少もありうるが、**減少時は発火しない**（上向き通過のみ）。

### 型
- `lib/animations.ts` の関数は引数・返り値に型を明示。`querySelector` の結果 null ガード。`any` 不使用。`types/index.ts` への追加は不要の見込み。

### エラーハンドリング
- 演出は外部I/Oを伴わないが、`container`/`querySelector` 結果の null チェックで早期 return する（要素が無い状態で `appendChild` しない）。

### セキュリティ
- 環境変数のハードコード無し。Firebase操作には触れない（購読は既存のまま）。

### スコープ境界（決定6）
- 木の段階成長・葉のCSSフェード・背景・カウンターは #31 で完了済み。本Issueで作り直さない。

---

## 完了条件（Issue #11 から転記）

- [ ] 2,500・5,000・7,500人達成時に「中央が光って木を覆い隠す→引いて達成テキスト＋紙吹雪」の演出が出ること
- [ ] 中間段階の演出が**段階ごとに派手になる**こと（部品が増えていく／確定方針1）
- [ ] 10,000人達成時に最も豪華なフィナーレ（フラッシュ・満開モーフ・光線・花びら・テキスト・キラキラ）が出ること
- [ ] 10,000達成後、木が**満開のまま定着**すること（確定方針2・決定7）
- [ ] 紙吹雪・花びらが Physics2D の放物線で動くこと（確定方針3）
- [ ] マイルストーンが二重発動しないこと（`prevCountRef` ＋ 10000 は `fullBloomPlayedRef`）
- [ ] 初期ロード（起動時に既に達成済み）で過去マイルストーン演出が一斉発火せず、満開状態は静的に表示されること
- [ ] 同時表示上限超過時、最古の葉が即時消去ではなく短いフェードアウトで消えること（PR #34 レビュー指摘2）
- [ ] 葉の出現がふわっと見えること（CSSで足りなければ GSAP で質感向上）
- [ ] GSAP で生成した要素・Tween/Timeline がアンマウント時／完了時に破棄され、メモリリークしないこと
- [ ] `npm run build` / `npx tsc --noEmit` / `npm run lint` が通ること

---

## 承認コメント欄

> プランを確認したら以下に承認コメントを記入してください。

**承認者**：Haruto Fujii
**承認日**：2026-05-29
**コメント**：承認。確定した達成演出設計（段階的エスカレーション・10,000での満開定着・Physics2D紙吹雪）で実装する。
