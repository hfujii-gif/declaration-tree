'use client'

import { useEffect, useRef } from 'react'
import { ECO_WORDS, MATRIX_GLYPHS, MATRIX_FONT_STACK } from '@/lib/constants'
import styles from './ShootingStars.module.scss'

// /vision の流れ星アニメ（#55）。エコな言葉を尾に連ねた流れ星を、一定間隔で
// 「右上→左下」または「左上→右下」へ斜めに横切らせる。
// レイヤーは背景映像（z-index:0）の前・中央の木（z-index:2）の後ろ（z-index:1）。
//
// 長時間稼働（8時間以上）のメモリリーク対策：
//  - rAF の id を保持し、アンマウント時に必ず cancelAnimationFrame する
//  - タブ非アクティブ時はループを停止し、復帰時に基準時刻をリセット（dtスパイク防止）
//  - 流れ星は寿命切れ・画面外で配列から除去し、同時表示数に上限を設ける
//  - prefers-reduced-motion 時はアニメーションしない（装飾なので何も描かない）

// 出現間隔（ミリ秒）。この範囲でランダムに次の出現までの待ち時間を決める。
const SPAWN_MIN_MS = 2600
const SPAWN_MAX_MS = 5200
// 同時に飛ばせる流れ星の上限（負荷の保険。通常は0〜2個）。
const MAX_STARS = 4
// 速度（px/秒）。画面をゆっくり横切る。
const SPEED_MIN = 420
const SPEED_MAX = 680
// 斜めの角度（水平からの伏角）。30〜45度の範囲で下向きに流す。
const ANGLE_MIN = (28 * Math.PI) / 180
const ANGLE_MAX = (46 * Math.PI) / 180
// 尾の文字サイズと文字間隔（px）。
const WORD_FONT = 22
const CHAR_GAP = WORD_FONT * 1.16
// 文字列の後ろへ伸ばす光の筋の追加長さ（px）。
const STREAK_EXTRA = 80
// フェードイン時間（ミリ秒）と、寿命後半でのフェードアウト割合。
const FADE_IN_MS = 220
const FADE_OUT_RATIO = 0.32

// 先頭の★（5角星）を文字で作るための設定。星のポリゴン内に入る格子点へ極小文字を敷く。
const STAR_OUTER = 30 // 星の外接半径(px)＝大きさ
const STAR_INNER = STAR_OUTER * 0.42 // 星の内側のくびれ半径
const STAR_CELL = 6 // 文字配置ピッチ（小さいほど密）
const STAR_GLYPH_FONT = 12 // 星を構成する文字のサイズ

// ★形を構成する文字セル（先頭中心からの相対座標）をモジュール読込時に1回だけ算出する。
// 5角星のポリゴン（外側・内側を交互の10頂点）を作り、その内側に入る格子点だけ採用する。
const STAR_CELLS: { ox: number; oy: number }[] = (() => {
  const pts: { x: number; y: number }[] = []
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? STAR_OUTER : STAR_INNER
    const a = -Math.PI / 2 + (i * Math.PI) / 5 // 頂点を真上から時計回りに配置
    pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r })
  }
  // 点が星ポリゴンの内側かどうか（交差数判定）。
  const inside = (px: number, py: number): boolean => {
    let c = false
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x
      const yi = pts[i].y
      const xj = pts[j].x
      const yj = pts[j].y
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c
    }
    return c
  }
  const cells: { ox: number; oy: number }[] = []
  for (let oy = -STAR_OUTER; oy <= STAR_OUTER; oy += STAR_CELL) {
    for (let ox = -STAR_OUTER; ox <= STAR_OUTER; ox += STAR_CELL) {
      if (inside(ox, oy)) cells.push({ ox, oy })
    }
  }
  return cells
})()

// 1つの流れ星。先頭（head）が進行方向の先で、エコ語の文字が後方へ尾を引く。
type Star = {
  x: number // head の現在位置（CSS px）
  y: number
  dx: number // 進行方向の単位ベクトル
  dy: number
  speed: number // px/秒
  word: string // 尾に連ねるエコな言葉
  hue: number // 色相（虹色＝多様性に合わせる）
  age: number // 経過時間（ミリ秒）
  life: number // 寿命（ミリ秒）。画面を渡りきる時間から算出する
  headGlyphs: string[] // ★形の各セルに敷く文字（STAR_CELLS と同じ並び。生成時に固定）
}

export default function ShootingStars() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 論理サイズ（CSS px）。画面サイズに追従する。
    let viewW = 0
    let viewH = 0

    // DPR を反映してバッキングストアを設定（大型ビジョンでも文字をくっきり描く）。
    const setup = (): void => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2) // 負荷対策に上限を設ける
      viewW = canvas.clientWidth
      viewH = canvas.clientHeight
      canvas.width = Math.max(1, Math.round(viewW * dpr))
      canvas.height = Math.max(1, Math.round(viewH * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
    }
    setup()

    const stars: Star[] = []

    const rand = (min: number, max: number): number => min + Math.random() * (max - min)

    // 流れ星を1つ生成する。「左上→右下」と「右上→左下」を半々で選ぶ。
    const spawn = (): void => {
      if (stars.length >= MAX_STARS) return
      const toRight = Math.random() < 0.5
      const angle = rand(ANGLE_MIN, ANGLE_MAX)
      const dx = (toRight ? 1 : -1) * Math.cos(angle)
      const dy = Math.sin(angle) // 常に下向き
      const speed = rand(SPEED_MIN, SPEED_MAX)
      // 開始位置：画面上端の少し外。左→右なら左寄り、右→左なら右寄りから入れる。
      const margin = 80
      const startX = toRight ? rand(-0.1, 0.45) * viewW : rand(0.55, 1.1) * viewW
      const startY = -margin
      // 寿命：画面下端の外（+2*margin）へ抜けるまでの時間（ミリ秒）。
      const travelY = viewH + margin * 2 - startY
      const life = (travelY / Math.max(1, dy)) / speed * 1000
      const word = ECO_WORDS[(Math.random() * ECO_WORDS.length) | 0]
      // ★形の各セルに敷く文字を生成時に固定する（毎フレーム差し替えるとチラついて読みにくいため）。
      const headGlyphs = STAR_CELLS.map(
        () => MATRIX_GLYPHS[(Math.random() * MATRIX_GLYPHS.length) | 0]
      )
      stars.push({
        x: startX,
        y: startY,
        dx,
        dy,
        speed,
        word,
        hue: Math.random() * 300, // 0=赤〜300=紫（虹色＝多様性）
        age: 0,
        life,
        headGlyphs,
      })
    }

    // 1つの流れ星を描く。先頭の輝点＋後方へ伸びる光の筋＋エコ語の文字（尾）。
    const drawStar = (s: Star): void => {
      // 透明度の包絡：出だしでフェードイン、寿命後半でフェードアウト。
      const fadeIn = Math.min(1, s.age / FADE_IN_MS)
      const fadeStart = s.life * (1 - FADE_OUT_RATIO)
      const fadeOut =
        s.age <= fadeStart ? 1 : Math.max(0, 1 - (s.age - fadeStart) / (s.life * FADE_OUT_RATIO))
      const env = fadeIn * fadeOut
      if (env <= 0.01) return

      // 後方へ伸びる光の筋（head → 尾の終端へグラデーション）。
      const tailLen = s.word.length * CHAR_GAP + STREAK_EXTRA
      const tailX = s.x - s.dx * tailLen
      const tailY = s.y - s.dy * tailLen
      const grad = ctx.createLinearGradient(s.x, s.y, tailX, tailY)
      grad.addColorStop(0, `hsla(${s.hue}, 100%, 88%, ${0.85 * env})`)
      grad.addColorStop(0.4, `hsla(${s.hue}, 100%, 72%, ${0.5 * env})`)
      grad.addColorStop(1, `hsla(${s.hue}, 100%, 65%, 0)`)
      ctx.strokeStyle = grad
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.shadowColor = `hsla(${s.hue}, 100%, 80%, ${0.7 * env})`
      ctx.shadowBlur = 10
      ctx.beginPath()
      ctx.moveTo(s.x, s.y)
      ctx.lineTo(tailX, tailY)
      ctx.stroke()

      // エコ語の文字を尾に連ねる（★の後方から始め、先頭ほど明るく後方ほど淡く）。
      ctx.font = `700 ${WORD_FONT}px ${MATRIX_FONT_STACK}`
      for (let i = 0; i < s.word.length; i++) {
        const dist = STAR_OUTER + (i + 1) * CHAR_GAP // ★に重ならないよう後方へずらす
        const cx = s.x - s.dx * dist
        const cy = s.y - s.dy * dist
        const t = i / Math.max(1, s.word.length) // 0(先頭寄り)→1(後方)
        const alpha = env * (1 - t * 0.7)
        ctx.shadowColor = `hsla(${s.hue}, 100%, 80%, ${0.6 * alpha})`
        ctx.shadowBlur = 6
        ctx.fillStyle = `hsla(${s.hue}, 95%, ${78 - t * 16}%, ${alpha})`
        ctx.fillText(s.word[i], cx, cy)
      }

      // 先頭の★：文字を5角星の形に敷き詰める。中心ほど白く、外周ほど色付き。
      ctx.font = `700 ${STAR_GLYPH_FONT}px ${MATRIX_FONT_STACK}`
      ctx.shadowColor = `hsla(${s.hue}, 100%, 82%, ${0.85 * env})`
      ctx.shadowBlur = 12
      for (let i = 0; i < STAR_CELLS.length; i++) {
        const { ox, oy } = STAR_CELLS[i]
        const dist = Math.hypot(ox, oy) / STAR_OUTER // 0(中心)→1(外周)
        const light = 96 - dist * 28 // 中心は白く、外周は色相が出る
        ctx.fillStyle = `hsla(${s.hue}, 100%, ${light}%, ${env})`
        ctx.fillText(s.headGlyphs[i], s.x + ox, s.y + oy)
      }
      ctx.shadowBlur = 0
    }

    const draw = (): void => {
      ctx.clearRect(0, 0, viewW, viewH)
      for (const s of stars) drawStar(s)
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let rafId = 0
    let running = false
    let last = 0
    let spawnAcc = 0
    let nextSpawn = rand(SPAWN_MIN_MS, SPAWN_MAX_MS)

    const tick = (now: number): void => {
      if (!last) last = now
      let dt = now - last
      last = now
      if (dt > 100) dt = 100 // タブ復帰時などの巨大 dt を抑える

      // 出現タイマー：一定間隔（ランダム）で新しい流れ星を生成する。
      spawnAcc += dt
      if (spawnAcc >= nextSpawn) {
        spawnAcc = 0
        nextSpawn = rand(SPAWN_MIN_MS, SPAWN_MAX_MS)
        spawn()
      }

      // 位置更新と、寿命切れ・画面外の除去。
      for (let i = stars.length - 1; i >= 0; i--) {
        const s = stars[i]
        s.age += dt
        const move = (s.speed * dt) / 1000
        s.x += s.dx * move
        s.y += s.dy * move
        if (s.age >= s.life || s.y > viewH + 120 || s.x < -200 || s.x > viewW + 200) {
          stars.splice(i, 1)
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
      // モーション抑制設定では流れ星を出さない（装飾なので静止＝何も描かない）。
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

    // 画面サイズ・DPR 変化に追従して再設定し描き直す。
    const onResize = (): void => {
      setup()
      draw()
    }
    window.addEventListener('resize', onResize)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <div className={styles.layer} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  )
}
