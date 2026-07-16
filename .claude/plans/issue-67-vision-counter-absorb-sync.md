# 実装プラン：/vision カウンターを吸収演出に同期させる

## 対象Issue

- **Issue番号**：#67
- **タイトル**：[改善] /vision カウンターが宣言吸収演出より先走る問題を、成長段階と同じ吸収同期方式に統一
- **URL**：https://github.com/hfujii-gif/declaration-tree/issues/67

---

## ステータス

- [x] プラン作成中
- [x] レビュー待ち
- [x] 承認済み → 実装開始可能
- [x] 実装完了
- [x] PR作成済み

---

## 実装対象ファイル

### 新規作成するファイル
なし

### 編集するファイル
```
app/vision/page.tsx
components/vision/useDeclarationStream.ts
```
※ `components/vision/Counter.tsx` は純粋な表示コンポーネント（value を受け取りロールするだけ）のため**変更しない**。親が渡す値を count → displayedCount に差し替えるのみ。

---

## 依存関係の確認

| 依存 | 状態 |
|---|---|
| lib/constants.ts（DECLARATION_* 定数） | ✅ 完了 |
| useDeclarationStream（演出キュー） | ✅ 完了（本PRで拡張） |
| Counter.tsx | ✅ 完了（変更なし） |

---

## 実装ステップ

承認後にこの順番で実装する。

1. `useDeclarationStream.ts`：`declaration` ジョブ型に `onAbsorbed?: (drained: boolean) => void` を追加。
2. `enqueueDeclaration` のシグネチャを `(text: string, onAbsorbed?: (drained: boolean) => void) => void` に拡張し、ジョブへ格納。
3. `drain` の `onComplete` 内、アンマウントガードの直後・次ジョブ算出の前に、declaration ジョブなら `job.onAbsorbed?.(queueRef.current.length === 0)` を呼ぶ（吸収完了時に1件反映、キューが空なら drained=true）。
4. `page.tsx`：`displayedCount` state と `countTargetRef`（最新の目標件数）を追加。
5. onValue：`countTargetRef.current = visible` を更新。初期ロード時は `setDisplayedCount(visible)` で即スナップ（アニメなし）。
6. 減少の整合：`useEffect(() => setDisplayedCount(dc => count < dc ? count : dc), [count])` で、管理画面の非表示化などで目標が下がったら即スナップダウン。
7. onChildAdded：`enqueueDeclaration(d.text, (drained) => setDisplayedCount(dc => drained ? countTargetRef.current : Math.min(dc + 1, countTargetRef.current)))`。
8. `<Counter value={count} />` → `<Counter value={displayedCount} />` に差し替え。
9. build / tsc / lint / ローカル目視で確認。

---

## 考慮が必要な点

### 整合性（reconcile）の担保
- **通常の新着**：吸収完了ごとに +1。ドロップがなければ最終的に count と一致。
- **初期ロード**：displayedCount = count を即スナップ（500件を1件ずつ演出しない）。
- **管理画面で非表示（減少）**：ステップ6で即スナップダウン。減少は「吸収」の対象ではないため演出せず即反映。
- **キュー上限超過でドロップ（極端なバースト）**：ステップ3の `drained` フラグで、キューが空になった吸収完了時に `countTargetRef.current` へスナップ。取りこぼしても最終値は必ず一致。
- **成長段階・マイルストーン判定は従来どおり `count`（目標値）基準**を維持（表示だけ displayedCount に切替）。

### メモリリーク対策
- 新規タイマーは追加しない（reconcile はキュー完了イベントと state 効果で行う）。
- `onAbsorbed` はフックのアンマウントガード（`if (unmountedRef.current) return`）の後で呼ぶため、アンマウント後の setState を起こさない。
- Counter 側の Tween kill・キュー破棄は既存のまま維持。

### 型の定義
- `VisionJob` の declaration バリアントに `onAbsorbed?` を追加。`DeclarationStream.enqueueDeclaration` の型も更新。`any` は使わない。

### その他
- 吸収完了（timeline onComplete）で +1 するため、カウンターは「木へ吸い込まれ切った瞬間」に増える。バースト中は一瞬だけ実数に遅れるが、既存のバックログ短縮で追従し、drained スナップで最終一致する。

---

## 実装方針

木の成長段階（`displayedGrowth`）が既に採用している「目標値（count）と表示値（displayed）を分離し、吸収完了をトリガーにキュー経由で表示を進める」方式を、カウンターにも横展開する。表示値 `displayedCount` を吸収演出に同期させ、初期ロード・減少・ドロップは目標値へのスナップで整合を保証する。Counter コンポーネント自体は表示専用のため無改修。

---

## 完了条件

- [ ] 連続送信でカウンターが吸収演出に同期して1件ずつ増える
- [ ] 初期ロード・管理画面非表示・キュー上限超過でも最終的な表示件数が isVisible=true の実数と一致する
- [ ] メモリリーク対策（タイマー/タイムライン破棄）を維持
- [ ] npm run build / npx tsc --noEmit / npm run lint が通ること

---

## 承認コメント欄

**承認者**：
**承認日**：
**コメント**：
