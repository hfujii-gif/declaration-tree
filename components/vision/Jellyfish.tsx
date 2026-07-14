'use client'

import { useEffect, useRef } from 'react'
import { MATRIX_GLYPHS, MATRIX_FONT_STACK } from '@/lib/constants'
import { useRareVisibility } from './useRareVisibility'
import styles from './Jellyfish.module.scss'

// /vision のクラゲの群れ（レア装飾）。ごくたまに画面下から上へゆっくり浮上する幻想的なレア演出。
// エコな言葉の文字（MATRIX_GLYPHS）で、半円のドーム状の傘＋下へ垂れる複数本の触手を作り、
// 3〜5体を群れとして描く。浮上（縦の移動）は CSS（jellyfishRise）が担う。
//
// 動き：表示中だけ rAF を回し、(1)傘をゆっくり拍動（縦に伸縮）させ、(2)触手を進行波で波打たせ、
// (3)各体を上下にゆらゆら漂わせる。位相を体ごとにずらして群れに見せる。
// 負荷対策：拍動・触手・漂いで全体が動くため、毎フレーム描画する。CELL を粗めにとり、
// 体数も抑えて fillText の総数を小さく保つ。表示していない間は rAF を回さない。

const CANVAS_W = 600
const CANVAS_H = 680

const HUE = 285 // 紫〜マゼンタ系

const CELL = 11 // 傘セルの間隔（粗めにして fillText を抑える）
const GLYPH_FONT = 12

const TENT_STEP = 11 // 触手セルの間隔
const TENT_WAVE_K = 2.6 // 触手の進行波の波数（先端ほどしなる）
const TENT_AMP = 16 // 触手の横揺れ幅（px・先端基準）
const TENT_PERIOD = 2600 // 触手の波打ち周期（ミリ秒）

const PULSE_AMP = 0.16 // 傘の拍動の振れ幅（縦の伸縮率）
const PULSE_PERIOD = 2400 // 傘の拍動周期（ミリ秒）

const BOB_PERIOD = 4200 // 体ごとの上下の漂い周期（ミリ秒）

const TRAVERSE_MS = 30000 // 下から上へ浮上しきる所要時間（約30秒）

// 傘セルは傘中心（＝触手の付け根）からの相対座標で持ち、毎フレーム拍動でスケールする。
type BellCell = { rx: number; ry: number; ch: string; light: number }
// 触手セルは付け根からの距離 frac(0→1) を持ち、先端ほど大きく横へしなる。
type TentCell = { frac: number; ch: string; light: number }
type Tentacle = { baseX: number; len: number; phase: number; cells: TentCell[] }
// 1体のクラゲ。傘の寸法・漂い/拍動の位相を体ごとにずらして群れに見せる。
type Jelly = {
  cx: number
  cy: number
  rx: number
  ry: number
  bobAmp: number
  bobPhase: number
  pulsePhase: number
  tentPhase: number
  bell: BellCell[]
  tentacles: Tentacle[]
}

export default function Jellyfish() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const visible = useRareVisibility({
    activeMs: TRAVERSE_MS,
    hiddenMinMs: 18 * 60 * 1000,
    hiddenMaxMs: 40 * 60 * 1000,
  })

  // 表示中だけアニメーションを回す（出現していない間は rAF を回さない）。
  useEffect(() => {
    if (!visible) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const pick = (): string => MATRIX_GLYPHS[(Math.random() * MATRIX_GLYPHS.length) | 0]

    // --- 1体分のクラゲ（傘セル＋触手）を生成 ---
    const buildJelly = (cx: number, cy: number, rx: number, ry: number): Jelly => {
      // 傘：上半分の半楕円（ドーム）。頂点ほど明るく、リム（下端）へ向かって少し暗くする。
      const bell: BellCell[] = []
      for (let gy = -ry; gy <= 0; gy += CELL) {
        for (let gx = -rx; gx <= rx; gx += CELL) {
          const x = gx + (Math.random() - 0.5) * CELL * 0.8
          const y = gy + (Math.random() - 0.5) * CELL * 0.8
          if (y > 0) continue
          if ((x / rx) ** 2 + (y / ry) ** 2 > 1) continue // ドームの外
          const top = -y / ry // 0(リム)→1(頂点)
          bell.push({ rx: x, ry: y, ch: pick(), light: 60 + top * 24 })
        }
      }

      // 触手：リムの幅に沿って 5〜7 本垂らす。本ごとに位相をずらす。
      const tentacles: Tentacle[] = []
      const tentCount = 5 + ((Math.random() * 3) | 0) // 5〜7
      for (let i = 0; i < tentCount; i++) {
        const t = tentCount === 1 ? 0.5 : i / (tentCount - 1)
        const baseX = (t - 0.5) * 2 * rx * 0.8 // 傘を大きくしたぶん付け根の幅も広げる
        const len = ry * (2.4 + Math.random() * 1.4) // 傘より十分長く垂らす
        const cells: TentCell[] = []
        for (let d = 0; d <= len; d += TENT_STEP) {
          const frac = d / len
          cells.push({ frac, ch: pick(), light: 66 - frac * 26 })
        }
        tentacles.push({ baseX, len, phase: Math.random() * Math.PI * 2, cells })
      }

      return {
        cx,
        cy,
        rx,
        ry,
        bobAmp: 10 + Math.random() * 10,
        bobPhase: Math.random() * Math.PI * 2,
        pulsePhase: Math.random() * Math.PI * 2,
        tentPhase: Math.random() * Math.PI * 2,
        bell,
        tentacles,
      }
    }

    // --- 群れ（3〜5体）を生成。横位置を散らし、奥行き感のため大小をつける ---
    const jellies: Jelly[] = []
    const count = 3 + ((Math.random() * 3) | 0) // 3〜5
    for (let i = 0; i < count; i++) {
      const cx = CANVAS_W * (0.16 + 0.68 * (count === 1 ? 0.5 : i / (count - 1))) +
        (Math.random() - 0.5) * 60
      const cy = CANVAS_H * (0.22 + Math.random() * 0.5) // 傘の付け根 y
      const rx = 48 + Math.random() * 30 // 傘を一回り〜二回り大きく（旧 38〜64 → 48〜78）
      const ry = rx * (0.88 + Math.random() * 0.2) // ドームを背高めにして頭でっかちに（旧 0.78〜0.96 → 0.88〜1.08）
      jellies.push(buildJelly(cx, cy, rx, ry))
    }

    const setup = (): void => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(CANVAS_W * dpr)
      canvas.height = Math.round(CANVAS_H * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.font = `700 ${GLYPH_FONT}px ${MATRIX_FONT_STACK}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
    }
    setup()

    // 1体を描く。animate=false（モーション抑制時）は拍動・波・漂いを止めて静止描画する。
    const drawJelly = (j: Jelly, ms: number, animate: boolean): void => {
      const bobY = animate ? j.bobAmp * Math.sin((ms / BOB_PERIOD) * Math.PI * 2 + j.bobPhase) : 0
      const pulse = animate ? Math.sin((ms / PULSE_PERIOD) * Math.PI * 2 + j.pulsePhase) : 0
      const sy = 1 + PULSE_AMP * pulse // 縦に伸縮（拍動）
      const sx = 1 - PULSE_AMP * pulse * 0.5 // 縦に伸びると横は少し縮む

      // 傘（半透明にふんわり発光）。頂点ほど明るく、alpha もやや高め。
      ctx.shadowColor = `hsla(${HUE}, 80%, 70%, 0.5)`
      ctx.shadowBlur = 7
      for (const c of j.bell) {
        const x = j.cx + c.rx * sx
        const y = j.cy + bobY + c.ry * sy
        const top = -c.ry / j.ry // 0(リム)→1(頂点)
        const alpha = 0.62 + top * 0.2 // 0.62〜0.82
        ctx.fillStyle = `hsla(${HUE}, 72%, ${c.light}%, ${alpha})`
        ctx.fillText(c.ch, x, y)
      }

      // 触手（細く下へ伸び、進行波で波打つ）。先端ほど横振れが大きく、暗く・薄くなる。
      const tentPhaseBase = animate ? (ms / TENT_PERIOD) * Math.PI * 2 : 0
      ctx.shadowBlur = 5
      for (const t of j.tentacles) {
        const phase = tentPhaseBase + t.phase
        for (const c of t.cells) {
          const sway = animate ? Math.sin(phase - c.frac * TENT_WAVE_K) * TENT_AMP * c.frac : 0
          const x = j.cx + t.baseX + sway
          const y = j.cy + bobY + c.frac * t.len
          const alpha = 0.6 - c.frac * 0.28 // 0.6→0.32
          ctx.fillStyle = `hsla(${HUE}, 70%, ${c.light}%, ${alpha})`
          ctx.fillText(c.ch, x, y)
        }
      }
      ctx.shadowBlur = 0
    }

    const render = (ms: number): void => {
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
      for (const j of jellies) drawJelly(j, ms, true)
      rafId = requestAnimationFrame(render)
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let rafId = 0
    if (reduced) {
      // モーション抑制時：拍動・波・漂いを止めて1枚だけ静止描画する。
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
      for (const j of jellies) drawJelly(j, 0, false)
    } else {
      rafId = requestAnimationFrame(render)
    }

    // DPR 変化（別モニタへ移動など）に追従して canvas を作り直す。
    const onResize = (): void => {
      setup()
      if (reduced) {
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
        for (const j of jellies) drawJelly(j, 0, false)
      }
    }
    window.addEventListener('resize', onResize)

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      window.removeEventListener('resize', onResize)
    }
  }, [visible])

  return (
    <div className={styles.jellyfish} data-visible={visible} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  )
}
