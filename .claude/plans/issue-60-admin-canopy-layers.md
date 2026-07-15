# 実装プラン：管理画面から葉の重なり（CORE_LAYERS 1〜5）を変更できるようにする

---

## 対象Issue

- **Issue番号**：#60
- **タイトル**：[改善] 管理画面から葉の重なり（CORE_LAYERS 1〜5）を変更できるようにする
- **URL**：https://github.com/hfujii-gif/declaration-tree/issues/60

---

## ステータス

- [x] プラン作成中
- [x] レビュー待ち
- [x] 承認済み → 実装開始可能
- [x] 実装完了
- [x] PR作成済み

---

## 概要

/vision 中央の木の樹冠（極小文字の葉）の重なり密度 `CORE_LAYERS`（現状 `components/vision/CenterTree.tsx` の
定数 = 3）を、管理画面から 1〜5 で変更・保存できるようにする。Firebase `settings/canopyLayers` に保存し、
/vision が購読して即時反映する。既存の `settings/decorations`（#55）と同じ構成を踏襲する。

---

## 実装対象ファイル

### 新規作成するファイル
```
components/vision/useCanopyLayers.ts        … settings/canopyLayers を購読するフック
components/admin/CanopyLayersManager.tsx    … 1〜5 を選ぶ管理UI（書き込み）
components/admin/CanopyLayersManager.module.scss … 上記のスタイル（DecorationManager 準拠）
```

### 編集するファイル
```
lib/constants.ts              … 既定値・範囲・正規化ヘルパーを追加
components/vision/CenterTree.tsx … props に layers を追加し CORE_LAYERS の代わりに使用、effect 依存に追加
app/vision/page.tsx           … useCanopyLayers() で購読し CenterTree に渡す
app/admin/page.tsx            … 「演出 ON/OFF」タブに CanopyLayersManager を追加
```

---

## 依存関係の確認

| 依存 | 状態 |
|---|---|
| `settings/` への Firebase 書き込み権限 | ⚠️ **未確認（本Issューの前提・要検証）** |
| 既存 `settings/decorations`（#55）のパターン | ✅ 流用元として完了 |
| lib/firebase.ts（`set`/`update`/`onValue`） | ✅ 完了 |

> **最重要の前提**：`settings/` 配下への書き込みは過去に権限拒否になった経緯がある。実装前に
> 「/admin の装飾 ON/OFF（settings/decorations）が実機Firebaseで実際に保存できるか」を確認する。
> 保存できるなら本Issueの `settings/canopyLayers` も同様に通る。拒否される場合は Firebase コンソールで
> ルール修正が必要（コードだけでは解決できない）。→ **明日のリハーサル、または dev サーバーで装飾トグルの
> 保存可否を確認してから着手するのが安全**。

---

## 実装ステップ

1. `lib/constants.ts` に定数とヘルパーを追加する。
   - `CANOPY_LAYERS_DEFAULT = 3` / `CANOPY_LAYERS_MIN = 1` / `CANOPY_LAYERS_MAX = 5`
   - `normalizeCanopyLayers(value: unknown): number`（数値化＋1〜5にクランプ、不正値は既定 3）
2. `components/vision/useCanopyLayers.ts` を作成する（`useDecorationSettings` を踏襲）。
   - `onValue(ref(db, 'settings/canopyLayers'))` を購読、`normalizeCanopyLayers` で正規化、失敗時は既定3。
   - クリーンアップで `unsubscribe()`。
3. `components/vision/CenterTree.tsx` を変更する。
   - props に `layers?: number`（既定は現行定数 `CORE_LAYERS`）を追加。
   - 葉セル生成（149行目）の `CORE_LAYERS` を props の `layers` に置き換える。
   - レイン描画 useEffect の依存配列 `[]` に `layers` を追加する（値変更で cleanup→葉セル再生成）。
     ※ 既存 cleanup（`stop()` で rAF 解除・リスナー解除）があるため再生成でリークしない。
   - `CORE_LAYERS` 定数は「既定値」として残す（props 未指定時のフォールバック）。
4. `app/vision/page.tsx` で `const canopyLayers = useCanopyLayers()` を購読し、
   `<CenterTree layers={canopyLayers} ... />` として渡す。
5. `components/admin/CanopyLayersManager.tsx`（＋scss）を作成する。
   - `onValue` で現在値を購読して選択状態に反映（`DecorationManager` と同型）。
   - 1〜5 のボタン／セグメントUIで選択、`set(ref(db,'settings/canopyLayers'), value)` を try-catch で保存。
   - 失敗時はエラーメッセージ表示。楽観的更新（onValue で確定上書き）。
6. `app/admin/page.tsx` の「演出 ON/OFF」タブ（`tab === 'decorations'`）内に
   `<CanopyLayersManager />` を `<DecorationManager />` と並べて描画する。
7. `npm run build` / `npx tsc --noEmit` / `npm run lint` を通す。

---

## 考慮が必要な点

### エラーハンドリング
- Firebase 書き込み（`set`）・購読（`onValue` の error コールバック）に try-catch／エラー表示を実装する。
- 読み込み失敗・未設定・不正値は既定 3 にフォールバックし、樹冠が消えないようにする。

### メモリリーク対策（8時間以上稼働）
- `useCanopyLayers` の `onValue` はクリーンアップで解除する。
- `CenterTree` の依存に `layers` を追加しても、既存の cleanup（rAF・リスナー解除）で再生成時に後始末される
  ことを確認する。値変更は管理操作時のみで頻度は低い。

### 型
- `any` 禁止。`normalizeCanopyLayers(value: unknown): number` で外部入力を安全に数値化する。
- 型追加は `lib/constants.ts` 内に閉じる（`types/index.ts` への追加は不要）。

### その他
- **#57（成長段階で葉密度を変える）との関係**：#57 実装時に「手動値（本Issue）を基準に段階で増減させる」等の
  合成方針を決める。本Issueでは `layers` を樹冠生成の基準値として扱う設計にしておき、#57 で段階係数を掛ける
  余地を残す。
- マジックナンバー方針：1／5／3 は `lib/constants.ts` に定数化する（マジックナンバー直書きを避ける）。
- Firebase パスは単一数値 `settings/canopyLayers`（例：`3`）。オブジェクトにはしない。

---

## 実装方針

既存の `settings/decorations`（#55）と完全に同じ「Firebase settings 購読フック＋管理UI＋/vision反映」の
三点構成を踏襲する。相違点は「真偽値の集合」ではなく「1〜5 の単一数値」である点だけ。樹冠の葉は初期化時に
1回生成しているため、`layers` を描画 useEffect の依存に加えて値変更時に葉セルを作り直す（毎フレームではない）。

---

## 完了条件

- [ ] /admin で葉の重なりを 1〜5 で選べ、Firebase（settings/canopyLayers）に保存される
- [ ] /vision に即時反映される（値変更で樹冠が作り直される）
- [ ] 未設定・失敗時は 3 にフォールバックし表示が壊れない
- [ ] Firebase書き込みに try-catch・エラー通知がある
- [ ] 長時間稼働のメモリリーク対策（リスナー解除・再生成時の後始末）が維持されている
- [ ] `any` を使っていない
- [ ] `npm run build` / `npx tsc --noEmit` / `npm run lint` が通る

---

## 承認コメント欄

**承認者**：ユーザー（会話内で承認）
**承認日**：2026-07-16
**コメント**：settings 書き込みは実機で保持を確認済み（装飾ON/OFFがリロード後も保持）。管理UIは「演出 ON/OFF」タブ同居でOK。
