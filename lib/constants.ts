// 入力可能な最大文字数（/input の文字数制限・/api/declare のバリデーションで使用）
export const MAX_CHARS = 50

// 送信完了オーバーレイから入力フォームに戻るまでの待機時間（ミリ秒）
export const RESET_DELAY_MS = 3000

// 大型ビジョンでの演出を発火させる累計宣言数のしきい値
// as const により readonly タプル化し、後続実装での誤改変を防ぐ
export const MILESTONES = [2500, 5000, 7500, 10000] as const

// 管理画面で参照する環境変数名（process.env[ADMIN_PASSWORD_ENV] で照合）
export const ADMIN_PASSWORD_ENV = 'ADMIN_PASSWORD'

// /vision 宣言吸収演出（#44）。新着宣言ごとに「中央に大きく表示→マトリックス分解→木へ吸収→木が発光」を再生する。

// 新着を検出してから中央テキストを出すまでの“間”（ミリ秒）。
// 参加者がiPadから大型ビジョンへ目線を上げる時間を確保し、登場を見逃しにくくする。
export const DECLARATION_START_DELAY_MS = 900

// 中央に表示した宣言テキストを読ませる時間（ミリ秒）。この後に分解〜吸収へ移る。
export const DECLARATION_TEXT_HOLD_MS = 1600

// マトリックス分解〜木への吸収にかける時間（ミリ秒）。ゆっくり吸い込まれる余韻を持たせる。
export const DECLARATION_ABSORB_MS = 2800

// 連続送信時、1件の演出が終わってから次を表示するまでの“間”（ミリ秒）。
// 立て続けに流れず、1件ずつ落ち着いて見えるようにする。
export const DECLARATION_GAP_MS = 1500

// 同時バースト時（iPad 25台同時送信など）に貯められる演出キューの上限。
// スポットライトは同時に1つだけ再生し、超過分は捨てる（無音で打ち切らず console.warn で可視化する）。
export const DECLARATION_MAX_QUEUE = 12
