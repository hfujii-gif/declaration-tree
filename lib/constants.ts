// 入力可能な最大文字数（/input の文字数制限・/api/declare のバリデーションで使用）
export const MAX_CHARS = 50

// 送信完了オーバーレイから入力フォームに戻るまでの待機時間（ミリ秒）
export const RESET_DELAY_MS = 3000

// 大型ビジョンでの演出を発火させる累計宣言数のしきい値
// as const により readonly タプル化し、後続実装での誤改変を防ぐ
export const MILESTONES = [2500, 5000, 7500, 10000] as const

// 管理画面で参照する環境変数名（process.env[ADMIN_PASSWORD_ENV] で照合）
export const ADMIN_PASSWORD_ENV = 'ADMIN_PASSWORD'
