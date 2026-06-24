'use client'

import { forwardRef, useEffect, useRef } from 'react'
import { MATRIX_GLYPHS, MATRIX_FONT_STACK } from '@/lib/constants'
import styles from './CenterTree.module.scss'

type CenterTreeProps = {
  // 成長段階（0〜4）。累計がマイルストーンを超えるごとに上がる。
  stage: number
  // 10,000人達成後の満開状態。true で樹冠レインの発光が最大化する（#11/#45）。
  // 満開は count>=10000 由来の静的状態。フィナーレ演出は lib/animations.ts の playFullBloom が担当する。
  bloomed?: boolean
}

// 樹冠に流す文字はエコ語の文字（#49）。共有定数 MATRIX_GLYPHS（ひらがな・漢字）を使う。

// 樹冠 canvas の論理サイズ（CSS px）。SVGの木（360×468）の樹冠位置に重ねる。
// stage 拡大・満開発光は CSS（.canopy）が担う。
const CANOPY_W = 500
const CANOPY_H = 380
// 葉＝極小文字のアスキーアート（#53）。エコ語録の文字を密に敷き詰めて葉の形を作り、左→右の虹色にする。
const CELL = 9 // セルの配置ピッチ（極小文字の間隔）
const GLYPH_FONT = 9 // 文字サイズ（極小）。CELL と同等で密に敷いて“葉の粒”に見せる
const HUE_SPAN = 300 // 左→右の虹の色相幅（0=赤 → 300=紫）。多様性（ダイバーシティ）を表す
const TWINKLE_MS = 110 // 通常時の再描画間隔（ms）。毎フレーム描かず間引いて「ほぼ静止＋微かな点滅」にする
const SWAP_RATE = 0.04 // 1tickで文字を差し替えるセルの割合（チラつき）
const SPARKLE_RATE = 0.06 // 1tickで一瞬きらめかせる（白寄りに明るくする）セルの割合

// 葉の塊（ふくらみ）。複数の円を重ねて、横に大きく広がるモリモリの樹冠シルエットを作る（canvas座標。中心 x=250）。
// この円の内側にだけ極小文字の葉セルを敷く（inCrown 判定に使う）。
const CLUMPS = [
  { x: 250, y: 135, r: 148 }, // 中央の大きな塊
  { x: 135, y: 170, r: 115 }, // 左
  { x: 365, y: 170, r: 115 }, // 右
  { x: 68, y: 190, r: 82 }, // 左外
  { x: 432, y: 190, r: 82 }, // 右外
  { x: 250, y: 200, r: 112 }, // 下中央（枝に被さる）
  { x: 175, y: 96, r: 96 }, // 上・左
  { x: 325, y: 96, r: 96 }, // 上・右
  { x: 250, y: 68, r: 84 }, // 頂点
]

// 樹冠の下から垂れ落ちる“雫”（しだれ柳のようなドリップ）。各帯にも葉セルを敷き、
// 葉の下に文字が滴るようなシルエットを作る（inCrown 判定に使う）。
const DRIPS = [
  { x: 92, top: 220, bottom: 298, hw: 7 },
  { x: 120, top: 235, bottom: 320, hw: 9 },
  { x: 175, top: 252, bottom: 342, hw: 8 },
  { x: 215, top: 260, bottom: 352, hw: 9 },
  { x: 250, top: 265, bottom: 360, hw: 10 },
  { x: 285, top: 260, bottom: 352, hw: 9 },
  { x: 325, top: 252, bottom: 342, hw: 8 },
  { x: 380, top: 235, bottom: 320, hw: 9 },
  { x: 408, top: 220, bottom: 298, hw: 7 },
]

// 葉セルを敷く範囲（葉の塊＋ドリップ帯の全体）。色相(左→右)の正規化にも使う。シルエット外は inCrown で除外。
const CROWN_MIN_X = Math.min(
  ...CLUMPS.map((c) => c.x - c.r),
  ...DRIPS.map((d) => d.x - d.hw)
)
const CROWN_MAX_X = Math.max(
  ...CLUMPS.map((c) => c.x + c.r),
  ...DRIPS.map((d) => d.x + d.hw)
)
const CROWN_MIN_Y = Math.min(...CLUMPS.map((c) => c.y - c.r))
const CROWN_MAX_Y = Math.max(
  ...CLUMPS.map((c) => c.y + c.r),
  ...DRIPS.map((d) => d.bottom)
)

// 葉を構成する1セル（極小文字）。位置・色相・基準の明るさは固定。点滅はtickで一時的に付与する。
type Cell = {
  x: number
  y: number
  hue: number // 左→右で割り当てる虹の色相（0〜HUE_SPAN）。
  ch: string // 表示中の文字（配列は使い回し、毎フレーム確保しない）。
  baseAlpha: number // 葉の質感のための基準透明度（セルごとにばらす）。
  sparkle: number // 0〜1。一時的なきらめき量（白寄りに明るくする）。tickで減衰する。
}

// 中央に常設する木（#52で幹・枝はブラウンの画像 tree.png）。樹冠は canvas で描く
// 「エコ語録の極小文字を密に敷き詰めたアスキーアート的な葉」（#53）。
// 葉は左→右の虹色（多様性）で、ほぼ静止しつつ一部の文字がチラつき・きらめく。
//
// 長時間稼働（8時間以上）のメモリリーク対策：
//  - rAF の id を保持し、アンマウント時に必ず cancelAnimationFrame する
//  - タブ非アクティブ時はループを停止し、復帰時に基準時刻をリセット（dtスパイク防止）
//  - セル配列は固定長で使い回し、毎フレームの確保をしない
//  - 通常時は再描画を間引く（毎フレーム描かない＝低負荷）。波紋（#44）中だけ毎フレーム描く
//  - prefers-reduced-motion 時はアニメーションせず静止フレームを1枚だけ描く
//
// stage（data-stage）で樹冠が拡大、満開（data-bloomed）で発光最大化。いずれも CSS が担当する。
// ref は演出（パルス・満開ポップ）と #44 の吸収先座標算出のため親へ公開する。
const CenterTree = forwardRef<HTMLDivElement, CenterTreeProps>(function CenterTree(
  { stage, bloomed = false },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // 樹冠のデジタルレイン（client 専用描画。SSRしないのでハイドレーション不整合なし）。
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const pick = (): string => MATRIX_GLYPHS[(Math.random() * MATRIX_GLYPHS.length) | 0]

    // 葉のシルエット内かどうか（CLUMPS の円、または DRIPS の垂れ帯の和）。
    // この内側だけにセルを置くことで、極小文字の集合が“葉の形”になる。
    const inCrown = (x: number, y: number): boolean => {
      for (const c of CLUMPS) {
        const dx = x - c.x
        const dy = y - c.y
        if (dx * dx + dy * dy <= c.r * c.r) return true
      }
      for (const d of DRIPS) {
        if (x >= d.x - d.hw && x <= d.x + d.hw && y >= d.top && y <= d.bottom) return true
      }
      return false
    }

    // 左→右の虹色（赤→紫）。x 位置で色相を割り当てる（多様性のイメージ）。
    const hueAt = (x: number): number => {
      const span = Math.max(1, CROWN_MAX_X - CROWN_MIN_X)
      return ((x - CROWN_MIN_X) / span) * HUE_SPAN
    }

    // 葉セルのグリッドを作る（初期化時1回）。シルエット内かつ canvas 内のセルだけ採用する。
    // 配列は固定長で使い回し、毎フレームの確保はしない（メモリリーク方針）。
    const cells: Cell[] = []
    for (let y = CROWN_MIN_Y; y <= CROWN_MAX_Y; y += CELL) {
      if (y < 0 || y > CANOPY_H) continue
      for (let x = CROWN_MIN_X; x <= CROWN_MAX_X; x += CELL) {
        if (x < 0 || x > CANOPY_W) continue
        if (!inCrown(x, y)) continue
        cells.push({
          x,
          y,
          hue: hueAt(x),
          ch: pick(),
          baseAlpha: 0.55 + Math.random() * 0.4, // 葉に粗密の質感を出す
          sparkle: Math.random() < 0.3 ? Math.random() : 0,
        })
      }
    }

    // DPR を反映してバッキングストアを設定（高解像度ビジョンでも極小文字をくっきり描く）。
    const setup = (): void => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2) // 負荷対策に上限を設ける
      canvas.width = Math.round(CANOPY_W * dpr)
      canvas.height = Math.round(CANOPY_H * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.font = `700 ${GLYPH_FONT}px ${MATRIX_FONT_STACK}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
    }
    setup()

    // 吸収演出（#44）の波紋。宣言が木に吸い込まれた瞬間、樹冠中央から外へ広がる光の輪。
    // レイン（上→下の流れ）とは別レイヤーの挙動として、通過する文字を一瞬白く強く光らせる。
    const RIPPLE_X = 250 // 樹冠中央（canvas座標）
    const RIPPLE_Y = 150
    const RIPPLE_MAX_AGE = 1200 // 波紋の寿命（ミリ秒）。吸収がゆっくりなのに合わせて広がりも穏やかに。
    const RIPPLE_MAX_R = 260 // 広がりきる半径
    const RIPPLE_BAND = 26 // 前縁の太さ（この帯に入った文字が光る）
    const ripples: { x: number; y: number; age: number }[] = []

    // ある座標が、現在広がっている波紋の前縁にどれだけ近いか（0〜1）。複数の波紋の最大値を返す。
    const rippleBoost = (x: number, y: number): number => {
      let boost = 0
      for (const rp of ripples) {
        const prog = rp.age / RIPPLE_MAX_AGE
        const radius = prog * RIPPLE_MAX_R
        const near = 1 - Math.min(1, Math.abs(Math.hypot(x - rp.x, y - rp.y) - radius) / RIPPLE_BAND)
        if (near > 0) boost = Math.max(boost, near * (1 - prog)) // 末期ほど弱める
      }
      return boost
    }

    // 現在の状態を1フレーム描画する。葉セル（極小文字）を左→右の虹色で敷き詰め、
    // きらめき・吸収波紋（#44）を上乗せする。透明オーバーレイなので毎回クリアする。
    const draw = (): void => {
      ctx.clearRect(0, 0, CANOPY_W, CANOPY_H)
      const hasRipple = ripples.length > 0
      for (const c of cells) {
        const boost = hasRipple ? rippleBoost(c.x, c.y) : 0
        if (boost > 0.04) {
          // 波紋の前縁：吸収の波が通過する瞬間、文字を白く強く光らせる（中央から広がる輪）。
          ctx.shadowColor = 'rgba(235,255,245,0.95)'
          ctx.shadowBlur = 4 + 8 * boost
          ctx.fillStyle = `rgba(240,255,248,${Math.min(1, 0.6 + boost)})`
        } else if (c.sparkle > 0.02) {
          // きらめき：その色相のまま白寄りに明るくして“葉が光る”瞬間を作る。
          const light = 70 + 25 * c.sparkle
          ctx.shadowColor = `hsla(${c.hue}, 100%, 80%, 0.9)`
          ctx.shadowBlur = 6 * c.sparkle
          ctx.fillStyle = `hsla(${c.hue}, 95%, ${light}%, ${Math.min(1, c.baseAlpha + 0.3 * c.sparkle)})`
        } else {
          // 通常の葉：左→右の虹色。彩度・明度を確保して可読性を保つ。
          ctx.shadowBlur = 0
          ctx.fillStyle = `hsla(${c.hue}, 85%, 62%, ${c.baseAlpha})`
        }
        ctx.fillText(c.ch, c.x, c.y)
      }
      ctx.shadowBlur = 0
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let rafId = 0
    let running = false
    let last = 0
    let acc = 0 // 通常時の再描画間引き用の時間アキュムレータ（ms）

    // 通常時の微かな点滅：一部セルの文字を差し替え、一部を一瞬きらめかせ、既存のきらめきを減衰させる。
    const twinkle = (): void => {
      const n = cells.length
      const swaps = (n * SWAP_RATE) | 0
      for (let i = 0; i < swaps; i++) cells[(Math.random() * n) | 0].ch = pick()
      const sparks = (n * SPARKLE_RATE) | 0
      for (let i = 0; i < sparks; i++) {
        cells[(Math.random() * n) | 0].sparkle = 0.6 + Math.random() * 0.4
      }
      for (const c of cells) if (c.sparkle > 0) c.sparkle = Math.max(0, c.sparkle - 0.25)
    }

    const tick = (now: number): void => {
      if (!last) last = now
      let dt = now - last
      last = now
      if (dt > 100) dt = 100 // タブ復帰時などの巨大 dt を抑える（一気に飛ばさない）

      if (ripples.length > 0) {
        // 吸収中：波紋の寿命を進め、毎フレーム滑らかに描画する（短時間・低頻度）。
        for (let i = ripples.length - 1; i >= 0; i--) {
          ripples[i].age += dt
          if (ripples[i].age >= RIPPLE_MAX_AGE) ripples.splice(i, 1)
        }
        draw()
        acc = 0
      } else {
        // 通常時：間引いて点滅＋再描画する（毎フレーム描かない＝ほぼ静止・低負荷）。
        acc += dt
        if (acc >= TWINKLE_MS) {
          acc = 0
          twinkle()
          draw()
        }
      }
      rafId = requestAnimationFrame(tick)
    }

    const start = (): void => {
      if (running) return
      running = true
      last = 0 // 再開時は基準時刻をリセットして dt スパイクを防ぐ
      acc = TWINKLE_MS // 開始直後に一度描く
      rafId = requestAnimationFrame(tick)
    }
    const stop = (): void => {
      running = false
      if (rafId) cancelAnimationFrame(rafId)
      rafId = 0
    }

    if (reduced) {
      // モーション抑制設定では点滅させず静止画を1枚だけ描く（rAF を回さない）。
      draw()
    } else {
      start()
    }

    // タブ非アクティブ時はループ停止、復帰時に再開（基準時刻リセット込み）。
    const onVisibility = (): void => {
      if (document.hidden) stop()
      else if (!reduced) start()
    }
    document.addEventListener('visibilitychange', onVisibility)

    // 吸収演出（#44）からの波紋トリガー。宣言が木に届いた瞬間、樹冠中央から波紋を1つ広げる。
    // playDeclaration が canopy（この canvas）に 'vision:absorb' を dispatch する。
    const onAbsorb = (): void => {
      if (reduced) return
      ripples.push({ x: RIPPLE_X, y: RIPPLE_Y, age: 0 })
      if (!running && !document.hidden) start() // 念のため停止中なら再開
    }
    canvas.addEventListener('vision:absorb', onAbsorb)

    // DPR が変わる環境変化（別モニタへの移動など）に追従して再設定し描き直す。
    const onResize = (): void => {
      setup()
      draw()
    }
    window.addEventListener('resize', onResize)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
      canvas.removeEventListener('vision:absorb', onAbsorb)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <div
      ref={ref}
      className={styles.treeWrap}
      data-stage={stage}
      data-bloomed={bloomed}
      aria-hidden="true"
    >
      {/* 内側ラッパー：マイルストーンのパルス（pulseTree）はこの要素を拡大→戻すため、
          幹・枝（画像）と樹冠レイン（canvas）が一体でパルスする。 */}
      <div className={styles.treeInner} data-tree-inner="true">
        {/* 幹・枝＝裸の木の画像（#52）。旧・発光SVGから差し替え。
            装飾用の静的画像で最適化不要・object-fit で表示制御するため素の <img> を使う。 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.tree} src="/images/tree.png" alt="" />

        {/* 樹冠＝エコ語録の極小文字によるアスキーアート的な葉（#53）。左→右の虹色（多様性）。
            canvas で描画し、ほぼ静止＋微かな点滅。#44 のパーティクル吸収先でもある。
            stage で拡大・満開で発光最大化（CSS）。data-canopy は #44 が吸収先の中心座標を算出するフック。 */}
        <canvas ref={canvasRef} className={styles.canopy} data-canopy="true" />
      </div>
    </div>
  )
})

export default CenterTree
