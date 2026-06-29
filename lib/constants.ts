// 入力可能な最大文字数（/input の文字数制限・/api/declare のバリデーションで使用）
export const MAX_CHARS = 50

// 送信完了オーバーレイから入力フォームに戻るまでの待機時間（ミリ秒）
export const RESET_DELAY_MS = 3000

// 大型ビジョンでの演出を発火させる累計宣言数のしきい値
// as const により readonly タプル化し、後続実装での誤改変を防ぐ
export const MILESTONES = [2500, 5000, 7500, 10000] as const

// 管理画面で参照する環境変数名（process.env[ADMIN_PASSWORD_ENV] で照合）
export const ADMIN_PASSWORD_ENV = 'ADMIN_PASSWORD'

// /vision のマトリックス演出で流す文字（#49 タスクB）。
// 環境・自然・エコにまつわる言葉を素材に、その文字（ひらがな・漢字）を集合として使う。
// 樹冠レイン・宣言テキストの分解・マイルストーンのグリフ紙吹雪で共通利用する。
// ※ 語の最終選定はクライアント確認のうえ調整可。ここを変えれば全演出の文字が変わる。
// 語そのものは流れ星アニメ（#55 ShootingStars）でも利用するため export する。
export const ECO_WORDS = [
  // 環境・サステナビリティの語彙を中心に
  '環境', '地球', '自然', '未来', '命', '資源', '生態系', '共生',
  '循環', '再生', '省エネ', '節電', '節水', '節約', '脱炭素', '温暖化',
  '削減', '排出', '保全', '緑化', '植林', '森林', '再エネ', 'エネルギー',
  'リサイクル', 'リユース', 'リデュース', 'エコ', 'クリーン', 'サステナブル',
  '太陽光', '風力', '水素', '電気', 'ごみ', '分別', 'もったいない',
  '緑', '森', '水', '風', '光', '芽', '種', '葉',
  'めぐみ', 'いのち', 'つなぐ', 'まもる', 'そだてる', 'ささえる',
]
// 語から重複を除いたユニークな文字集合（モジュール読込時に一度だけ算出）。
export const MATRIX_GLYPHS = Array.from(new Set(ECO_WORDS.join(''))).join('')

// /vision のマトリックス文字に使うフォントスタック（全角の日本語等幅を含める）。
// 会場実機のブラウザで漢字・ひらがなが描画されるよう、日本語フォントをフォールバックに含める。
export const MATRIX_FONT_STACK =
  "'Courier New', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', 'Noto Sans JP', 'Meiryo', monospace"

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

// バックログ（未処理キュー）がこの件数を超えたら、ドレインを早めるため演出を短縮モードにする。
export const DECLARATION_BACKLOG_THRESHOLD = 4

// バックログ短縮モードでの各タイミング（ミリ秒）。通常時より短くしてキューの詰まりを解消する。
export const DECLARATION_BACKLOG_LEAD_MS = 300
export const DECLARATION_BACKLOG_HOLD_MS = 800
export const DECLARATION_BACKLOG_ABSORB_MS = 1800
// バックログ短縮モードでの連続表示の“間”（ミリ秒）。通常の DECLARATION_GAP_MS より短くする。
export const DECLARATION_BACKLOG_GAP_MS = 500

// マイルストーン演出（#49 タスクA）を、それを起こした宣言の吸収完了の直後に詰めて流すときの短い“間”（ミリ秒）。
// 宣言→マイルストーン、マイルストーン→宣言の境目で使い、因果を密に見せる。
export const MILESTONE_FOLLOW_GAP_MS = 250

// /vision の装飾演出（#55）。管理画面から個別に ON/OFF できる。
// Firebase の settings/decorations に真偽値で保存する。キーが未設定のときは ON 扱い（デフォルト ON）。
export const DECORATIONS = [
  { key: 'shootingStars', label: '流れ星' },
  { key: 'saturn', label: '土星' },
  { key: 'ufo', label: 'UFO' },
  { key: 'comet', label: '彗星' },
  { key: 'rocket', label: 'ロケット' },
  { key: 'whale', label: 'クジラ' },
] as const

export type DecorationKey = (typeof DECORATIONS)[number]['key']
export type DecorationSettings = Record<DecorationKey, boolean>

// 全 ON のデフォルト設定（未設定・読み込み失敗時のフォールバック）。
export const DEFAULT_DECORATIONS: DecorationSettings = DECORATIONS.reduce(
  (acc, d) => ({ ...acc, [d.key]: true }),
  {} as DecorationSettings
)

// Firebase の生値を DecorationSettings に正規化する。boolean が入っているキーだけ反映し、
// それ以外（未設定・型不一致）はデフォルト ON のままにする。
export function normalizeDecorations(value: unknown): DecorationSettings {
  const result: DecorationSettings = { ...DEFAULT_DECORATIONS }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    for (const d of DECORATIONS) {
      if (typeof obj[d.key] === 'boolean') result[d.key] = obj[d.key] as boolean
    }
  }
  return result
}
