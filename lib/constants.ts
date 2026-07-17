// 入力可能な最大文字数（/input の文字数制限・/api/declare のバリデーションで使用）
export const MAX_CHARS = 50

// 送信完了オーバーレイから入力フォームに戻るまでの待機時間（ミリ秒）
export const RESET_DELAY_MS = 3000

// 大型ビジョンでの演出を発火させる累計宣言数のしきい値
// as const により readonly タプル化し、後続実装での誤改変を防ぐ
// 達成演出は10,000（満開フィナーレ）のみ。中間マイルストーン演出（2,500 / 5,000 / 7,500）は廃止（#57）。
export const MILESTONES = [10000] as const

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

// 同時バースト時（iPad 10台同時送信など）に貯められる演出キューの上限。
// スポットライトは同時に1つだけ再生し、超過分は捨てる（無音で打ち切らず console.warn で可視化する）。
// 実質「送信から演出までの最大遅延」を決める値。バックログ短縮モードは1件あたり約3.4秒
// （LEAD300+HOLD800+ABSORB1800+GAP500）なので、満杯時の最後の1件は 上限×3.4秒 後に演出される。
// 40＝最大約136秒。ドロップ（二度と表示されない）より遅延（遅れても必ず表示される）を優先して #69 で 12→40 とした。
export const DECLARATION_MAX_QUEUE = 40

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
  { key: 'manta', label: 'マンタ' },
  { key: 'jellyfish', label: 'クラゲ' },
  { key: 'seaTurtle', label: 'ウミガメ' },
  { key: 'dolphin', label: 'イルカ' },
  { key: 'seahorse', label: 'タツノオトシゴ' },
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

// /vision 中央の木の成長段階（#57）。累計 isVisible=true 件数で 小(0)/中(1)/大(2) を決める。
// 旧仕様（MILESTONES ごとに樹冠を scale 拡大）を廃止し、幹サイズ・樹冠のモリモリ（膨らみ量）・葉の色を段階変化させる。
export type GrowthLevel = 0 | 1 | 2
// 小=0〜500 / 中=501〜1,000 / 大=1,001〜（10,000以降も大のまま）。
export const GROWTH_THRESHOLDS = [500, 1000] as const

export function computeGrowthLevel(count: number): GrowthLevel {
  if (count > GROWTH_THRESHOLDS[1]) return 2
  if (count > GROWTH_THRESHOLDS[0]) return 1
  return 0
}

// 段階別の木全体スケール係数（index=GrowthLevel）。#56 の base 係数(1.9)・--screen-scale に掛ける。
// 小ほど幹＋樹冠が小さい。大=1.0（現状サイズ）。
// 3要素固定のタプル型にし、要素数と GrowthLevel(0|1|2) のズレをコンパイル時に検知する。
export const GROWTH_TREE_SCALE: readonly [number, number, number] = [0.62, 0.82, 1]

// 段階別の葉の色相レンジ（index=GrowthLevel）。start=左端の色相、span=左→右で広がる幅。
// 小=緑のみ（緑付近に集約）→ 中=一部レインボー → 大=全色相（0→300＝現状の虹）。
type HueRange = { start: number; span: number }
export const GROWTH_HUE: readonly [HueRange, HueRange, HueRange] = [
  { start: 110, span: 25 },
  { start: 80, span: 160 },
  { start: 0, span: 300 },
]

// /vision 中央の木の樹冠（極小文字の葉）の重なり密度（#60）。中心部で1格子点に重ねる文字の最大枚数。
// 管理画面から 1〜5 で変更し、Firebase の settings/canopyLayers に単一数値で保存する。
export const CANOPY_LAYERS_MIN = 1
export const CANOPY_LAYERS_MAX = 5
export const CANOPY_LAYERS_DEFAULT = 3

// Firebase の生値を 1〜5 の整数に正規化する。数値でない・範囲外・未設定はデフォルト（3）にフォールバックする。
export function normalizeCanopyLayers(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return CANOPY_LAYERS_DEFAULT
  const rounded = Math.round(n)
  if (rounded < CANOPY_LAYERS_MIN || rounded > CANOPY_LAYERS_MAX) return CANOPY_LAYERS_DEFAULT
  return rounded
}

// /vision 下部カウンターの機械式ロール表示（#58）。最大 10,000（5桁）に合わせてゼロ埋めする桁数。
export const COUNTER_DIGITS = 5
// 1桁がロールしきる時間（ミリ秒）。オドメーターの回転スピード。
export const COUNTER_ROLL_MS = 700
// 桁ごとにロール開始をずらす時間（ミリ秒）。下位桁から上位桁へ少し遅らせて機械式の連鎖感を出す。
export const COUNTER_ROLL_STAGGER_MS = 60

// /vision → /admin モニタリング（#70）。/vision が自分の状態を Firebase に書き込む間隔（ミリ秒）。
export const VISION_TELEMETRY_INTERVAL_MS = 2000
// 管理画面がオフライン判定するまでの「更新が来ない時間」（ミリ秒）。書き込み間隔の数倍に取る。
export const VISION_OFFLINE_THRESHOLD_MS = 8000
