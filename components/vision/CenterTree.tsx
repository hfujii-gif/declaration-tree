'use client'

import { forwardRef, useEffect, useRef } from 'react'
import styles from './CenterTree.module.scss'

type CenterTreeProps = {
  // 成長段階（0〜4）。累計がマイルストーンを超えるごとに上がる。
  stage: number
  // 10,000人達成後の満開状態。true で樹冠レインの発光が最大化する（#11/#45）。
  // 満開は count>=10000 由来の静的状態。フィナーレ演出は lib/animations.ts の playFullBloom が担当する。
  bloomed?: boolean
}

// 樹冠に流す文字（マトリックス風＝英数字のみ）。
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

// 樹冠 canvas の論理サイズ（CSS px）。SVGの木（360×468）の樹冠位置に重ねる。
// stage 拡大・満開発光は CSS（.canopy）が担う。
const CANOPY_W = 500
const CANOPY_H = 380
const FONT_SIZE = 11 // 文字サイズ＝列の横間隔（小さくして列を密に）
const LINE_HEIGHT = 11 // 列内の文字の縦間隔
const TRAIL = 22 // 1列あたりの軌跡（ヘッド＋尾）の長さ。長くして樹冠を埋める

// 葉の塊（ふくらみ）。複数の円を重ねて、横に大きく広がるモリモリの緑の樹冠を作る（canvas座標。中心 x=250）。
// 緑のグラデーションはこのふくらみにのみ描く。
const CLUMPS = [
  { x: 250, y: 135, r: 148 }, // 中央の大きな塊
  { x: 135, y: 170, r: 115 }, // 左
  { x: 365, y: 170, r: 115 }, // 右
  { x: 68, y: 190, r: 82 }, // 左外
  { x: 432, y: 190, r: 82 }, // 右外
  { x: 250, y: 200, r: 112 }, // 下中央（枝に被さる）
  { x: 175, y: 96, r: 96 }, // 上・左
  { x: 325, y: 96, r: 96 }, // 上・右
  { x: 250, y: 68, r: 84 }, // 頂点
]

// 樹冠の下から垂れ落ちるコードの“雫”（しだれ柳のようなドリップ）。各帯にだけレインを通して、
// 葉の下に緑のコードが滴る表現を作る（緑の塊は描かず、レインのみ通す）。
const DRIPS = [
  { x: 92, top: 220, bottom: 298, hw: 7 },
  { x: 120, top: 235, bottom: 320, hw: 9 },
  { x: 175, top: 252, bottom: 342, hw: 8 },
  { x: 215, top: 260, bottom: 352, hw: 9 },
  { x: 250, top: 265, bottom: 360, hw: 10 },
  { x: 285, top: 260, bottom: 352, hw: 9 },
  { x: 325, top: 252, bottom: 342, hw: 8 },
  { x: 380, top: 235, bottom: 320, hw: 9 },
  { x: 408, top: 220, bottom: 298, hw: 7 },
]

// レイン列を敷く範囲（葉の塊＋ドリップ帯の全体）。はみ出しは clipCrown で形に抜く。
const CROWN_MIN_X = Math.min(
  ...CLUMPS.map((c) => c.x - c.r),
  ...DRIPS.map((d) => d.x - d.hw)
)
const CROWN_MAX_X = Math.max(
  ...CLUMPS.map((c) => c.x + c.r),
  ...DRIPS.map((d) => d.x + d.hw)
)
const CROWN_MIN_Y = Math.min(...CLUMPS.map((c) => c.y - c.r))
const CROWN_MAX_Y = Math.max(
  ...CLUMPS.map((c) => c.y + c.r),
  ...DRIPS.map((d) => d.bottom)
)

// 1本のレイン列。楕円内に収まる縦の文字列で、ヘッドが下へ流れ落ちる。
type Column = {
  x: number
  topY: number
  rows: number
  head: number // 現在のヘッド行（実数）。下方向に増える。
  speed: number // 1ミリ秒あたりの落下行数。
  chars: string[] // 各行の文字（配列は使い回し、毎フレーム確保しない）。
}

// 中央に常設するサイバー風の木（#43）。発光する幹＋枝（SVGライン）に、
// 樹冠は canvas で描く「本物のマトリックス・デジタルレイン」を重ねる。
// 文字は実際に切り替わり、白いヘッドが下へ流れて尾がシアンにフェードする。
//
// 長時間稼働（8時間以上）のメモリリーク対策：
//  - rAF の id を保持し、アンマウント時に必ず cancelAnimationFrame する
//  - タブ非アクティブ時はループを停止し、復帰時に基準時刻をリセット（dtスパイク防止）
//  - 列・文字配列は固定長で使い回し、毎フレームの確保をしない
//  - prefers-reduced-motion 時はアニメーションせず静止フレームを1枚だけ描く
//
// stage（data-stage）で樹冠が拡大、満開（data-bloomed）で発光最大化。いずれも CSS が担当する。
// ref は演出（パルス・満開ポップ）と #44 の吸収先座標算出のため親へ公開する。
const CenterTree = forwardRef<HTMLDivElement, CenterTreeProps>(function CenterTree(
  { stage, bloomed = false },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // 樹冠のデジタルレイン（client 専用描画。SSRしないのでハイドレーション不整合なし）。
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const pick = (): string => GLYPHS[(Math.random() * GLYPHS.length) | 0]

    // 葉の塊（ふくらみ）の緑グラデーション。中心が濃く端へ透明。固定なので一度だけ生成する。
    // 複数を重ねて描くことで、不透明感のあるモリモリした緑の樹冠になる。
    const clumpFills = CLUMPS.map((c) => {
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r)
      g.addColorStop(0, 'rgba(88, 206, 108, 0.95)')
      g.addColorStop(0.5, 'rgba(52, 176, 80, 0.62)')
      g.addColorStop(1, 'rgba(40, 150, 70, 0)')
      return { c, g }
    })

    // レインを通す形（葉のふくらみ＋下に垂れるドリップ帯の和）をクリップパスにする。
    // これにより、葉の内側は密に、葉の下はドリップ帯に沿って滴るコードだけが見える。
    const clipCrown = (): void => {
      ctx.beginPath()
      for (const { c } of clumpFills) {
        ctx.moveTo(c.x + c.r, c.y)
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2)
      }
      for (const d of DRIPS) {
        ctx.rect(d.x - d.hw, d.top, d.hw * 2, d.bottom - d.top)
      }
      ctx.clip()
    }

    // DPR を反映してバッキングストアを設定（高解像度ビジョンでも文字をくっきり描く）。
    const setup = (): void => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2) // 負荷対策に上限を設ける
      canvas.width = Math.round(CANOPY_W * dpr)
      canvas.height = Math.round(CANOPY_H * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.font = `700 ${FONT_SIZE}px 'Courier New', 'Consolas', monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
    }
    setup()

    // 樹冠のバウンディング全体に縦のレイン列を敷き詰める（はみ出しは clipCrown で葉の形に抜く）。
    const rows = Math.max(1, Math.floor((CROWN_MAX_Y - CROWN_MIN_Y) / LINE_HEIGHT))
    const columns: Column[] = []
    for (let x = CROWN_MIN_X; x <= CROWN_MAX_X; x += FONT_SIZE) {
      columns.push({
        x,
        topY: CROWN_MIN_Y,
        rows,
        head: -Math.random() * rows, // バラけたタイミングで落とし始める
        speed: 0.004 + Math.random() * 0.008, // 列ごとに速度差
        chars: new Array<string>(rows).fill(''),
      })
    }

    // 現在の状態を1フレーム描画する。透明オーバーレイなので毎回クリアして軌跡を alpha で表現する。
    const draw = (): void => {
      ctx.clearRect(0, 0, CANOPY_W, CANOPY_H)

      // 下地：緑の葉の塊（ふくらみを重ねてモリモリした緑の樹冠を作る）。
      for (const { c, g } of clumpFills) {
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2)
        ctx.fill()
      }

      // 上に流れ落ちる英数字のデジタルレイン（樹冠の形にクリップして葉の内側だけに描く）。
      ctx.save()
      clipCrown()
      for (const c of columns) {
        const headRow = Math.floor(c.head)
        for (let k = 0; k < TRAIL; k++) {
          const row = headRow - k
          if (row < 0 || row >= c.rows) continue
          if (!c.chars[row]) c.chars[row] = pick()
          const y = c.topY + row * LINE_HEIGHT + LINE_HEIGHT / 2
          if (k === 0) {
            // ヘッド：白〜淡緑で強く、緑のグローを乗せる。
            ctx.shadowColor = 'rgba(90,240,130,0.9)'
            ctx.shadowBlur = 8
            ctx.fillStyle = 'rgba(228,255,230,1)'
          } else {
            // 尾：緑で徐々にフェード。
            ctx.shadowBlur = 0
            const alpha = Math.max(0, 1 - k / TRAIL) * 0.85
            ctx.fillStyle = `rgba(70,215,105,${alpha})`
          }
          ctx.fillText(c.chars[row], c.x, y)
        }
      }
      ctx.restore()
      ctx.shadowBlur = 0
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let rafId = 0
    let running = false
    let last = 0

    const tick = (now: number): void => {
      if (!last) last = now
      let dt = now - last
      last = now
      if (dt > 100) dt = 100 // タブ復帰時などの巨大 dt を抑える（一気に飛ばさない）

      for (const c of columns) {
        const prevHead = Math.floor(c.head)
        c.head += c.speed * dt
        const newHead = Math.floor(c.head)
        if (newHead !== prevHead) {
          // ヘッド前進時に新しい文字を割り当て、ときどき軌跡中の文字を差し替えてチラつかせる。
          if (newHead >= 0 && newHead < c.rows) c.chars[newHead] = pick()
          if (Math.random() < 0.3) c.chars[(Math.random() * c.rows) | 0] = pick()
        }
        // 末尾まで落ちきったらリセット（配列は fill で再利用＝メモリを確保しない）。
        if (c.head - TRAIL > c.rows) {
          c.head = -Math.random() * 6
          c.speed = 0.004 + Math.random() * 0.008
          c.chars.fill('')
        }
      }
      draw()
      rafId = requestAnimationFrame(tick)
    }

    const start = (): void => {
      if (running) return
      running = true
      last = 0 // 再開時は基準時刻をリセットして dt スパイクを防ぐ
      rafId = requestAnimationFrame(tick)
    }
    const stop = (): void => {
      running = false
      if (rafId) cancelAnimationFrame(rafId)
      rafId = 0
    }

    if (reduced) {
      // モーション抑制設定では静止画を1枚だけ描く（rAF を回さない）。
      for (const c of columns) {
        c.head = c.rows
        for (let r = 0; r < c.rows; r++) c.chars[r] = pick()
      }
      draw()
    } else {
      start()
    }

    // タブ非アクティブ時はループ停止、復帰時に再開（基準時刻リセット込み）。
    const onVisibility = (): void => {
      if (document.hidden) stop()
      else if (!reduced) start()
    }
    document.addEventListener('visibilitychange', onVisibility)

    // DPR が変わる環境変化（別モニタへの移動など）に追従して描き直す。
    const onResize = (): void => setup()
    window.addEventListener('resize', onResize)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <div
      ref={ref}
      className={styles.treeWrap}
      data-stage={stage}
      data-bloomed={bloomed}
      aria-hidden="true"
    >
      {/* 内側ラッパー：マイルストーンのパルス（pulseTree）はこの要素を拡大→戻すため、
          幹・枝（SVG）と樹冠レイン（canvas）が一体でパルスする。 */}
      <div className={styles.treeInner} data-tree-inner="true">
        <svg className={styles.tree} viewBox="0 0 200 260" xmlns="http://www.w3.org/2000/svg">
          <defs>
            {/* 発光する幹の縦グラデーション（上が明るく、根元がシアン寄り） */}
            <linearGradient id="cyberTrunk" x1="0" y1="0" x2="0" y2="1">
              <stop className={styles.trunkStopTop} offset="0%" />
              <stop className={styles.trunkStopBottom} offset="100%" />
            </linearGradient>
          </defs>

          {/* 幹（太めの発光する塊）。根元が広がるテーパー形。 */}
          <path
            className={styles.trunk}
            d="M84 254 C82 226 80 206 90 178 C94 166 96 154 98 140 L102 140 C104 154 106 166 110 178 C120 206 118 226 116 254 Z"
          />

          {/* 枝（発光ライン）。幹から何回も枝分かれして上・外へ広がる。 */}
          <g className={styles.branches}>
            {/* 主枝：中央の背骨と左右の大枝 */}
            <path className={styles.branchMain} d="M100 150 C100 122 100 96 100 58" />
            <path className={styles.branchMain} d="M99 160 C86 144 74 128 62 104" />
            <path className={styles.branchMain} d="M101 160 C114 144 126 128 138 104" />
            {/* 二次枝 */}
            <path className={styles.branchSub} d="M98 172 C82 162 68 156 50 142" />
            <path className={styles.branchSub} d="M102 172 C118 162 132 156 150 142" />
            <path className={styles.branchSub} d="M100 134 C94 118 88 104 80 90" />
            <path className={styles.branchSub} d="M100 134 C106 118 112 104 120 90" />
            {/* 小枝（樹冠の端へ伸ばす） */}
            <path className={styles.branchTwig} d="M82 122 C76 112 70 106 60 98" />
            <path className={styles.branchTwig} d="M118 122 C124 112 130 106 140 98" />
            <path className={styles.branchTwig} d="M90 100 C86 90 84 82 84 72" />
            <path className={styles.branchTwig} d="M110 100 C114 90 116 82 116 72" />
          </g>
        </svg>

        {/* 樹冠＝マトリックス・デジタルレイン（#44 のパーティクル吸収先）。
            canvas で実際に文字が切り替わる本物のレインを描く。stage で拡大・満開で発光最大化（CSS）。
            data-canopy は #44 が吸収先の中心座標を算出するためのフック。 */}
        <canvas ref={canvasRef} className={styles.canopy} data-canopy="true" />
      </div>
    </div>
  )
})

export default CenterTree
