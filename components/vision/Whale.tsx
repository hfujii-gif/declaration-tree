'use client'

import { useEffect, useRef } from 'react'
import { MATRIX_GLYPHS, MATRIX_FONT_STACK } from '@/lib/constants'
import { useRareVisibility } from './useRareVisibility'
import styles from './Whale.module.scss'

// /vision の空飛ぶクジラ（#55）。ごくたまに左下→右下へ円弧を描いて横断する幻想的なレア演出。
// エコな言葉の文字（MATRIX_GLYPHS）で、頭が大きく尾へ細く絞る“クジラ体型”の胴体＋口＋喉のうね＋
// 目＋胸びれ＋尾びれ＋潮吹きを作る。横断・傾きは CSS（whaleArc）が担う。
//
// 動き：表示中だけ rAF を回し、尾びれを上下にはためかせ・潮吹きを噴き上げる。
// 負荷対策：動かない胴体はオフスクリーンに1枚だけ描いてキャッシュし、毎フレームは
// そのキャッシュを転写したうえで尾びれ・潮吹きだけ描き直す（fillText の総数を抑える）。

const CANVAS_W = 760
const CANVAS_H = 350
const CX = 430 // 胴体中心 x
const CY = 178 // 胴体中心 y
const RX = 300 // 胴体の長半径（長くしてクジラ体型に）
const RY = 92 // 胴体の短半径
const TAPER_MIN = 0.34 // 尾側の絞り（小さいほど尾が細くなる）
const TAIL_X = CX - RX // 胴体の左端（尾側）
// 尾びれ：胴体左端の少し内側を回転軸（pivot）にして、左へフォーク状に広がる。
const FLUKE_PIVOT = { x: TAIL_X + 18, y: CY }
const FLUKE_TIP_X = FLUKE_PIVOT.x - 112 // 尾びれ先端 x
const FLUKE_AMP = 0.34 // はためきの振れ幅（ラジアン）
const FLUKE_PERIOD = 1900 // はためきの周期（ミリ秒）
// 目（頭の右寄り・口の上）。
const EYE = { x: CX + RX * 0.72, y: CY - 18, r: 6 }
// 胸びれ（前方下に大きめ）。
const FIN = { cx: CX - 6, cy: CY + 94, rx: 82, ry: 26 }
// 潮吹き：噴気孔（頭の上やや後ろ）から噴き上がる。
const SPOUT_AT_X = CX + RX * 0.6
const SPOUT_COUNT = 30
const SPOUT_PERIOD = 1500 // 1粒が上りきる周期（ミリ秒）
const SPOUT_HEIGHT = 116 // 噴き上がる高さ
const SPOUT_SPREAD = 58 // 上るほど横へ広がる量
const CELL = 9
const GLYPH_FONT = 12
const HUE = 205 // 深い海の青

const TRAVERSE_MS = 32000 // 弧を描いて横断する（約32秒）

type StaticType = 'body' | 'belly' | 'groove' | 'fin' | 'eye'
type StaticCell = { x: number; y: number; ch: string; type: StaticType; light: number }
// 尾びれセルは pivot からの相対座標で持ち、毎フレーム回転させる。
type FlukeCell = { rx: number; ry: number; ch: string }
// 潮吹きの1粒。位相をずらして連続的に噴き上がって見せる。
type SpoutDrop = { ch: string; phase: number; dir: number; mag: number; baseAlpha: number }

export default function Whale() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const visible = useRareVisibility({
    activeMs: TRAVERSE_MS,
    hiddenMinMs: 20 * 60 * 1000,
    hiddenMaxMs: 45 * 60 * 1000,
  })

  // 表示中だけアニメーションを回す（出現していない間は rAF を回さない）。
  useEffect(() => {
    if (!visible) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const pick = (): string => MATRIX_GLYPHS[(Math.random() * MATRIX_GLYPHS.length) | 0]

    // 胴体シルエットの“上下の半分の高さ”。頭側は満ち、尾側へ細く絞る（クジラ体型）。
    const bodyHalf = (x: number): number => {
      const ex = ((x - CX) / RX) ** 2
      if (ex >= 1) return -1
      const u = (x - TAIL_X) / (2 * RX) // 0(尾)→1(頭)
      const taper = TAPER_MIN + (1 - TAPER_MIN) * u
      return RY * Math.sqrt(1 - ex) * taper
    }
    // 口のライン（頭の前方下を走る浅いカーブ）。この帯のセルを抜いて口に見せる。
    const mouthY = (x: number): number => CY + 20 + (x - (CX + RX * 0.34)) * 0.05

    // --- 静止セル（胴体・腹・喉のうね・胸びれ・目）を生成 ---
    const staticCells: StaticCell[] = []
    for (let gy = 0; gy <= CANVAS_H; gy += CELL) {
      for (let gx = 0; gx <= CANVAS_W; gx += CELL) {
        const x = gx + (Math.random() - 0.5) * CELL * 0.8
        const y = gy + (Math.random() - 0.5) * CELL * 0.8

        // 目：明るい一点。
        if (Math.hypot(x - EYE.x, y - EYE.y) <= EYE.r) {
          staticCells.push({ x, y, ch: pick(), type: 'eye', light: 96 })
          continue
        }
        // 胸びれ：前方下に張り出す大きめの楕円。
        if (y > CY + 44 && ((x - FIN.cx) / FIN.rx) ** 2 + ((y - FIN.cy) / FIN.ry) ** 2 <= 1) {
          staticCells.push({ x, y, ch: pick(), type: 'fin', light: 52 })
          continue
        }
        // 胴体本体。
        const hy = bodyHalf(x)
        if (hy > 0 && Math.abs(y - CY) <= hy) {
          // 口：前方下の浅いカーブ付近を抜く。
          if (x > CX + RX * 0.34 && Math.abs(y - mouthY(x)) < 2.6) continue
          const belly = y > CY + hy * 0.4
          const ndY = (y - (CY - hy)) / (2 * hy) // 0(上)→1(下)
          if (belly) {
            // 喉のうね（前方の腹）：斜めの線を少し暗くしてプリーツに見せる。
            const groove = x > CX - 30 && (((x - (y - CY) * 0.6) % 15) + 15) % 15 < 2.3
            staticCells.push({
              x,
              y,
              ch: pick(),
              type: groove ? 'groove' : 'belly',
              light: groove ? 50 : 82,
            })
          } else {
            staticCells.push({ x, y, ch: pick(), type: 'body', light: 72 - ndY * 18 })
          }
        }
      }
    }

    // --- 尾びれセル（pivot 相対）。左へ向かってフォーク状に上下へ広がる ---
    const flukeCells: FlukeCell[] = []
    for (let gy = 0; gy <= CANVAS_H; gy += CELL) {
      for (let gx = FLUKE_TIP_X; gx <= FLUKE_PIVOT.x; gx += CELL) {
        const x = gx + (Math.random() - 0.5) * CELL * 0.8
        const y = gy + (Math.random() - 0.5) * CELL * 0.8
        const frac = (FLUKE_PIVOT.x - x) / (FLUKE_PIVOT.x - FLUKE_TIP_X) // 0(軸)→1(先端)
        if (frac < 0 || frac > 1) continue
        const spread = 12 + 84 * frac
        const inner = 4 + 11 * frac
        const dyAbs = Math.abs(y - CY)
        if (dyAbs >= inner && dyAbs <= spread) {
          flukeCells.push({ rx: x - FLUKE_PIVOT.x, ry: y - CY, ch: pick() })
        }
      }
    }

    // --- 潮吹きの粒（位相を散らす）---
    const spout: SpoutDrop[] = []
    for (let i = 0; i < SPOUT_COUNT; i++) {
      spout.push({
        ch: pick(),
        phase: i / SPOUT_COUNT,
        dir: i % 2 === 0 ? 1 : -1,
        mag: 0.3 + ((i * 7) % 10) / 10, // 0.3〜1.2 の決め打ちの散らばり
        baseAlpha: 0.45 + ((i * 3) % 5) / 10,
      })
    }
    // 噴気孔の位置（胴体上面）。
    const spoutBaseY = CY - bodyHalf(SPOUT_AT_X)

    // --- 静止部分をオフスクリーンに1枚だけ描いてキャッシュ ---
    let off: HTMLCanvasElement | null = null
    let dpr = 1
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
      o.shadowColor = 'rgba(130, 200, 255, 0.5)'
      o.shadowBlur = 5
      for (const c of staticCells) {
        if (c.type === 'eye') {
          o.fillStyle = `rgba(255, 255, 255, 0.95)`
        } else if (c.type === 'belly') {
          o.fillStyle = `hsla(${HUE}, 40%, ${c.light}%, 0.92)`
        } else if (c.type === 'groove') {
          o.fillStyle = `hsla(${HUE}, 55%, ${c.light}%, 0.9)`
        } else if (c.type === 'fin') {
          o.fillStyle = `hsla(${HUE}, 62%, ${c.light}%, 0.92)`
        } else {
          o.fillStyle = `hsla(${HUE}, 68%, ${c.light}%, 0.92)`
        }
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

    // 1フレーム：胴体キャッシュを転写し、尾びれ（回転）と潮吹き（噴き上げ）を上描きする。
    const render = (ms: number): void => {
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
      if (off) ctx.drawImage(off, 0, 0, CANVAS_W, CANVAS_H)

      // 尾びれ：pivot 周りに上下はためき（sin で振らす）。
      const ang = FLUKE_AMP * Math.sin((ms / FLUKE_PERIOD) * Math.PI * 2)
      const cos = Math.cos(ang)
      const sin = Math.sin(ang)
      ctx.shadowColor = 'rgba(130, 200, 255, 0.5)'
      ctx.shadowBlur = 5
      ctx.fillStyle = `hsla(${HUE}, 64%, 56%, 0.92)`
      for (const f of flukeCells) {
        const x = FLUKE_PIVOT.x + f.rx * cos - f.ry * sin
        const y = FLUKE_PIVOT.y + f.rx * sin + f.ry * cos
        ctx.fillText(f.ch, x, y)
      }

      // 潮吹き：各粒が位相をずらして噴き上がり、上るほど横へ広がり、山なりに減衰する。
      for (const d of spout) {
        const prog = ((ms / SPOUT_PERIOD) + d.phase) % 1
        const x = SPOUT_AT_X + d.dir * prog * SPOUT_SPREAD * d.mag
        const y = spoutBaseY - 6 - prog * SPOUT_HEIGHT
        const alpha = Math.sin(prog * Math.PI) * d.baseAlpha
        if (alpha <= 0.02) continue
        ctx.shadowColor = `rgba(170, 230, 255, ${0.5 * alpha})`
        ctx.shadowBlur = 6
        ctx.fillStyle = `hsla(195, 90%, ${82 - prog * 10}%, ${alpha})`
        ctx.fillText(d.ch, x, y)
      }
      ctx.shadowBlur = 0
      rafId = requestAnimationFrame(render)
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let rafId = 0
    if (reduced) {
      // モーション抑制時：尾びれ・潮吹きを動かさず1枚だけ描く。
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
      if (off) ctx.drawImage(off, 0, 0, CANVAS_W, CANVAS_H)
      ctx.shadowColor = 'rgba(130, 200, 255, 0.5)'
      ctx.shadowBlur = 5
      ctx.fillStyle = `hsla(${HUE}, 64%, 56%, 0.92)`
      for (const f of flukeCells) {
        ctx.fillText(f.ch, FLUKE_PIVOT.x + f.rx, FLUKE_PIVOT.y + f.ry)
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
    <div className={styles.whale} data-visible={visible} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  )
}
