// 入力可能な最大文字数（/input の文字数制限・/api/declare のバリデーションで使用）
export const MAX_CHARS = 50

// 送信完了オーバーレイから入力フォームに戻るまでの待機時間（ミリ秒）
export const RESET_DELAY_MS = 3000

// 大型ビジョンでの演出を発火させる累計宣言数のしきい値
// as const により readonly タプル化し、後続実装での誤改変を防ぐ
export const MILESTONES = [2500, 5000, 7500, 10000] as const

// 管理画面で参照する環境変数名（process.env[ADMIN_PASSWORD_ENV] で照合）
export const ADMIN_PASSWORD_ENV = 'ADMIN_PASSWORD'

// /vision のテキスト葉が表示されてから消えるまでの時間（ミリ秒）。累積させず一定時間で消す。
export const LEAF_DISPLAY_MS = 30000

// /vision で同時に表示できるテキスト葉の最大数（＝配置スロット数）。
// 50文字でも全文が読める大きさの葉を、画面外にはみ出さず重ならず並べるため、3列×3行=9枚とする。
// この数を超えて宣言が届いた場合は最古の葉を消して新しい葉を表示する（重なり回避）。
export const MAX_VISIBLE_LEAVES = 9

// 同時表示が上限に達した状態で新着が来たとき、最古の葉を即時消去せず短くフェードアウトさせる時間（ミリ秒）。
// ※ components/vision/LeafLayer.module.scss の .exiting アニメーション時間と一致させること。
export const LEAF_EVICT_FADE_MS = 400
