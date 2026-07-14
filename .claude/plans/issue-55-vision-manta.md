# 実装プラン：/vision 空飛ぶマンタ（エイ）装飾を追加

---

## 対象Issue

- **Issue番号**：#55 の装飾演出シリーズの追加（クジラに並ぶ「魚の装飾」）
- **タイトル**：/vision 中央演出にレア装飾「マンタ（エイ）」を追加
- **URL**：https://github.com/hfujii-gif/declaration-tree/pull/55 の延長

---

## ステータス

- [x] プラン作成中
- [x] レビュー待ち
- [x] 承認済み → 実装開始可能（提案内容をユーザー承認）
- [ ] 実装完了
- [ ] PR作成済み

---

## 実装対象ファイル

### 新規作成するファイル
```
components/vision/Manta.tsx
components/vision/Manta.module.scss
```

### 編集するファイル
```
lib/constants.ts        … DECORATIONS に { key: 'manta', label: 'マンタ' } を1行追加
app/vision/page.tsx     … import 1行 ＋ {decorations.manta && <Manta />} 1行
```
※ 管理画面（components/admin/DecorationManager.tsx）は DECORATIONS を map しているため変更不要。
   型（DecorationKey / DecorationSettings）・DEFAULT_DECORATIONS・normalizeDecorations も
   DECORATIONS から自動導出されるため変更不要。

---

## 依存関係の確認

| 依存するファイル/Issue | 状態 |
|---|---|
| lib/constants.ts（MATRIX_GLYPHS / MATRIX_FONT_STACK / DECORATIONS） | ✅ 完了 |
| components/vision/useRareVisibility.ts | ✅ 完了 |
| 既存の Whale.tsx（実装パターンの流用元） | ✅ 完了 |

---

## 実装ステップ

1. `lib/constants.ts` の DECORATIONS 配列に `{ key: 'manta', label: 'マンタ' }` を追加する。
2. `components/vision/Manta.module.scss` を作成する（クジラ同様 z-index:1・弧を描く横断アニメ。マンタは水平ゆったりめ）。
3. `components/vision/Manta.tsx` を作成する（Canvas＋エコ文字グリフ＋useRareVisibility）。
   - 俯瞰シルエット（菱形の体＋左右の三角の翼＋頭鰭2本＋細い尾＋口）を静止セルとして生成。
   - 動かない体（背骨付近）はオフスクリーンに1枚キャッシュ。
   - 翼セルは背骨(x=CX)からの相対で持ち、毎フレーム上下にしならせて羽ばたかせる。
     先端ほど振れ幅を大きく、付け根→先端で位相を遅らせて波打たせる。
   - 尾はゆるく横揺れさせる。
   - prefers-reduced-motion 時は羽ばたかせず1枚だけ描く。
4. `app/vision/page.tsx` に import と `{decorations.manta && <Manta />}` を追加する。
5. `npm run build` / `npx tsc --noEmit` / `npm run lint` を通す。

---

## 考慮が必要な点

### メモリリーク対策（最重要・8時間以上稼働）
- 表示中だけ requestAnimationFrame を回す（useRareVisibility が false の間は回さない）。
- クリーンアップで cancelAnimationFrame と resize リスナー解除を必ず行う（Whale を踏襲）。

### 型
- `any` 禁止。セル種別は string literal union 型で定義する（Whale の StaticCell/FlukeCell に倣う）。
- 新しい型は Manta.tsx 内に閉じる（types/index.ts への追加は不要）。

### 出現サイクル
- useRareVisibility の hiddenMin/Max をクジラとずらし、同時に複数の大型生物が出にくいようにする。

### その他
- 色相はクジラ（HUE 205）と差をつけて濃紺寄り（HUE 215前後）。
- グリフ・フォントは既存の MATRIX_GLYPHS / MATRIX_FONT_STACK を使う（マジック文字列を増やさない）。

---

## 実装方針

既存の `Whale.tsx` を設計の土台にする。違いは「横向きの尾びれ回転」ではなく
「俯瞰で左右2枚の翼を上下にしならせる羽ばたき」である点。

翼の羽ばたきは2D俯瞰のまま、各翼セルを
`yOffset = -AMP * sin(t - k*|dx|) * (|dx|/WINGSPAN_HALF)`
で上方向にしならせて表現する（dx = x - CX、背骨からの横距離）。
左右対称・同位相にすることで蝶のように両翼が揃って羽ばたき、優雅に見せる。
体（背骨付近の動かない部分）はオフスクリーンキャッシュ、毎フレームは翼と尾だけ再描画して
fillText 総数を抑える（Whale と同じ負荷対策）。

横断は CSS キーフレームで弧を描く（Whale.module.scss を流用し、傾き・高低をマンタ向けに微調整）。

---

## 完了条件

- [ ] マンタが /vision にレアに出現し、弧を描いて横断する。
- [ ] 翼が優雅に羽ばたく（先端ほど大きく、波打つ）。
- [ ] 管理画面（/admin）の装飾一覧に「マンタ」のON/OFFスイッチが出る。
- [ ] OFFにすると /vision からマンタが消える。
- [ ] 表示していない間は rAF を回さない／アンマウントでリスナー・rAF を解除する（メモリリークなし）。
- [ ] `any` を使っていない。
- [ ] `npm run build` が通る。
- [ ] `npx tsc --noEmit` が通る。
- [ ] `npm run lint` が通る。

---

## 承認コメント欄

**承認者**：ユーザー（会話内で提案内容を承認）
**承認日**：2026-06-30
**コメント**：提案どおりの方針でOK。
