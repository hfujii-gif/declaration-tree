'use client'

import { useEffect, useRef } from 'react'
import { MATRIX_GLYPHS, MATRIX_FONT_STACK } from '@/lib/constants'
import { useRareVisibility } from './useRareVisibility'
import styles from './Seahorse.module.scss'

// /vision の漂うタツノオトシゴの群れ（レア演出）。ごくたまに縦姿勢のまま画面下方から
// ゆらゆらと上方へ漂い、左右へわずかにドリフトしながら横切る幻想的なレア演出。
// エコな言葉の文字（MATRIX_GLYPHS）で、上を向いた長い吻（口先）の頭＋頭頂の冠（コロネット）＋
// S字に曲がった体（体節の明暗の縞）＋背中に並ぶ背びれ＋下端のくるりと巻いた尾を作る。
// 1体ぶんの描画ロジックはそのまま活かしつつ、1体を小さくして 3〜5 体の群れとして配置する。
// 浮遊・左右ドリフト（群れ全体）は CSS（seahorseDrift）が担う。
//
// 動き：表示中だけ rAF を回し、体ごとに位相をずらして
// (1)背びれを進行波で小刻みに波打たせ、(2)体全体を上下にゆっくりゆらめかせる。
// 負荷対策：動かない体（頭・吻・冠・体節・尾）は全体ぶんをまとめて1枚のオフスクリーン
// （スプライトアトラス＝体ごとに区画を分けて1枚に焼き込む）にキャッシュし、
// 毎フレームはそのキャッシュを（上下ゆらぎ分だけずらして）転写し、波打つ背びれだけ描き直す。

// 群れ全体を収める論理サイズ（横幅を広めにとって複数体を並べる）。
const CANVAS_W = 660
const CANVAS_H = 600

// --- 1体ぶんのローカル設計座標（この範囲で1体を描き、群れ配置時に縮小・移動する）---
// 体（トランク）の中心線（背骨）と半幅。縦姿勢で y が下へ進むほど体が S 字に曲がる。
const TRUNK_TOP = 150 // 体の上端（首のあたり）
const TRUNK_BOTTOM = 400 // 体の下端（尾の付け根）
const SPINE_X = 158 // 背骨の基準 x
const S_AMP = 24 // 背骨の S 字の振れ幅
const HMIN = 10 // 半幅の最小（首・尾の付け根）
const HMAX = 46 // 半幅の最大（腹のふくらみ）
const BACK_RATIO = 0.6 // 背中側（dx<0）は腹側より平たく絞る
const SEG_H = 22 // 体節（縞）の高さ

// --- 頭・目・吻・冠 ---
const HEAD = { x: SPINE_X + 18, y: 112, r: 32 }
const EYE = { x: HEAD.x + 9, y: HEAD.y - 4, r: 5 }
// 吻（上を向いた長い口先）：頭の前方上から斜め上へ伸びる細い管。
const SNOUT_A = { x: HEAD.x + 16, y: HEAD.y - 4 }
const SNOUT_B = { x: HEAD.x + 30, y: HEAD.y - 76 }
const SNOUT_W = 6.5
// 冠（コロネット）：頭頂の後ろ寄りに突き出す3つの棘。
const CORONET_TIPS = [
  { x: HEAD.x - 14, y: HEAD.y - HEAD.r - 4 },
  { x: HEAD.x - 3, y: HEAD.y - HEAD.r - 14 },
  { x: HEAD.x + 8, y: HEAD.y - HEAD.r - 7 },
]
const CORONET_R = 6

// --- 背びれ（背中に並ぶ・毎フレーム波打つ）---
const FIN_TOP = TRUNK_TOP + 24
const FIN_BOTTOM = TRUNK_BOTTOM - 16
const FIN_LAYERS = 3 // 背中の縁から外側へ重ねる層数
const FIN_STEP = 4 // 1層ごとの外側へのずらし幅
const FIN_AMP = 7 // 波打ちの横振れ幅（px）
const FIN_PERIOD = 520 // 背びれの波打ち周期（ミリ秒・小刻みに速く）
const FIN_WAVE_K = 0.07 // 背骨方向へ伝わる進行波の波数

// --- 尾（下端からくるりと巻くスパイラル）---
const TAIL_CX = 171 // 渦の中心 x
const TAIL_CY = TRUNK_BOTTOM + 48 // 渦の中心 y
const TAIL_RAD0 = 64 // 渦の開始半径
const TAIL_TURNS = 1.5 // 巻き回数
const TAIL_START_ANG = (-115 * Math.PI) / 180 // 開始角（体下端へ接続）
const TAIL_TH0 = 13 // 尾の太さ（先端ほど細る）

// --- 1体ぶんのローカル境界ボックス（吻の先〜尾の先・背びれの外側まで含む）---
// このボックスをアトラスの1区画とし、群れ配置時に scale 倍して転写する。
const LOCAL_X0 = 84
const LOCAL_X1 = 244
const LOCAL_Y0 = 24
const LOCAL_Y1 = 512
const BASE_W = LOCAL_X1 - LOCAL_X0 // 1区画の幅（CSS px）
const BASE_H = LOCAL_Y1 - LOCAL_Y0 // 1区画の高さ（CSS px）

// --- 体全体の上下ゆらぎ ---
const SWAY_AMP = 7 // 上下にゆらめく幅（px・1体の基準サイズ時）
const SWAY_PERIOD = 4200 // ゆらめきの周期（ミリ秒）

const CELL = 9
const GLYPH_FONT = 12
const HUE = 42 // タツノオトシゴらしい黄〜オレンジ

// --- 群れの体数・1体あたりの縮小率 ---
const FLOCK_MIN = 3
const FLOCK_MAX = 5
const SCALE_MIN = 0.3 // 1体あたりの最小縮小率（基準の約3割）
const SCALE_RANGE = 0.16 // 縮小率の振れ（0.30〜0.46）

const TRAVERSE_MS = 28000 // ゆらゆらと漂って横切る所要時間（約28秒）

type StaticType =
  | 'head'
  | 'snout'
  | 'coronet'
  | 'segLight'
  | 'segDark'
  | 'tailLight'
  | 'tailDark'
  | 'eye'
type StaticCell = { x: number; y: number; type: StaticType; light: number }
// 背びれセルは背中の縁からの深さ depth(0→1) を持ち、毎フレーム進行波で横へ波打たせる。
type FinCell = { x: number; y: number; depth: number }
// 1体のタツノオトシゴ。配置・縮小率・ゆらぎ／波打ちの位相を体ごとにずらして群れに見せる。
type Body = {
  slot: number // アトラス上の区画インデックス
  dx: number // 転写先の左上 x（CANVAS 座標）
  dy: number // 転写先の左上 y（CANVAS 座標）
  scale: number // 縮小率
  swayAmp: number // 上下ゆらぎ幅（px）
  swayPhase: number // 上下ゆらぎの位相
  finPhase: number // 背びれ波打ちの位相
  staticChars: string[] // 静止セルごとの文字（体ごとに変えて群れの単調さを避ける）
  finChars: string[] // 背びれセルごとの文字
}

export default function Seahorse() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const visible = useRareVisibility({
    activeMs: TRAVERSE_MS,
    hiddenMinMs: 24 * 60 * 1000,
    hiddenMaxMs: 48 * 60 * 1000,
  })

  // 表示中だけアニメーションを回す（出現していない間は rAF を回さない）。
  useEffect(() => {
    if (!visible) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const pick = (): string => MATRIX_GLYPHS[(Math.random() * MATRIX_GLYPHS.length) | 0]

    // 体（トランク）の背骨 x：上から下へ S 字に蛇行する。
    const spine = (y: number): number =>
      SPINE_X + S_AMP * Math.sin(((y - TRUNK_TOP) / (TRUNK_BOTTOM - TRUNK_TOP)) * Math.PI * 1.25)
    // 体の半幅：首・尾で細く、中央（腹）でふくらむ。
    const half = (y: number): number => {
      const u = Math.max(0, Math.min(1, (y - TRUNK_TOP) / (TRUNK_BOTTOM - TRUNK_TOP)))
      return HMIN + (HMAX - HMIN) * Math.sin(Math.PI * Math.pow(u, 0.8))
    }

    // 点と線分の距離（吻の判定に使う）。
    const distToSeg = (
      px: number,
      py: number,
      ax: number,
      ay: number,
      bx: number,
      by: number,
    ): number => {
      const dx = bx - ax
      const dy = by - ay
      const len2 = dx * dx + dy * dy
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
      return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
    }

    // --- 静止セル（頭・目・吻・冠・体節）と背びれセルの「形状」を1体ぶん生成（座標はローカル）---
    const staticCells: StaticCell[] = []
    for (let gy = 0; gy <= CANVAS_H; gy += CELL) {
      for (let gx = 0; gx <= CANVAS_W; gx += CELL) {
        const x = gx + (Math.random() - 0.5) * CELL * 0.8
        const y = gy + (Math.random() - 0.5) * CELL * 0.8

        // 目：頭の明るい一点。
        if (Math.hypot(x - EYE.x, y - EYE.y) <= EYE.r) {
          staticCells.push({ x, y, type: 'eye', light: 96 })
          continue
        }
        // 頭：丸い塊。
        if (Math.hypot(x - HEAD.x, y - HEAD.y) <= HEAD.r) {
          staticCells.push({ x, y, type: 'head', light: 66 })
          continue
        }
        // 吻：上を向いた細い管。
        if (distToSeg(x, y, SNOUT_A.x, SNOUT_A.y, SNOUT_B.x, SNOUT_B.y) <= SNOUT_W) {
          staticCells.push({ x, y, type: 'snout', light: 60 })
          continue
        }
        // 冠：頭頂の棘。
        let coronet = false
        for (const tip of CORONET_TIPS) {
          if (Math.hypot(x - tip.x, y - tip.y) <= CORONET_R) {
            coronet = true
            break
          }
        }
        if (coronet) {
          staticCells.push({ x, y, type: 'coronet', light: 64 })
          continue
        }
        // 体（トランク）：背骨からの横距離で内外を判定。腹側は丸く、背中側は平たく。
        if (y >= TRUNK_TOP && y <= TRUNK_BOTTOM) {
          const dx = x - spine(y)
          const limit = dx >= 0 ? half(y) : half(y) * BACK_RATIO
          if (Math.abs(dx) <= limit) {
            // 体節（縞）：横帯ごとに明暗を交互にして縞模様に見せる。
            const seg = Math.floor((y - TRUNK_TOP) / SEG_H)
            if (seg % 2 === 0) {
              staticCells.push({ x, y, type: 'segLight', light: 70 })
            } else {
              staticCells.push({ x, y, type: 'segDark', light: 44 })
            }
          }
        }
      }
    }

    // --- 尾セル（下端からくるりと巻くスパイラル）---
    for (let s = 0; s <= 1; s += 0.012) {
      const ang = TAIL_START_ANG + s * TAIL_TURNS * Math.PI * 2
      const rad = TAIL_RAD0 * (1 - 0.72 * s)
      const tx = TAIL_CX + rad * Math.cos(ang)
      const ty = TAIL_CY + rad * Math.sin(ang)
      const th = TAIL_TH0 * (1 - 0.7 * s)
      const nx = Math.cos(ang)
      const ny = Math.sin(ang)
      const dark = Math.floor(s * 10) % 2 === 1
      for (let o = -th; o <= th; o += CELL) {
        staticCells.push({
          x: tx + nx * o,
          y: ty + ny * o,
          type: dark ? 'tailDark' : 'tailLight',
          light: dark ? 46 : 64,
        })
      }
    }

    // --- 背びれセル（背中の縁の外側に並ぶ・毎フレーム波打つ）---
    const finCells: FinCell[] = []
    for (let y = FIN_TOP; y <= FIN_BOTTOM; y += CELL) {
      const edgeX = spine(y) - half(y) * BACK_RATIO
      for (let d = 0; d < FIN_LAYERS; d++) {
        const depth = (d + 1) / FIN_LAYERS
        finCells.push({
          x: edgeX - 2 - d * FIN_STEP,
          y: y + (Math.random() - 0.5) * CELL * 0.6,
          depth,
        })
      }
    }

    // --- 群れ（3〜5体）を生成。横位置を散らし、奥行き感のため縮小率に大小をつける ---
    const bodies: Body[] = []
    const count = FLOCK_MIN + ((Math.random() * (FLOCK_MAX - FLOCK_MIN + 1)) | 0) // 3〜5
    for (let i = 0; i < count; i++) {
      const scale = SCALE_MIN + Math.random() * SCALE_RANGE
      const dw = BASE_W * scale
      const dh = BASE_H * scale
      // 横方向に均等に散らしつつジッターを加える。
      const t = count === 1 ? 0.5 : i / (count - 1)
      const cx = CANVAS_W * (0.12 + 0.76 * t) + (Math.random() - 0.5) * 70
      const cy = CANVAS_H * (0.12 + Math.random() * 0.46)
      bodies.push({
        slot: i,
        dx: cx - dw / 2,
        dy: cy - dh / 2,
        scale,
        swayAmp: SWAY_AMP * (0.6 + Math.random() * 0.6),
        swayPhase: Math.random() * Math.PI * 2,
        finPhase: Math.random() * Math.PI * 2,
        staticChars: staticCells.map(() => pick()),
        finChars: finCells.map(() => pick()),
      })
    }

    // 静止セルの種別ごとの塗り色。
    const fillFor = (o: CanvasRenderingContext2D, type: StaticType, light: number): void => {
      if (type === 'eye') o.fillStyle = 'rgba(255, 255, 255, 0.95)'
      else if (type === 'head') o.fillStyle = `hsla(${HUE}, 70%, ${light}%, 0.92)`
      else if (type === 'snout') o.fillStyle = `hsla(${HUE}, 68%, ${light}%, 0.92)`
      else if (type === 'coronet') o.fillStyle = `hsla(${HUE}, 78%, ${light}%, 0.95)`
      else if (type === 'segDark' || type === 'tailDark')
        o.fillStyle = `hsla(${HUE}, 60%, ${light}%, 0.92)`
      else o.fillStyle = `hsla(${HUE}, 74%, ${light}%, 0.92)` // segLight / tailLight
    }

    // --- 静止部分を全体ぶんまとめて1枚のオフスクリーン（スプライトアトラス）にキャッシュ ---
    // 体ごとに横へ区画（BASE_W 幅）を割り当て、各区画に1体ぶんの静止セルを焼き込む。
    let atlas: HTMLCanvasElement | null = null
    let dpr = 1
    let slotWDev = 0 // 1区画の幅（デバイス px・転写元の矩形指定に使う）
    let slotHDev = 0 // 1区画の高さ（デバイス px）
    const buildStatic = (): void => {
      slotWDev = Math.round(BASE_W * dpr)
      slotHDev = Math.round(BASE_H * dpr)
      atlas = document.createElement('canvas')
      atlas.width = slotWDev * count
      atlas.height = slotHDev
      const o = atlas.getContext('2d')
      if (!o) return
      o.setTransform(dpr, 0, 0, dpr, 0, 0)
      o.font = `700 ${GLYPH_FONT}px ${MATRIX_FONT_STACK}`
      o.textAlign = 'center'
      o.textBaseline = 'middle'
      o.shadowColor = 'rgba(255, 205, 110, 0.5)'
      o.shadowBlur = 5
      for (const b of bodies) {
        const ox = b.slot * BASE_W - LOCAL_X0 // 区画内のローカル原点へ平行移動
        const oy = -LOCAL_Y0
        for (let k = 0; k < staticCells.length; k++) {
          const c = staticCells[k]
          fillFor(o, c.type, c.light)
          o.fillText(b.staticChars[k], c.x + ox, c.y + oy)
        }
      }
      o.shadowBlur = 0
    }

    const setup = (): void => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(CANVAS_W * dpr)
      canvas.height = Math.round(CANVAS_H * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      buildStatic()
    }
    setup()

    // 1体ぶんの背びれを波打たせて描く（animate=false で静止）。フォントは縮小率に合わせる。
    const drawFins = (b: Body, ms: number, swayY: number, animate: boolean): void => {
      ctx.font = `700 ${(GLYPH_FONT * b.scale).toFixed(1)}px ${MATRIX_FONT_STACK}`
      const phase = animate ? (ms / FIN_PERIOD) * Math.PI * 2 + b.finPhase : 0
      for (let k = 0; k < finCells.length; k++) {
        const f = finCells[k]
        const wave = animate ? Math.sin(phase - f.y * FIN_WAVE_K) : 0
        const xOff = -FIN_AMP * wave * f.depth
        const light = Math.max(0, Math.min(100, 70 + wave * 8))
        ctx.fillStyle = `hsla(48, 80%, ${light}%, 0.9)`
        const x = b.dx + (f.x - LOCAL_X0 + xOff) * b.scale
        const y = b.dy + swayY + (f.y - LOCAL_Y0) * b.scale
        ctx.fillText(b.finChars[k], x, y)
      }
    }

    // 1フレーム：各体の静止キャッシュ区画を上下ゆらぎ分だけずらして転写し、背びれを上描きする。
    const render = (ms: number): void => {
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
      ctx.shadowColor = 'rgba(255, 205, 110, 0.5)'
      ctx.shadowBlur = 5
      for (const b of bodies) {
        const swayY = b.swayAmp * b.scale * Math.sin((ms / SWAY_PERIOD) * Math.PI * 2 + b.swayPhase)
        // 静止体（区画）の転写：体ごとに縮小率・位置・上下ゆらぎを反映する。
        if (atlas) {
          ctx.drawImage(
            atlas,
            b.slot * slotWDev,
            0,
            slotWDev,
            slotHDev,
            b.dx,
            b.dy + swayY,
            BASE_W * b.scale,
            BASE_H * b.scale,
          )
        }
        // 背びれ：背骨方向へ伝わる進行波で横へ小刻みに波打つ。
        drawFins(b, ms, swayY, true)
      }
      ctx.shadowBlur = 0
      rafId = requestAnimationFrame(render)
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let rafId = 0
    // モーション抑制時：ゆらぎ・波打ちを止めて1枚だけ静止描画する。
    const drawStill = (): void => {
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
      ctx.shadowColor = 'rgba(255, 205, 110, 0.5)'
      ctx.shadowBlur = 5
      for (const b of bodies) {
        if (atlas) {
          ctx.drawImage(
            atlas,
            b.slot * slotWDev,
            0,
            slotWDev,
            slotHDev,
            b.dx,
            b.dy,
            BASE_W * b.scale,
            BASE_H * b.scale,
          )
        }
        ctx.fillStyle = `hsla(48, 80%, 70%, 0.9)`
        drawFins(b, 0, 0, false)
      }
      ctx.shadowBlur = 0
    }

    if (reduced) {
      drawStill()
    } else {
      rafId = requestAnimationFrame(render)
    }

    // DPR 変化（別モニタへ移動など）に追従して静止キャッシュを作り直す。
    const onResize = (): void => {
      setup()
      if (reduced) drawStill()
    }
    window.addEventListener('resize', onResize)

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      window.removeEventListener('resize', onResize)
    }
  }, [visible])

  return (
    <div className={styles.seahorse} data-visible={visible} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  )
}
