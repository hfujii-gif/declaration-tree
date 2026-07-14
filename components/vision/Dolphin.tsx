'use client'

import { useEffect, useRef } from 'react'
import { MATRIX_GLYPHS, MATRIX_FONT_STACK } from '@/lib/constants'
import { useRareVisibility } from './useRareVisibility'
import styles from './Dolphin.module.scss'

// /vision の跳ねるイルカ（レア演出）。ごくたまに水面から放物線を描いて跳び上がり、
// 弧を描いて横断してまた入水する幻想的なレア演出。
// クジラ（まっすぐな紡錘形）との差別化として、イルカは「体を弓なりにしならせた」
// ブリーチ姿で描く。背骨（spine）を上に凸のカーブにして胴全体をアーチ状に曲げ、
// クジラより細身・小ぶりにし、額のメロンの丸みと細く長い吻（くちばし）のコントラスト、
// 後方へ swept した鋭い背びれ・三日月の尾びれでイルカらしさを強調する。
// エコな言葉の文字（MATRIX_GLYPHS）で各部位を作る。横断・放物線・傾きは CSS（dolphinJump）が担う。
//
// 動き：表示中だけ rAF を回し、尾びれを上下に素早くはためかせる（イルカは尾を速く打つ）。
// 負荷対策：動かない体（弓なりの胴・メロン・吻・背びれ・胸びれ・目）はオフスクリーンに
// 1枚だけ描いてキャッシュし、毎フレームはそのキャッシュを転写したうえで尾びれだけ
// 描き直す（fillText の総数を抑える）。

const CANVAS_W = 720
const CANVAS_H = 360
const CX = 360 // 体の中心 x
const CY = 206 // 弓の両端（尾側・頭側）での背骨の基準 y
const RX = 214 // 体の長半径（クジラより短く小ぶり）
const RY = 40 // 体の短半径（クジラより細くスマート）
const ARCH = 84 // 弓なりの反り高さ（背骨を上に凸へ持ち上げる量）
const TAPER_MIN = 0.16 // 尾側の絞り（小さいほど尾が細くなる＝より流線型）
const TAIL_X = CX - RX // 体の左端（尾側）
const HEAD_X = CX + RX // 体の右端（頭側）

// 背骨（spine）：上に凸の放物線。中央が最も高く（y 小）、両端で CY まで下りる。
// これにより胴全体が弓なりにしなり、まっすぐなクジラ体型と明確に差がつく。
const spineY = (x: number): number => CY - ARCH * (1 - ((x - CX) / RX) ** 2)

// 尾びれ：体の左端の少し内側を回転軸（pivot）にして、左へ三日月状に上下へ広がる。
const FLUKE_PIVOT = { x: TAIL_X + 12, y: spineY(TAIL_X + 12) }
const FLUKE_TIP_X = FLUKE_PIVOT.x - 70 // 尾びれ先端 x
const FLUKE_AMP = 0.46 // はためきの振れ幅（ラジアン・クジラより大きく俊敏に）
const FLUKE_PERIOD = 740 // はためきの周期（ミリ秒・イルカは速く打つ）

// 吻（口先）：頭の前方へ細く長く突き出る（イルカの特徴）。背骨に沿ってやや下を走る。
const BEAK_BASE_X = CX + RX * 0.82 // 付け根 x
const BEAK_TIP_X = HEAD_X + 60 // 先端 x（体より大きく前へ突き出す）
const BEAK_BASE_HALF = 8.5 // 付け根の半幅（細め）
const beakY = (x: number): number => spineY(x) + 9 // 吻の中心線（背骨のやや下）

const CELL = 9
const GLYPH_FONT = 12
const HUE = 200 // イルカらしい青灰

const TRAVERSE_MS = 16000 // 放物線を描いて跳ねながら横断する（約16秒）

type StaticType = 'body' | 'belly' | 'melon' | 'beak' | 'dorsal' | 'fin' | 'eye'
type StaticCell = { x: number; y: number; ch: string; type: StaticType; light: number }
// 尾びれセルは pivot からの相対座標で持ち、毎フレーム回転させる。
type FlukeCell = { rx: number; ry: number; ch: string }

// 点が三角形（背びれ）の内側かどうかを符号付き面積で判定する。
const inTriangle = (
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
): boolean => {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by)
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy)
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay)
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0
  return !(hasNeg && hasPos)
}

export default function Dolphin() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // 休止レンジはクジラ・マンタと別値にしている（各生物が独立に乱数で決めるため、同時出現を厳密に防ぐものではない）。
  const visible = useRareVisibility({
    activeMs: TRAVERSE_MS,
    hiddenMinMs: 16 * 60 * 1000,
    hiddenMaxMs: 38 * 60 * 1000,
  })

  // 表示中だけアニメーションを回す（出現していない間は rAF を回さない）。
  useEffect(() => {
    if (!visible) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const pick = (): string => MATRIX_GLYPHS[(Math.random() * MATRIX_GLYPHS.length) | 0]

    // 体シルエットの“背骨からの半分の高さ”。頭側は満ち、尾側へ細く絞る（流線型）。
    const bodyHalf = (x: number): number => {
      const ex = ((x - CX) / RX) ** 2
      if (ex >= 1) return -1
      const u = (x - TAIL_X) / (2 * RX) // 0(尾)→1(頭)
      const taper = TAPER_MIN + (1 - TAPER_MIN) * u
      return RY * Math.sqrt(1 - ex) * taper
    }

    // 目（メロンの下・吻の上）。背骨に追従させる。
    const eye = { x: CX + RX * 0.68, y: spineY(CX + RX * 0.68) - 6, r: 5 }
    // 胸びれ（前方下に後方へ swept した楕円）。背骨に追従させる。
    const finCx = CX + RX * 0.22
    const fin = { cx: finCx, cy: spineY(finCx) + RY + 18, rx: 62, ry: 17 }

    // 背びれ：弓の頂点付近の体上面から後方へ swept した鋭い三角形（三日月状のキレ）。
    const dorsalBaseF = { x: CX + 42, y: spineY(CX + 42) - bodyHalf(CX + 42) + 3 } // 前縁の付け根
    const dorsalBaseB = { x: CX - 24, y: spineY(CX - 24) - bodyHalf(CX - 24) + 3 } // 後縁の付け根
    const dorsalApex = { x: CX - 16, y: spineY(CX) - RY - 70 } // 先端（鋭く・後方へ swept）

    // --- 静止セル（体・腹・メロン・吻・背びれ・胸びれ・目）を生成 ---
    const staticCells: StaticCell[] = []
    for (let gy = 0; gy <= CANVAS_H; gy += CELL) {
      for (let gx = 0; gx <= CANVAS_W; gx += CELL) {
        const x = gx + (Math.random() - 0.5) * CELL * 0.8
        const y = gy + (Math.random() - 0.5) * CELL * 0.8

        const sy = spineY(x) // この x での背骨の高さ
        const hy = bodyHalf(x)
        const inBody = hy > 0 && Math.abs(y - sy) <= hy

        // 目：頭の上寄りの明るい一点。
        if (inBody && Math.hypot(x - eye.x, y - eye.y) <= eye.r) {
          staticCells.push({ x, y, ch: pick(), type: 'eye', light: 96 })
          continue
        }

        // 体本体（背は暗め＝上、腹は明るめ＝下のグラデーション）。
        if (inBody) {
          const ndY = (y - (sy - hy)) / (2 * hy) // 0(背)→1(腹)
          const light = 38 + ndY * 48 // 38(背)〜86(腹)
          const belly = ndY > 0.6
          // メロン（丸い額）：前方上部の盛り上がりを少し明るくハイライトする。
          const melon = !belly && x > CX + RX * 0.5 && y < sy - hy * 0.15
          staticCells.push({
            x,
            y,
            ch: pick(),
            type: belly ? 'belly' : melon ? 'melon' : 'body',
            light,
          })
          continue
        }

        // 背びれ：弓の頂点上に張り出す swept した三角形。
        if (
          inTriangle(
            x,
            y,
            dorsalBaseF.x,
            dorsalBaseF.y,
            dorsalApex.x,
            dorsalApex.y,
            dorsalBaseB.x,
            dorsalBaseB.y,
          )
        ) {
          staticCells.push({ x, y, ch: pick(), type: 'dorsal', light: 56 })
          continue
        }

        // 胸びれ：前方下に後方へ swept した楕円。
        if (y > sy && ((x - fin.cx) / fin.rx) ** 2 + ((y - fin.cy) / fin.ry) ** 2 <= 1) {
          staticCells.push({ x, y, ch: pick(), type: 'fin', light: 50 })
          continue
        }

        // 吻（口先）：頭の前方へ細く長く突き出る三角形（背骨に追従して入水方向へ向く）。
        if (x >= BEAK_BASE_X && x <= BEAK_TIP_X) {
          const frac = (x - BEAK_BASE_X) / (BEAK_TIP_X - BEAK_BASE_X) // 0(付け根)→1(先端)
          const half = BEAK_BASE_HALF * (1 - frac) + 1.2
          if (Math.abs(y - beakY(x)) <= half) {
            staticCells.push({ x, y, ch: pick(), type: 'beak', light: 60 })
            continue
          }
        }
      }
    }

    // --- 尾びれセル（pivot 相対）。左へ向かって三日月状に上下へ広がる ---
    // 先端ほど少し後方（+x 側）へ反らせて三日月形に見せる。
    const flukeCells: FlukeCell[] = []
    for (let gy = 0; gy <= CANVAS_H; gy += CELL) {
      for (let gx = FLUKE_TIP_X; gx <= FLUKE_PIVOT.x; gx += CELL) {
        const x = gx + (Math.random() - 0.5) * CELL * 0.8
        const y = gy + (Math.random() - 0.5) * CELL * 0.8
        const frac = (FLUKE_PIVOT.x - x) / (FLUKE_PIVOT.x - FLUKE_TIP_X) // 0(軸)→1(先端)
        if (frac < 0 || frac > 1) continue
        const spread = 7 + 50 * frac // 先端ほど上下へ広がる
        const inner = 2 + 6 * frac // 中央のくびれ
        const dyAbs = Math.abs(y - FLUKE_PIVOT.y)
        if (dyAbs >= inner && dyAbs <= spread) {
          // 三日月：先端付近を少し後方へ反らせる（軸からの相対 x に補正を足す）。
          const curve = 10 * frac * frac
          flukeCells.push({ rx: x - FLUKE_PIVOT.x + curve, ry: y - FLUKE_PIVOT.y, ch: pick() })
        }
      }
    }

    // --- 静止部分をオフスクリーンに1枚だけ描いてキャッシュ ---
    let off: HTMLCanvasElement | null = null
    let dpr = 1
    const fillFor = (o: CanvasRenderingContext2D, type: StaticType, light: number): void => {
      if (type === 'eye') o.fillStyle = 'rgba(255, 255, 255, 0.95)'
      else if (type === 'belly') o.fillStyle = `hsla(${HUE}, 32%, ${light}%, 0.92)`
      else if (type === 'melon') o.fillStyle = `hsla(${HUE}, 50%, ${light + 6}%, 0.92)`
      else if (type === 'beak') o.fillStyle = `hsla(${HUE}, 48%, ${light}%, 0.92)`
      else if (type === 'dorsal') o.fillStyle = `hsla(${HUE}, 60%, ${light}%, 0.92)`
      else if (type === 'fin') o.fillStyle = `hsla(${HUE}, 58%, ${light}%, 0.92)`
      else o.fillStyle = `hsla(${HUE}, 60%, ${light}%, 0.92)`
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
      o.shadowColor = 'rgba(140, 200, 255, 0.5)'
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

    // 1フレーム：体キャッシュを転写し、尾びれ（pivot 周りの回転）を上描きする。
    const render = (ms: number): void => {
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
      if (off) ctx.drawImage(off, 0, 0, CANVAS_W, CANVAS_H)

      // 尾びれ：pivot 周りに上下はためき（sin で振らす）。
      const ang = FLUKE_AMP * Math.sin((ms / FLUKE_PERIOD) * Math.PI * 2)
      const cos = Math.cos(ang)
      const sin = Math.sin(ang)
      ctx.shadowColor = 'rgba(140, 200, 255, 0.5)'
      ctx.shadowBlur = 5
      ctx.fillStyle = `hsla(${HUE}, 58%, 54%, 0.92)`
      for (const f of flukeCells) {
        const x = FLUKE_PIVOT.x + f.rx * cos - f.ry * sin
        const y = FLUKE_PIVOT.y + f.rx * sin + f.ry * cos
        ctx.fillText(f.ch, x, y)
      }
      ctx.shadowBlur = 0
      rafId = requestAnimationFrame(render)
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let rafId = 0
    if (reduced) {
      // モーション抑制時：尾びれを動かさず1枚だけ描く。
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
      if (off) ctx.drawImage(off, 0, 0, CANVAS_W, CANVAS_H)
      ctx.shadowColor = 'rgba(140, 200, 255, 0.5)'
      ctx.shadowBlur = 5
      ctx.fillStyle = `hsla(${HUE}, 58%, 54%, 0.92)`
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
    <div className={styles.dolphin} data-visible={visible} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  )
}
