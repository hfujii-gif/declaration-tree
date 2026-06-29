'use client'

import { useEffect, useRef } from 'react'
import { MATRIX_GLYPHS, MATRIX_FONT_STACK } from '@/lib/constants'
import { useRareVisibility } from './useRareVisibility'
import styles from './Rocket.module.scss'

// /vision のロケット（#55）。ごくたまに左下→右上へ斜めに飛んで横切る。
// エコな言葉の文字（MATRIX_GLYPHS）で機体（ノーズ・胴・フィン・窓）＋噴射炎を作る。
// canvas 内では機首を真上に描き、横断（左下→右上）と傾きは CSS の rotate が担う。

const CANVAS_W = 150
const CANVAS_H = 230
const CX = CANVAS_W / 2
const NOSE_TOP = 24 // 機首の先端 y
const BODY_TOP = 66 // 胴の上端 y
const BODY_BOTTOM = 156 // 胴の下端 y
const BODY_HW = 20 // 胴の半幅
const WINDOW = { x: CX, y: 98, r: 9 } // 窓（コックピット）
const FIN_TOP = 132
const FIN_BOTTOM = 164
const FIN_REACH = 26 // フィンが胴から横へ張り出す量
const FLAME_BOTTOM = 222 // 炎の下端 y
const FLAME_TOP_HW = 16
const CELL = 7
const GLYPH_FONT = 10

const TRAVERSE_MS = 8000

type CellType = 'body' | 'nose' | 'fin' | 'window' | 'flame'
type Cell = { x: number; y: number; ch: string; type: CellType; light: number; alpha: number }

export default function Rocket() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const visible = useRareVisibility({
    activeMs: TRAVERSE_MS,
    hiddenMinMs: 20 * 60 * 1000,
    hiddenMaxMs: 45 * 60 * 1000,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const pick = (): string => MATRIX_GLYPHS[(Math.random() * MATRIX_GLYPHS.length) | 0]
    const cells: Cell[] = []

    for (let gy = 0; gy <= CANVAS_H; gy += CELL) {
      for (let gx = 0; gx <= CANVAS_W; gx += CELL) {
        const x = gx + (Math.random() - 0.5) * CELL * 0.8
        const y = gy + (Math.random() - 0.5) * CELL * 0.8
        const adx = Math.abs(x - CX)

        // 窓（コックピット）：胴より手前に置く明るいシアン。
        if (Math.hypot(x - WINDOW.x, y - WINDOW.y) <= WINDOW.r) {
          cells.push({ x, y, ch: pick(), type: 'window', light: 78, alpha: 1 })
          continue
        }
        // 機首：三角（上ほど細く）。
        if (y >= NOSE_TOP && y < BODY_TOP) {
          const hw = (BODY_HW * (y - NOSE_TOP)) / (BODY_TOP - NOSE_TOP)
          if (adx <= hw) {
            cells.push({ x, y, ch: pick(), type: 'nose', light: 64, alpha: 0.95 })
            continue
          }
        }
        // 胴：縦の帯。
        if (y >= BODY_TOP && y <= BODY_BOTTOM && adx <= BODY_HW) {
          cells.push({ x, y, ch: pick(), type: 'body', light: 84 - ((y - BODY_TOP) / 90) * 14, alpha: 0.95 })
          continue
        }
        // フィン：胴の左右下に張り出す三角。
        if (y >= FIN_TOP && y <= FIN_BOTTOM) {
          const reach = (FIN_REACH * (y - FIN_TOP)) / (FIN_BOTTOM - FIN_TOP)
          if (adx > BODY_HW && adx <= BODY_HW + reach) {
            cells.push({ x, y, ch: pick(), type: 'fin', light: 60, alpha: 0.95 })
            continue
          }
        }
        // 噴射炎：胴の下から下へ。先細りで、まばら＆暖色。
        if (y > BODY_BOTTOM && y <= FLAME_BOTTOM) {
          const frac = (y - BODY_BOTTOM) / (FLAME_BOTTOM - BODY_BOTTOM) // 0(上)→1(下)
          const hw = FLAME_TOP_HW * (1 - frac)
          if (adx <= hw && Math.random() < 0.7) {
            cells.push({ x, y, ch: pick(), type: 'flame', light: 70, alpha: (1 - frac) * 0.9 + 0.1 })
          }
        }
      }
    }

    // 描画順：炎（奥）→機体（胴・機首・フィン）→窓（手前）。
    const order: CellType[] = ['flame', 'fin', 'body', 'nose', 'window']
    cells.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type))

    const draw = (): void => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(CANVAS_W * dpr)
      canvas.height = Math.round(CANVAS_H * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.font = `700 ${GLYPH_FONT}px ${MATRIX_FONT_STACK}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
      for (const c of cells) {
        if (c.type === 'flame') {
          // 噴射炎：黄〜橙のグラデーション（下ほど橙）。
          const hue = 50 - c.alpha * 30
          ctx.shadowColor = 'rgba(255, 180, 80, 0.85)'
          ctx.shadowBlur = 8
          ctx.fillStyle = `hsla(${hue}, 100%, ${c.light}%, ${c.alpha})`
        } else if (c.type === 'window') {
          ctx.shadowColor = 'rgba(150, 240, 255, 0.9)'
          ctx.shadowBlur = 8
          ctx.fillStyle = `hsla(190, 95%, ${c.light}%, ${c.alpha})`
        } else if (c.type === 'nose' || c.type === 'fin') {
          // 機首・フィン：赤のアクセント。
          ctx.shadowColor = 'rgba(255, 120, 110, 0.6)'
          ctx.shadowBlur = 5
          ctx.fillStyle = `hsla(8, 80%, ${c.light}%, ${c.alpha})`
        } else {
          // 胴：白〜淡いシルバー。
          ctx.shadowColor = 'rgba(220, 240, 255, 0.5)'
          ctx.shadowBlur = 5
          ctx.fillStyle = `hsla(205, 25%, ${c.light}%, ${c.alpha})`
        }
        ctx.fillText(c.ch, c.x, c.y)
      }
      ctx.shadowBlur = 0
    }
    draw()

    window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [])

  return (
    <div className={styles.rocket} data-visible={visible} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  )
}
