'use client'

import { useEffect, useRef } from 'react'
import { MATRIX_GLYPHS, MATRIX_FONT_STACK } from '@/lib/constants'
import { useRareVisibility } from './useRareVisibility'
import styles from './Saturn.module.scss'

// /vision の土星（#55）。背景映像の前・木の後ろ（z-index:1）に、ごくたまに出現して
// 数分間ふわっと浮かび、消えたあとは長く現れない“レア演出”。
// 樹冠・流れ星と同じく、エコな言葉の文字（MATRIX_GLYPHS）を惑星＋環の形に敷き詰めて作る。

// canvas の論理サイズ（CSS px）。環の腕が左右へ伸びるぶん横長にする。
const CANVAS_W = 360
const CANVAS_H = 210
const CX = CANVAS_W / 2
const CY = CANVAS_H / 2
// 惑星（球）の半径。
const PLANET_RX = 58
const PLANET_RY = 58
// 環（傾いた楕円帯）。縦をつぶして傾いて見せ、横は惑星より大きく張り出させる。
const RING_RX = 156
const RING_RY = 44
const RING_INNER = 0.62 // 環の内側比率（この内側は環の穴）
// 文字の敷き詰め設定（樹冠と同様：格子＋ゆらぎで“文字の粒”に見せる）。
const CELL = 8
const GLYPH_FONT = 10
const JITTER = 0.8

// 表示し続ける時間（ミリ秒）。出現したら数分間とどまる。
const VISIBLE_MS = 3 * 60 * 1000 // 約3分
// 次に出現するまでの待ち時間（ミリ秒）。レアにするため長め＆ランダム。
const HIDDEN_MIN_MS = 20 * 60 * 1000 // 20分
const HIDDEN_MAX_MS = 45 * 60 * 1000 // 45分

// 土星を構成する1文字セル。位置・文字・色（金/環）・明るさは生成時に固定。
type Cell = {
  x: number
  y: number
  ch: string
  ring: boolean // true=環の文字、false=惑星の文字
  light: number // 明度（％）。惑星は中心ほど明るく、環は一定
  alpha: number // 透明度（粗密の質感用）
}

export default function Saturn() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // 出現サイクル（数分表示・レアに再出現。初回もランダムな長い待ち＝最初からレア）。
  const visible = useRareVisibility({
    activeMs: VISIBLE_MS,
    hiddenMinMs: HIDDEN_MIN_MS,
    hiddenMaxMs: HIDDEN_MAX_MS,
  })

  // 惑星＋環の形にエコ文字を敷き、canvas へ描く（client 専用・静的に1回描画）。
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const pick = (): string => MATRIX_GLYPHS[(Math.random() * MATRIX_GLYPHS.length) | 0]

    // 楕円の正規化距離の2乗（<=1 で内側）。
    const ellipse = (x: number, y: number, rx: number, ry: number): number => {
      const dx = (x - CX) / rx
      const dy = (y - CY) / ry
      return dx * dx + dy * dy
    }

    // セルを生成する。惑星の内側、または環の帯（内外比率の間）に入る格子点へ文字を置く。
    // 環が惑星の裏へ回る部分（上半分かつ惑星内）は惑星に隠れるので描かない。
    // 描画順＝裏の環（上の腕）→惑星→手前の環（下半分）で、土星らしい前後関係を作る。
    const backRing: Cell[] = []
    const planet: Cell[] = []
    const frontRing: Cell[] = []
    for (let gy = 0; gy <= CANVAS_H; gy += CELL) {
      for (let gx = 0; gx <= CANVAS_W; gx += CELL) {
        const x = gx + (Math.random() - 0.5) * CELL * JITTER
        const y = gy + (Math.random() - 0.5) * CELL * JITTER
        const inPlanet = ellipse(x, y, PLANET_RX, PLANET_RY) <= 1
        const e = ellipse(x, y, RING_RX, RING_RY)
        const inRing = e <= 1 && e >= RING_INNER * RING_INNER
        if (!inPlanet && !inRing) continue

        if (inPlanet && (!inRing || y < CY)) {
          // 惑星本体（裏に回る環はここで惑星が覆う）。中心ほど明るい金色。
          const nd = Math.sqrt(ellipse(x, y, PLANET_RX, PLANET_RY)) // 0(中心)→1(縁)
          planet.push({
            x,
            y,
            ch: pick(),
            ring: false,
            light: 88 - nd * 32,
            alpha: 0.7 + Math.random() * 0.3,
          })
        } else if (inRing) {
          // 環の文字（少し白っぽく）。下半分は手前、上半分は奥。
          const cell: Cell = {
            x,
            y,
            ch: pick(),
            ring: true,
            light: 84,
            alpha: 0.55 + Math.random() * 0.4,
          }
          if (y >= CY) frontRing.push(cell)
          else backRing.push(cell)
        }
      }
    }
    const cells = [...backRing, ...planet, ...frontRing]

    // DPR を反映してバッキングストアを設定し、静的に1回描く。
    const draw = (): void => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(CANVAS_W * dpr)
      canvas.height = Math.round(CANVAS_H * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.font = `700 ${GLYPH_FONT}px ${MATRIX_FONT_STACK}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
      // 土星らしい淡い金色（環は彩度を落として白っぽく）。柔らかい発光を添える。
      ctx.shadowColor = 'rgba(255, 210, 130, 0.6)'
      ctx.shadowBlur = 5
      for (const c of cells) {
        const sat = c.ring ? 55 : 90
        ctx.fillStyle = `hsla(45, ${sat}%, ${c.light}%, ${c.alpha})`
        ctx.fillText(c.ch, c.x, c.y)
      }
      ctx.shadowBlur = 0
    }
    draw()

    // DPR・画面変化に追従して描き直す（文字配置は固定のまま）。
    window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [])

  return (
    <div className={styles.saturn} data-visible={visible} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  )
}
