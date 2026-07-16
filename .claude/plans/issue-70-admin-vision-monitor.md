# 実装プラン：管理画面に /vision モニタリング画面を追加（②）

## 対象Issue
- **Issue番号**：#70
- **タイトル**：[改善] 管理画面に /vision モニタリング画面を追加（キュー滞留・スループット・接続状況）
- **URL**：https://github.com/hfujii-gif/declaration-tree/issues/70

## ステータス
- [x] プラン作成中
- [x] レビュー待ち
- [x] 承認済み → 実装開始可能
- [x] 実装完了（ヘッドレスで end-to-end 検証済み：テレメトリ書き込み成功・管理画面表示OK）
- [x] PR作成済み

## 実装対象ファイル
### 新規作成
```
components/admin/VisionMonitor.tsx
components/admin/VisionMonitor.module.scss
```
### 編集
```
lib/constants.ts                       # 更新間隔・オフライン閾値の定数
types/index.ts                         # VisionStatus 型
components/vision/useDeclarationStream.ts   # 統計(getStats)を公開
app/vision/page.tsx                    # テレメトリ定期書き込み
app/admin/page.tsx                     # モニタリングタブ配線
```

## 依存関係の確認
| 依存 | 状態 |
|---|---|
| Firebase `/settings/*` への書き込み | ✅ 既存機能(decorations/canopyLayers)で動作中＝ルール変更不要の見込み（**実装後にstgで書き込み成否を要確認**） |
| lib/firebase.ts（set/onValue/ref） | ✅ 完了 |

## データ設計
テレメトリ書き込み先：**`/settings/visionStatus`**（既存の設定listenerはサブノード単位なので干渉なし）
```ts
type VisionStatus = {
  updatedAt: number          // Date.now()（オフライン判定は「更新の有無」で行いクロック差を回避）
  queueLength: number        // 現在の未処理キュー数
  receivedTotal: number      // onChildAdded 受信累計
  animatedTotal: number      // 吸収完了累計
  droppedTotal: number       // ドロップ累計（目標は常時0）
  displayedCount: number     // 表示カウンター(#67)
  targetCount: number        // 実 isVisible 件数
  lag: number                // targetCount - displayedCount
  throughputPerMin: number   // ローリング演出スループット(件/分)
  growthLevel: number
}
```

## 実装ステップ
1. `lib/constants.ts`：`VISION_TELEMETRY_INTERVAL_MS = 2000` / `VISION_OFFLINE_THRESHOLD_MS = 8000` を追加。
2. `types/index.ts`：`VisionStatus` 型を追加。
3. `useDeclarationStream.ts`：`animatedTotalRef` / `droppedTotalRef` を持ち、onComplete(declaration)で animated++、ドロップ時に dropped++。安定した `getStats()`（{queueLength, animatedTotal, droppedTotal} を返す）を戻り値に追加。
4. `app/vision/page.tsx`：`receivedTotalRef` で onChildAdded 受信数を数える。`VISION_TELEMETRY_INTERVAL_MS` 間隔の setInterval で `set(ref(db,'settings/visionStatus'), status)`。throughput は前回 animatedTotal との差分/経過分から算出。try-catch＋アンマウントで clearInterval。
5. `components/admin/VisionMonitor.tsx`：`/settings/visionStatus` を onValue 購読。updatedAt が変化した admin 側時刻を記録し、`VISION_OFFLINE_THRESHOLD_MS` 更新が無ければ「未接続」。タイルで各指標を表示（dropped>0 は赤・lag大は警告色）。onValue解除＋判定タイマー解除。
6. `app/admin/page.tsx`：タブ union に `'monitor'` 追加、ナビ「モニタリング」、見出し、パネルに `<VisionMonitor/>`。
7. build / tsc / lint / ローカル動作確認。

## 考慮が必要な点
### エラーハンドリング
- テレメトリ書き込み（set）は try-catch。失敗しても /vision 本体の演出は止めない（console.error のみ）。
- admin 側 onValue にエラーコールバックを付け、読み込み失敗をUI表示。

### メモリリーク対策
- /vision：テレメトリ setInterval をアンマウントで clearInterval。
- admin：onValue 解除＋オフライン判定用タイマー解除。

### 型
- `VisionStatus` を types/index.ts に定義し、書き込み/読み込み双方で使用。`any` 不使用。

### その他
- 複数 /vision 同時起動は同一ノードを上書きし合う（本番はビジョン1台で可。将来 clientId 対応は別途）。
- Firebase ルール：`/settings/visionStatus` 書き込みが拒否される場合のみ、コンソールでルール追加が必要（既存 /settings 書き込みが通っているため不要の見込み。stgで最終確認）。

## 完了条件
- [ ] /vision が /settings/visionStatus に定期書き込み
- [ ] /admin モニタリングタブでキュー滞留・受信/演出済み/ドロップ・遅延・スループット・接続状況・成長段階が見える
- [ ] updatedAt 停止でオフライン判定
- [ ] メモリリーク対策（interval/listener/timer 解除）
- [ ] npm run build / npx tsc --noEmit / npm run lint 通過

## 承認コメント欄
**承認者**：
**承認日**：
**コメント**：
