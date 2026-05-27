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
