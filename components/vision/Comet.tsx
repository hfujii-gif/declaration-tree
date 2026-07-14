'use client'

import { useEffect, useRef } from 'react'
import { MATRIX_GLYPHS, MATRIX_FONT_STACK } from '@/lib/constants'
import { useRareVisibility } from './useRareVisibility'
import styles from './Comet.module.scss'

// /vision の彗星（#55）。流れ星の超ロング版として、ごくたまに大きな尾を引いて画面を横切る。
// エコな言葉の文字（MATRIX_GLYPHS）で氷の頭部＋長い尾を作る。横断は CSS（右上→左下）が担う。
// 尾は進行方向（左下）の逆＝右上へ伸びるよう、canvas 内で向きを固定して描く。

const CANVAS_W = 300
const CANVAS_H = 200
const HEAD = { x: 66, y: 138 } // 頭部（左下寄り）
const TAIL = { x: 272, y: 18 } // 尾の先（右上）
const HEAD_R = 20 // 頭部クラスタの半径
const TAIL_CELLS = 190 // 尾を構成する文字数
const TAIL_SPREAD = 30 // 尾の最大広がり（先端ほど太く散る）
const CELL = 8
const GLYPH_FONT = 11
const HUE = 190 // 氷のシアン

// 横断アニメの所要時間（ミリ秒）。表示時間＝横断時間とする。
const TRAVERSE_MS = 9000

type Cell = { x: number; y: number; ch: string; light: number; alpha: number }

export default function Comet() {
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

    const dx = TAIL.x - HEAD.x
    const dy = TAIL.y - HEAD.y
    const len = Math.hypot(dx, dy)
    const ux = dx / len
    const uy = dy / len // 頭→尾の単位ベクトル
    const px = -uy
    const py = ux // 垂直方向（尾の広がり用）

    const cells: Cell[] = []

    // 頭部：密なクラスタ（中心ほど白く強い）。
    for (let oy = -HEAD_R; oy <= HEAD_R; oy += CELL) {
      for (let ox = -HEAD_R; ox <= HEAD_R; ox += CELL) {
        const nd = Math.hypot(ox, oy) / HEAD_R
        if (nd > 1) continue
        cells.push({
          x: HEAD.x + ox + (Math.random() - 0.5) * CELL,
          y: HEAD.y + oy + (Math.random() - 0.5) * CELL,
          ch: pick(),
          light: 96 - nd * 16,
          alpha: 0.9,
        })
      }
    }

    // 尾：頭から尾先へ、先端ほど広がり淡くなる文字を散らす。
    for (let i = 0; i < TAIL_CELLS; i++) {
      const t = Math.sqrt(i / TAIL_CELLS) // 頭側を密にする
      const dist = t * len
      const spread = 4 + TAIL_SPREAD * t
      const off = (Math.random() - 0.5) * 2 * spread
      cells.push({
        x: HEAD.x + ux * dist + px * off,
        y: HEAD.y + uy * dist + py * off,
        ch: pick(),
        light: 88 - t * 30,
        alpha: (1 - t) * 0.85 + 0.05,
      })
    }

    const draw = (): void => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(CANVAS_W * dpr)
      canvas.height = Math.round(CANVAS_H * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.font = `700 ${GLYPH_FONT}px ${MATRIX_FONT_STACK}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
      ctx.shadowColor = 'rgba(180, 245, 255, 0.6)'
      ctx.shadowBlur = 6
      for (const c of cells) {
        ctx.fillStyle = `hsla(${HUE}, 90%, ${c.light}%, ${c.alpha})`
        ctx.fillText(c.ch, c.x, c.y)
      }
      ctx.shadowBlur = 0
    }
    draw()

    window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [])

  return (
    <div className={styles.comet} data-visible={visible} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  )
}
