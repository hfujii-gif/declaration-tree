'use client'

import { useEffect, useRef } from 'react'
import { MATRIX_GLYPHS, MATRIX_FONT_STACK } from '@/lib/constants'
import { useRareVisibility } from './useRareVisibility'
import styles from './Manta.module.scss'

// /vision の空飛ぶマンタ（エイ #55）。ごくたまに左下→浅い弧→右下へ優雅に横断するレア演出。
// クジラ（Whale.tsx）と同じ「横向き（側面視）」で、同じ進行方向（左→右）へ泳ぐ。
// エコな言葉の文字（MATRIX_GLYPHS）で、薄く平たい紡錘形の体＋前方（右）の頭・口・頭鰭2本・目＋
// 後方（左）へ細く長い鞭状の尾＋大きな胸びれ（翼）を作る。横断・傾きは CSS（mantaArc）が担う。
//
// 動き：表示中だけ rAF を回し、胸びれ（翼）を体側の付け根（pivot）で上下に大きく羽ばたかせて前進させる。
// Whale の尾びれと同じ「pivot 周りの回転」ロジックを、体側面の胸びれに応用している。
// 体（胴・頭・目）はほぼ静止し、翼だけが上下にはためく。マンタは羽ばたきが緩やかなので周期はゆったりめ。
// 負荷対策：動かない体はオフスクリーンに1枚だけ描いてキャッシュし、毎フレームはそのキャッシュを
// 転写したうえで翼（回転）と尾（横揺れ）だけ描き直す（fillText の総数を抑える）。

const CANVAS_W = 700
const CANVAS_H = 440
const CX = 360 // 体の中心 x
const CY = 180 // 体の中心 y（側面の高さ中心）
const RX = 190 // 体の長半径（横長の紡錘形）
const RY = 30 // 体の短半径（マンタは平たいのでクジラより薄い）
const HEAD_X = CX + RX // 頭側（前方＝右端）
const BODY_LEFT = CX - RX // 円盤の後端（尾の付け根＝左端）

// 頭部のパーツ（前方＝右側）。
const EYE = { x: CX + RX * 0.66, y: CY - 12, r: 5 } // 目（頭の上寄り）
const MOUTH = { x: HEAD_X - 6, y: CY + 2, half: 7 } // 口（前縁のセルを抜いて表現）
const CEPH_TIP_X = HEAD_X + 48 // 頭鰭（前方へ伸びる2本の角）の先端 x
const CEPH_SLOPE = 0.13 // 頭鰭の開き具合
const CEPH_HALF = 3.6 // 頭鰭の太さ

// 尾：円盤後端（左）から後方へ細く長く伸びる鞭状。側面なので上下に揺らす。
const TAIL_LEN = 130
const TAIL_STEP = 8
const TAIL_AMP = 14 // 尾先端の縦揺れ幅
const TAIL_PERIOD = 3000 // 尾の縦揺れ周期（ミリ秒）
const TAIL_BASE_Y = CY + 4 // 尾の付け根の高さ

// 胸びれ（翼）：体側の付け根（pivot）から下方へ広がる三角の大きな鰭。
// pivot 周りに上下回転させて羽ばたかせる（Whale の尾びれと同じ回転式）。
const WING_PIVOT = { x: CX + 30, y: CY } // 翼の付け根（回転軸）
const WING_FRONT_ROOT = { x: CX + 82, y: CY } // 前縁の付け根（右）
const WING_REAR_ROOT = { x: CX - 44, y: CY + 6 } // 後縁の付け根（左）
const WING_TIP = { x: CX - 70, y: CY + 138 } // 翼端（下方やや後ろ）
const WING_AMP = 0.5 // 羽ばたきの振れ幅（ラジアン・大きめ）
const WING_PERIOD = 3300 // 羽ばたきの周期（ミリ秒・ゆったり）

const CELL = 9
const GLYPH_FONT = 12
const HUE = 215 // 濃紺寄りの青（クジラ HUE 205 と差をつける）

const TRAVERSE_MS = 38000 // 弧を描いて横断する（約38秒・クジラよりゆったり）

type StaticType = 'body' | 'spot' | 'ceph' | 'eye'
type StaticCell = { x: number; y: number; ch: string; type: StaticType; light: number }
// 翼セルは pivot からの相対座標で持ち、毎フレーム回転させる。
type WingCell = { rx: number; ry: number; ch: string; light: number }
// 尾セルは付け根からの距離 frac(0→1) を持ち、先端ほど大きく上下へ振る。
type TailCell = { frac: number; ch: string }

export default function Manta() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // 休止レンジはクジラ等と別値にしている（各生物が独立に乱数で決めるため、同時出現を厳密に防ぐものではない）。
  const visible = useRareVisibility({
    activeMs: TRAVERSE_MS,
    hiddenMinMs: 25 * 60 * 1000,
    hiddenMaxMs: 50 * 60 * 1000,
  })

  // 表示中だけアニメーションを回す（出現していない間は rAF を回さない）。
  useEffect(() => {
    if (!visible) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const pick = (): string => MATRIX_GLYPHS[(Math.random() * MATRIX_GLYPHS.length) | 0]

    // 体（側面の紡錘形）の上下半幅。前方（右）が満ち、後端（左）へやや薄く絞る。
    const bodyHalf = (x: number): number => {
      const ex = ((x - CX) / RX) ** 2
      if (ex >= 1) return -1
      const u = (x - BODY_LEFT) / (2 * RX) // 0(後端)→1(頭)
      const taper = 0.78 + 0.22 * u
      return RY * Math.sqrt(1 - ex) * taper
    }

    // 点が三角形の内側にあるか（符号法）。胸びれ（翼）の輪郭判定に使う。
    const sideSign = (
      px: number,
      py: number,
      ax: number,
      ay: number,
      bx: number,
      by: number,
    ): number => (px - bx) * (ay - by) - (ax - bx) * (py - by)
    const inWing = (px: number, py: number): boolean => {
      const d1 = sideSign(px, py, WING_FRONT_ROOT.x, WING_FRONT_ROOT.y, WING_REAR_ROOT.x, WING_REAR_ROOT.y)
      const d2 = sideSign(px, py, WING_REAR_ROOT.x, WING_REAR_ROOT.y, WING_TIP.x, WING_TIP.y)
      const d3 = sideSign(px, py, WING_TIP.x, WING_TIP.y, WING_FRONT_ROOT.x, WING_FRONT_ROOT.y)
      const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
      const hasPos = d1 > 0 || d2 > 0 || d3 > 0
      return !(hasNeg && hasPos)
    }

    // --- 静止セル（体・斑点・頭鰭・目）を生成 ---
    const staticCells: StaticCell[] = []
    for (let gy = 0; gy <= CANVAS_H; gy += CELL) {
      for (let gx = 0; gx <= CANVAS_W; gx += CELL) {
        const x = gx + (Math.random() - 0.5) * CELL * 0.8
        const y = gy + (Math.random() - 0.5) * CELL * 0.8

        // 頭鰭：頭の前方（右）へ伸びる2本の角。上は上向き・下は下向きに開く。
        if (x >= HEAD_X - 4 && x <= CEPH_TIP_X) {
          const reach = x - HEAD_X
          const upperY = CY - 8 - CEPH_SLOPE * reach
          const lowerY = CY + 10 + CEPH_SLOPE * reach
          if (Math.abs(y - upperY) <= CEPH_HALF || Math.abs(y - lowerY) <= CEPH_HALF) {
            staticCells.push({ x, y, ch: pick(), type: 'ceph', light: 58 })
            continue
          }
        }

        // 体本体（側面の紡錘形）。
        const hy = bodyHalf(x)
        if (hy <= 0 || Math.abs(y - CY) > hy) continue

        // 目：頭の上寄りの明るい一点。
        if (Math.hypot(x - EYE.x, y - EYE.y) <= EYE.r) {
          staticCells.push({ x, y, ch: pick(), type: 'eye', light: 96 })
          continue
        }
        // 口：前縁のセルを抜いて口に見せる。
        if (x > HEAD_X - 16 && Math.abs(y - MOUTH.y) < MOUTH.half && x > MOUTH.x - 14) continue

        // 背側（上）は暗く、腹側（下）へ向かって少し明るく。
        const ndY = (y - (CY - hy)) / (2 * hy) // 0(上)→1(下)
        const baseLight = 46 + ndY * 14
        // 斑点（マンタの白斑）：体上面にまばらに散らす明るいセル。
        const spot = Math.random() < 0.07
        const light = spot ? 90 : baseLight
        staticCells.push({ x, y, ch: pick(), type: spot ? 'spot' : 'body', light })
      }
    }

    // --- 翼セル（pivot 相対）。三角の胸びれを敷き詰める ---
    const wingCells: WingCell[] = []
    const wMinX = Math.min(WING_FRONT_ROOT.x, WING_REAR_ROOT.x, WING_TIP.x)
    const wMaxX = Math.max(WING_FRONT_ROOT.x, WING_REAR_ROOT.x, WING_TIP.x)
    const wMinY = Math.min(WING_FRONT_ROOT.y, WING_REAR_ROOT.y, WING_TIP.y)
    const wMaxY = Math.max(WING_FRONT_ROOT.y, WING_REAR_ROOT.y, WING_TIP.y)
    for (let gy = wMinY; gy <= wMaxY; gy += CELL) {
      for (let gx = wMinX; gx <= wMaxX; gx += CELL) {
        const x = gx + (Math.random() - 0.5) * CELL * 0.8
        const y = gy + (Math.random() - 0.5) * CELL * 0.8
        if (!inWing(x, y)) continue
        // 付け根は明るく、翼端へ向かって少し暗く。斑点もまばらに。
        const frac = Math.min(Math.max((y - WING_PIVOT.y) / (WING_TIP.y - WING_PIVOT.y), 0), 1)
        const spot = Math.random() < 0.05
        const light = spot ? 88 : 56 - frac * 14
        wingCells.push({ rx: x - WING_PIVOT.x, ry: y - WING_PIVOT.y, ch: pick(), light })
      }
    }

    // --- 尾セル（後端 BODY_LEFT から後方へ細く伸びる）---
    const tailCells: TailCell[] = []
    for (let d = 0; d <= TAIL_LEN; d += TAIL_STEP) {
      tailCells.push({ frac: d / TAIL_LEN, ch: pick() })
    }

    // --- 静止部分をオフスクリーンに1枚だけ描いてキャッシュ ---
    let off: HTMLCanvasElement | null = null
    let dpr = 1
    const fillFor = (o: CanvasRenderingContext2D, type: StaticType, light: number): void => {
      if (type === 'eye') o.fillStyle = 'rgba(255, 255, 255, 0.95)'
      else if (type === 'spot') o.fillStyle = `hsla(${HUE}, 30%, ${light}%, 0.95)`
      else if (type === 'ceph') o.fillStyle = `hsla(${HUE}, 60%, ${light}%, 0.92)`
      else o.fillStyle = `hsla(${HUE}, 66%, ${light}%, 0.92)`
    }
    const buildStatic = (): void => {
      off = document.createElement('canvas')
      off.width = Math.round(CANVAS_W * dpr)
      off.height = Math.round(CANVAS_H * dpr)
      const o = off.getContext('2d')
      if (!o) return
      o.setTransform(dpr, 0, 0, dpr, 0, 0)
      o.font = `700 ${GLYPH_FONT}px ${MATRIX_FONT_STACK}`
      o.textAlign = 'center'
      o.textBaseline = 'middle'
      o.shadowColor = 'rgba(120, 190, 255, 0.5)'
      o.shadowBlur = 5
      for (const c of staticCells) {
        fillFor(o, c.type, c.light)
        o.fillText(c.ch, c.x, c.y)
      }
      o.shadowBlur = 0
    }

    const setup = (): void => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(CANVAS_W * dpr)
      canvas.height = Math.round(CANVAS_H * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.font = `700 ${GLYPH_FONT}px ${MATRIX_FONT_STACK}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      buildStatic()
    }
    setup()

    // 1フレーム：体キャッシュを転写し、翼（pivot 回転で羽ばたき）と尾（縦揺れ）を上描きする。
    const render = (ms: number): void => {
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
      if (off) ctx.drawImage(off, 0, 0, CANVAS_W, CANVAS_H)

      // 翼：pivot 周りに上下はためき（sin で振らす）。Whale の尾びれと同じ回転式。
      const ang = WING_AMP * Math.sin((ms / WING_PERIOD) * Math.PI * 2)
      const cos = Math.cos(ang)
      const sin = Math.sin(ang)
      ctx.shadowColor = 'rgba(120, 190, 255, 0.5)'
      ctx.shadowBlur = 5
      // 羽ばたきの上下に合わせて明るさを軽く揺らし、面が光を受けるように見せる。
      const shimmer = Math.sin((ms / WING_PERIOD) * Math.PI * 2) * 6
      for (const w of wingCells) {
        const x = WING_PIVOT.x + w.rx * cos - w.ry * sin
        const y = WING_PIVOT.y + w.rx * sin + w.ry * cos
        const light = Math.max(0, Math.min(100, w.light + shimmer))
        ctx.fillStyle = `hsla(${HUE}, 66%, ${light}%, 0.92)`
        ctx.fillText(w.ch, x, y)
      }

      // 尾：付け根は静かに、先端ほど大きく上下へしなる。
      const tailPhase = (ms / TAIL_PERIOD) * Math.PI * 2
      ctx.fillStyle = `hsla(${HUE}, 60%, 54%, 0.9)`
      for (const t of tailCells) {
        const x = BODY_LEFT - t.frac * TAIL_LEN
        const y = TAIL_BASE_Y + Math.sin(tailPhase - t.frac * 2.2) * TAIL_AMP * t.frac
        ctx.fillText(t.ch, x, y)
      }
      ctx.shadowBlur = 0
      rafId = requestAnimationFrame(render)
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let rafId = 0
    if (reduced) {
      // モーション抑制時：翼・尾を動かさず1枚だけ描く。
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
      if (off) ctx.drawImage(off, 0, 0, CANVAS_W, CANVAS_H)
      ctx.shadowColor = 'rgba(120, 190, 255, 0.5)'
      ctx.shadowBlur = 5
      for (const w of wingCells) {
        ctx.fillStyle = `hsla(${HUE}, 66%, ${w.light}%, 0.92)`
        ctx.fillText(w.ch, WING_PIVOT.x + w.rx, WING_PIVOT.y + w.ry)
      }
      ctx.fillStyle = `hsla(${HUE}, 60%, 54%, 0.9)`
      for (const t of tailCells) {
        ctx.fillText(t.ch, BODY_LEFT - t.frac * TAIL_LEN, TAIL_BASE_Y)
      }
      ctx.shadowBlur = 0
    } else {
      rafId = requestAnimationFrame(render)
    }

    // DPR 変化（別モニタへ移動など）に追従して静止キャッシュを作り直す。
    const onResize = (): void => setup()
    window.addEventListener('resize', onResize)

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      window.removeEventListener('resize', onResize)
    }
  }, [visible])

  return (
    <div className={styles.manta} data-visible={visible} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  )
}
