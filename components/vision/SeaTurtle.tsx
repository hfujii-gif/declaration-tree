'use client'

import { useEffect, useRef } from 'react'
import { MATRIX_GLYPHS, MATRIX_FONT_STACK } from '@/lib/constants'
import { useRareVisibility } from './useRareVisibility'
import styles from './SeaTurtle.module.scss'

// /vision の泳ぐウミガメ（レア演出 #55 系）。ごくたまに画面外左下→浅い弧→画面外右下へ優雅に横断する。
// クジラ(Whale.tsx)と同じ「横向き（側面視）」のシルエットで、同じ進行方向（右向き）へ泳ぐ。
// エコな言葉の文字（MATRIX_GLYPHS）で、横から見て盛り上がった甲羅のドーム（半楕円・六角の甲板模様を
// 明暗セルで表現）＋前方へ突き出た頭（首）＋目＋短い尾＋腹甲（プラストロン）を作る。
//
// 動き（最重要）：ウミガメは大きな前ヒレ（手前側のパドル）を pivot 周りに上下へ羽ばたかせ、
// 「飛ぶように」泳ぐ。後ろヒレは小さく後方ではためく。甲羅・頭・尾・腹甲はほぼ静止。
// 横断・傾きは CSS（turtleArc）が担う。
// 負荷対策：動かない部分はオフスクリーンに1枚だけ描いてキャッシュし、毎フレームは
// そのキャッシュを転写したうえで羽ばたくヒレだけ描き直す（fillText の総数を抑える）。

const CANVAS_W = 640
const CANVAS_H = 400
const CX = 320 // 胴体中心 x
const CY = 222 // 甲羅と腹甲の境界（ボディの基準ライン）y

const SHELL_RX = 178 // 胴体の長半径（前後方向）
const SHELL_RY = 128 // 甲羅ドームの高さ（基準ラインより上）
const BELLY_RY = 56 // 腹甲の深さ（基準ラインより下）

const HEX_SIZE = 24 // 六角形セルの大きさ（甲板模様の細かさ）

// 頭・首（甲羅の前＝右側へ突き出し、前方やや上へ伸びる）。
const HEAD_BACK = CX + SHELL_RX - 26
const HEAD_FRONT = CX + SHELL_RX + 82
const NECK_ROOT_Y = CY - 16 // 付け根の中心 y
const NECK_RISE = 30 // 先端へ向かって持ち上がる量
const HEAD_HALF = 30 // 付け根の半幅（先端へ細くなる）
const EYE_R = 6
const EYE_X = CX + SHELL_RX + 48 // 目の x（頭の前方）
const EYE_DY = 7 // 中心線から上にずらす量

// 尾（甲羅の後＝左側へ短く伸びる三角）。
const TAIL_FRONT = CX - SHELL_RX + 14
const TAIL_BACK = CX - SHELL_RX - 44
const TAIL_HALF = 16
const TAIL_Y = CY + 8 // 尾の中心 y（基準ラインより少し下）

const CELL = 9
const GLYPH_FONT = 12
const HUE = 145 // 海亀らしい緑

const SHADOW = 'rgba(120, 220, 160, 0.5)' // ヒレ・甲羅の発光（緑）

const TRAVERSE_MS = 40000 // 弧を描いて横断する（約40秒・ゆったり）

// 甲羅セルの種別：六角形パターンの明暗3トーン＋輪郭（暗い境界線）＋腹甲。
type ShellTone = 'shellDark' | 'shellMid' | 'shellLight' | 'shellRim'
type StaticType = ShellTone | 'belly' | 'head' | 'tail' | 'eye'
type StaticCell = { x: number; y: number; ch: string; type: StaticType; light: number }
// ヒレ足セルはピボット基準のローカル座標 (lx, ly) で持ち、毎フレーム回転させて羽ばたく。
type FlipperCell = { lx: number; ly: number; ch: string; light: number }
// ヒレ足1枚。pivot 周りに baseAngle を中心として amp 振幅で上下に羽ばたく。
type Flipper = {
  pivot: { x: number; y: number }
  baseAngle: number
  amp: number
  phase: number
  period: number
  cells: FlipperCell[]
}

export default function SeaTurtle() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // 休止レンジは他の大型レア（クジラ・マンタ）と別値にしている（各生物が独立に乱数で決めるため、同時出現を厳密に防ぐものではない）。
  const visible = useRareVisibility({
    activeMs: TRAVERSE_MS,
    hiddenMinMs: 22 * 60 * 1000,
    hiddenMaxMs: 46 * 60 * 1000,
  })

  // 表示中だけアニメーションを回す（出現していない間は rAF を回さない）。
  useEffect(() => {
    if (!visible) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const pick = (): string => MATRIX_GLYPHS[(Math.random() * MATRIX_GLYPHS.length) | 0]

    // --- 六角形グリッド（pointy-top）への変換ヘルパー（甲羅の甲板模様用）---
    // ピクセル座標を最も近い六角形セル（軸座標 q,r）に丸める（cube rounding）。
    const pixelToHex = (px: number, py: number): { q: number; r: number } => {
      const fq = ((Math.sqrt(3) / 3) * px - (1 / 3) * py) / HEX_SIZE
      const fr = ((2 / 3) * py) / HEX_SIZE
      let rx = Math.round(fq)
      let rz = Math.round(fr)
      const ry = Math.round(-fq - fr)
      const dx = Math.abs(rx - fq)
      const dy = Math.abs(ry - (-fq - fr))
      const dz = Math.abs(rz - fr)
      if (dx > dy && dx > dz) rx = -ry - rz
      else if (dy <= dz) rz = -rx - ry
      return { q: rx, r: rz }
    }
    // 六角形セルの中心ピクセル座標。
    const hexCenter = (q: number, r: number): { x: number; y: number } => ({
      x: HEX_SIZE * Math.sqrt(3) * (q + r / 2),
      y: HEX_SIZE * (3 / 2) * r,
    })

    // 首・頭の中心線 y（付け根→先端で持ち上がる）。
    const neckY = (x: number): number => {
      const frac = (x - HEAD_BACK) / (HEAD_FRONT - HEAD_BACK) // 0(付け根)→1(先端)
      return NECK_ROOT_Y - NECK_RISE * frac
    }

    // --- 静止セル（甲羅・腹甲・頭・尾・目）を生成 ---
    const staticCells: StaticCell[] = []
    for (let gy = 0; gy <= CANVAS_H; gy += CELL) {
      for (let gx = 0; gx <= CANVAS_W; gx += CELL) {
        const x = gx + (Math.random() - 0.5) * CELL * 0.8
        const y = gy + (Math.random() - 0.5) * CELL * 0.8
        const dx = x - CX
        const dy = y - CY

        // 頭・首：甲羅の前（右）へ突き出し、先端へ細くなる帯。
        if (x >= HEAD_BACK && x <= HEAD_FRONT) {
          const frac = (x - HEAD_BACK) / (HEAD_FRONT - HEAD_BACK) // 0(付け根)→1(先端)
          // 先端を丸く落とすため、後半は半幅を一気に絞る。
          const round = frac > 0.7 ? 1 - (frac - 0.7) / 0.3 : 1
          const hw = HEAD_HALF * (1 - 0.4 * frac) * round
          const cy = neckY(x)
          if (hw > 0 && Math.abs(y - cy) <= hw) {
            // 目：頭の前方・中心線の少し上に明るい一点。
            if (Math.hypot(x - EYE_X, y - (neckY(EYE_X) - EYE_DY)) <= EYE_R) {
              staticCells.push({ x, y, ch: pick(), type: 'eye', light: 96 })
            } else {
              staticCells.push({ x, y, ch: pick(), type: 'head', light: 50 })
            }
            continue
          }
        }

        // 尾：甲羅の後（左）へ短く伸びる三角。先端へ細くなる。
        if (x >= TAIL_BACK && x <= TAIL_FRONT) {
          const frac = (TAIL_FRONT - x) / (TAIL_FRONT - TAIL_BACK) // 0(付け根)→1(先端)
          const hw = TAIL_HALF * (1 - 0.7 * frac)
          if (Math.abs(y - TAIL_Y) <= hw) {
            staticCells.push({ x, y, ch: pick(), type: 'tail', light: 40 })
            continue
          }
        }

        if (dy < 0) {
          // --- 甲羅ドーム（基準ラインより上の半楕円）---
          const inside = (dx / SHELL_RX) ** 2 + (dy / SHELL_RY) ** 2
          if (inside > 1) continue
          // 六角形パターン：所属セルの軸座標から3トーンに色分けし、境界付近は暗い輪郭にする。
          const { q, r } = pixelToHex(dx, dy)
          const c = hexCenter(q, r)
          const distToHex = Math.hypot(dx - c.x, dy - c.y)
          // ドーム状の立体感：てっぺん（中心）ほど光を受けて少し明るい。
          const dome = (1 - inside) * 10
          if (distToHex > HEX_SIZE * 0.82) {
            staticCells.push({ x, y, ch: pick(), type: 'shellRim', light: 22 + dome })
          } else {
            const tone = (((q + 2 * r) % 3) + 3) % 3 // 0,1,2 の3色で六角を塗り分ける
            if (tone === 0) {
              staticCells.push({ x, y, ch: pick(), type: 'shellDark', light: 30 + dome })
            } else if (tone === 1) {
              staticCells.push({ x, y, ch: pick(), type: 'shellMid', light: 44 + dome })
            } else {
              staticCells.push({ x, y, ch: pick(), type: 'shellLight', light: 58 + dome })
            }
          }
        } else {
          // --- 腹甲（基準ラインより下の浅い半楕円）。模様なしの明るい面 ---
          const inside = (dx / SHELL_RX) ** 2 + (dy / BELLY_RY) ** 2
          if (inside > 1) continue
          staticCells.push({ x, y, ch: pick(), type: 'belly', light: 66 })
        }
      }
    }

    // --- ヒレ足セルの生成（ローカル frame：+lx 方向＝ヒレの伸びる向き）---
    // 付け根で細く、中ほどで最も広く、先端で丸く収まるパドル形にする。
    const buildFlipperCells = (length: number, halfWidth: number): FlipperCell[] => {
      const cells: FlipperCell[] = []
      for (let lx = 0; lx <= length; lx += CELL) {
        const t = lx / length // 0(付け根)→1(先端)
        const profile = Math.sin(Math.PI * Math.min(1, 0.16 + t * 0.95)) // パドル形の半幅プロファイル
        const hw = halfWidth * profile
        for (let ly = -halfWidth; ly <= halfWidth; ly += CELL) {
          if (Math.abs(ly) > hw) continue
          const jx = lx + (Math.random() - 0.5) * CELL * 0.7
          const jy = ly + (Math.random() - 0.5) * CELL * 0.7
          cells.push({ lx: jx, ly: jy, ch: pick(), light: 50 + t * 14 })
        }
      }
      return cells
    }

    const FRONT_LEN = 160 // 前ヒレは大きい
    const FRONT_HALF = 34
    const BACK_LEN = 78 // 後ろヒレは小さい
    const BACK_HALF = 18
    const FRONT_AMP = 0.55 // 前ヒレを大きく上下に羽ばたかせる（ラジアン）
    const BACK_AMP = 0.3 // 後ろヒレは小さく
    const FRONT_PERIOD = 1700 // 羽ばたく周期（ミリ秒）
    const BACK_PERIOD = 1900

    // 前ヒレ（手前側の大きいパドル）と後ろヒレ（小さい）。
    // baseAngle は canvas 座標系（+x=右/前, +y=下）での伸びる向き。
    // 前ヒレは前方下を中心に上下へはためき、後ろヒレは後方下で小さくはためく。
    // 配列の後ろに置いたものほど後に描かれる＝手前に重なるので、前ヒレを最後にする。
    const flippers: Flipper[] = [
      {
        // 後ろヒレ：後方（左）下へ小さく伸びる
        pivot: { x: CX - SHELL_RX * 0.52, y: CY + BELLY_RY * 0.5 },
        baseAngle: 2.3,
        amp: BACK_AMP,
        phase: Math.PI,
        period: BACK_PERIOD,
        cells: buildFlipperCells(BACK_LEN, BACK_HALF),
      },
      {
        // 前ヒレ：前方（右）下を中心に大きく上下へ羽ばたく
        pivot: { x: CX + SHELL_RX * 0.4, y: CY + BELLY_RY * 0.3 },
        baseAngle: 0.95,
        amp: FRONT_AMP,
        phase: 0,
        period: FRONT_PERIOD,
        cells: buildFlipperCells(FRONT_LEN, FRONT_HALF),
      },
    ]

    // 種別ごとの塗り色（彩度・透明度を切り替え、明度は cell.light を使う）。
    const fillFor = (o: CanvasRenderingContext2D, type: StaticType, light: number): void => {
      if (type === 'eye') o.fillStyle = 'rgba(255, 255, 255, 0.95)'
      else if (type === 'shellRim') o.fillStyle = `hsla(${HUE}, 42%, ${light}%, 0.92)`
      else if (type === 'shellDark') o.fillStyle = `hsla(${HUE}, 48%, ${light}%, 0.92)`
      else if (type === 'shellMid') o.fillStyle = `hsla(${HUE}, 52%, ${light}%, 0.92)`
      else if (type === 'shellLight') o.fillStyle = `hsla(${HUE}, 56%, ${light}%, 0.92)`
      else if (type === 'belly') o.fillStyle = `hsla(${HUE}, 38%, ${light}%, 0.9)`
      else if (type === 'head') o.fillStyle = `hsla(${HUE}, 46%, ${light}%, 0.92)`
      else o.fillStyle = `hsla(${HUE}, 44%, ${light}%, 0.9)` // tail
    }

    // --- 静止部分（甲羅・腹甲・頭・尾・目）をオフスクリーンに1枚だけ描いてキャッシュ ---
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
      o.shadowColor = SHADOW
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

    // 指定角度でヒレ足1枚を描く（ローカル座標を回転してピボットへ平行移動）。
    const drawFlipper = (f: Flipper, angle: number): void => {
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      for (const cell of f.cells) {
        const x = f.pivot.x + cell.lx * cos - cell.ly * sin
        const y = f.pivot.y + cell.lx * sin + cell.ly * cos
        ctx.fillStyle = `hsla(${HUE}, 55%, ${cell.light}%, 0.92)`
        ctx.fillText(cell.ch, x, y)
      }
    }

    // 1フレーム：甲羅キャッシュを転写し、前後のヒレを羽ばたかせて上描きする。
    const render = (ms: number): void => {
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
      if (off) ctx.drawImage(off, 0, 0, CANVAS_W, CANVAS_H)
      ctx.shadowColor = SHADOW
      ctx.shadowBlur = 5
      for (const f of flippers) {
        const angle = f.baseAngle + f.amp * Math.sin((ms / f.period) * Math.PI * 2 + f.phase)
        drawFlipper(f, angle)
      }
      ctx.shadowBlur = 0
      rafId = requestAnimationFrame(render)
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let rafId = 0
    if (reduced) {
      // モーション抑制時：ヒレを動かさず基準角度で1枚だけ描く。
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
      if (off) ctx.drawImage(off, 0, 0, CANVAS_W, CANVAS_H)
      ctx.shadowColor = SHADOW
      ctx.shadowBlur = 5
      for (const f of flippers) drawFlipper(f, f.baseAngle)
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
    <div className={styles.seaTurtle} data-visible={visible} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  )
}
