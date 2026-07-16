// Firebase Realtime Database に格納される宣言データ
// id は push() で生成されるキー
export type Declaration = {
  id: string
  text: string
  timestamp: number
  isVisible: boolean
}

// /api/declare のリクエストボディ
export type DeclareRequestBody = {
  text: string
}

// /api/declare のレスポンスボディ
// success: false 時のみエラー文言を message に格納する
export type DeclareResponse = {
  success: boolean
  message?: string
}

// /vision の稼働状況テレメトリ（#70）。/vision が settings/visionStatus に定期書き込みし、/admin が購読して表示する。
export type VisionStatus = {
  updatedAt: number // 書き込み時刻（Date.now()）。オフライン判定は「値が進んでいるか」で行う。
  queueLength: number // 現在の未処理キュー数
  receivedTotal: number // onChildAdded 受信累計
  animatedTotal: number // 吸収完了累計
  droppedTotal: number // ドロップ累計（#69 対応後は常時0が目標）
  displayedCount: number // 表示カウンター（#67）
  targetCount: number // 実 isVisible 件数
  lag: number // targetCount - displayedCount
  throughputPerMin: number // ローリング演出スループット（件/分）
  growthLevel: number // 木の成長段階（0/1/2）
}
