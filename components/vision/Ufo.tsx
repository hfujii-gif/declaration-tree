'use client'

import { useEffect, useRef } from 'react'
import { MATRIX_GLYPHS, MATRIX_FONT_STACK } from '@/lib/constants'
import { useRareVisibility } from './useRareVisibility'
import styles from './Ufo.module.scss'

// /vision の UFO（#55）。土星と同じく、背景映像の前・木の後ろ（z-index:1）に
// ごくたまに出現して数分間ふわっと浮かぶレア演出。エコな言葉の文字（MATRIX_GLYPHS）で
// 円盤＋ドーム＋下部の光＋吸い上げビームの形を作る。色はサイバーなシアン〜緑。

// canvas の論理サイズ（CSS px）。ビームが下へ伸びるぶん縦に余裕を持たせる。
const CANVAS_W = 320
const CANVAS_H = 200
const CX = CANVAS_W / 2
const SAUCER_CY = 86 // 円盤の中心線
// 円盤（平たい楕円）。
const BODY_RX = 128
const BODY_RY = 24
// ドーム（上に乗る半球）。中心を円盤より上に置き、上半分だけ使う。
const DOME_RX = 52
const DOME_RY = 46
const DOME_CY = SAUCER_CY - 16
// 下部の光（窓灯り）。円盤の下縁に並べる。
const LIGHT_OFFSETS = [-84, -42, 0, 42, 84]
const LIGHT_Y = SAUCER_CY + 12
// 吸い上げビーム（下へ広がる三角）。
const BEAM_TOP_HW = 26
const BEAM_BOTTOM_HW = 80
// 文字の敷き詰め設定（樹冠・土星と同様）。
const CELL = 8
const GLYPH_FONT = 10
const JITTER = 0.8

// 表示し続ける時間（ミリ秒）。出現したら数分間とどまる。
const VISIBLE_MS = 3 * 60 * 1000 // 約3分
// 次に出現するまでの待ち時間（ミリ秒）。レアにするため長め＆ランダム。
const HIDDEN_MIN_MS = 20 * 60 * 1000 // 20分
const HIDDEN_MAX_MS = 45 * 60 * 1000 // 45分

type CellType = 'beam' | 'body' | 'dome' | 'light'

// UFO を構成する1文字セル。位置・文字・種別・明るさは生成時に固定。
type Cell = {
  x: number
  y: number
  ch: string
  type: CellType
  light: number // 明度（％）
  alpha: number // 透明度
}

export default function Ufo() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // 出現サイクル（数分表示・レアに再出現。初回もランダムな長い待ち＝最初からレア）。
  const visible = useRareVisibility({
    activeMs: VISIBLE_MS,
    hiddenMinMs: HIDDEN_MIN_MS,
    hiddenMaxMs: HIDDEN_MAX_MS,
  })

  // 円盤＋ドーム＋光＋ビームの形にエコ文字を敷き、canvas へ静的に1回描く。
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const pick = (): string => MATRIX_GLYPHS[(Math.random() * MATRIX_GLYPHS.length) | 0]
    const ellipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number): number => {
      const dx = (x - cx) / rx
      const dy = (y - cy) / ry
      return dx * dx + dy * dy
    }

    // 描画順＝ビーム（奥）→円盤→ドーム→光（手前）。
    const beam: Cell[] = []
    const body: Cell[] = []
    const dome: Cell[] = []
    const beamTopY = SAUCER_CY + BODY_RY * 0.5

    for (let gy = 0; gy <= CANVAS_H; gy += CELL) {
      for (let gx = 0; gx <= CANVAS_W; gx += CELL) {
        const x = gx + (Math.random() - 0.5) * CELL * JITTER
        const y = gy + (Math.random() - 0.5) * CELL * JITTER

        const inBody = ellipse(x, y, CX, SAUCER_CY, BODY_RX, BODY_RY) <= 1
        const inDome = ellipse(x, y, CX, DOME_CY, DOME_RX, DOME_RY) <= 1 && y <= SAUCER_CY

        if (inDome) {
          // ドーム（ガラス）：白っぽく半透明。
          dome.push({ x, y, ch: pick(), type: 'dome', light: 84, alpha: 0.55 + Math.random() * 0.3 })
        } else if (inBody) {
          // 円盤本体：上ほど明るいシアン〜緑。
          const nd = (y - (SAUCER_CY - BODY_RY)) / (BODY_RY * 2) // 0(上)→1(下)
          body.push({
            x,
            y,
            ch: pick(),
            type: 'body',
            light: 74 - nd * 22,
            alpha: 0.7 + Math.random() * 0.3,
          })
        } else if (y > beamTopY) {
          // 吸い上げビーム：下へ広がる三角の内側に、まばらに淡く敷く。
          const frac = (y - beamTopY) / (CANVAS_H - beamTopY)
          const hw = BEAM_TOP_HW + (BEAM_BOTTOM_HW - BEAM_TOP_HW) * frac
          if (Math.abs(x - CX) <= hw && Math.random() < 0.22) {
            beam.push({
              x,
              y,
              ch: pick(),
              type: 'beam',
              light: 72,
              alpha: (1 - frac) * 0.35 * (0.6 + Math.random() * 0.4),
            })
          }
        }
      }
    }

    // 下部の光：円盤の下縁に並ぶ暖色の窓灯り（手前に強く光らせる）。
    const lights: Cell[] = LIGHT_OFFSETS.map((ox) => ({
      x: CX + ox,
      y: LIGHT_Y,
      ch: pick(),
      type: 'light',
      light: 76,
      alpha: 1,
    }))

    const cells = [...beam, ...body, ...dome, ...lights]

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
        if (c.type === 'light') {
          // 窓灯り：暖色で強めに発光させてアクセントにする。
          ctx.shadowColor = 'rgba(255, 230, 140, 0.9)'
          ctx.shadowBlur = 8
          ctx.fillStyle = `hsla(48, 100%, ${c.light}%, ${c.alpha})`
        } else {
          // 機体・ドーム・ビーム：サイバーなシアン〜緑＋柔らかい発光。
          const sat = c.type === 'dome' ? 55 : 75
          ctx.shadowColor = 'rgba(150, 255, 220, 0.55)'
          ctx.shadowBlur = 5
          ctx.fillStyle = `hsla(162, ${sat}%, ${c.light}%, ${c.alpha})`
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
    <div className={styles.ufo} data-visible={visible} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  )
}
