'use client'

import { useEffect, useMemo, useRef } from 'react'
import { gsap } from 'gsap'
import { COUNTER_DIGITS, COUNTER_ROLL_MS, COUNTER_ROLL_STAGGER_MS } from '@/lib/constants'
import styles from './Counter.module.scss'

type CounterProps = {
  // 表示する累計件数（isVisible=true の件数）。負値・非整数は 0・整数へ丸めて扱う。
  value: number
}

// 各桁リールは 9→0 の降順を3ブロック並べた計30セル。降順にすることで「増加＝新しい数字が上から入り、
// 古い数字が下へ抜ける」（Issue の「上→下」）動きになる。中央ブロック（index 10〜19）を「定位置（ホーム）」とし、
// そこから上下どちらへも最大10ステップ回せる余白を持たせる（桁上がり=順回転／減少=逆回転を破綻なく見せる）。
const BLOCK = 10
const CELLS = BLOCK * 3 // 30セル
const STEP_PERCENT = 100 / CELLS // 1セル分の yPercent（リール全体の高さ基準）

// リールに敷く数字（9→0 の降順を3回）。全桁で同一内容。transform だけ桁ごとに変える。
const REEL_CELLS: number[] = Array.from({ length: CELLS }, (_, j) => BLOCK - 1 - (j % BLOCK))

// 降順リールでの digit の定位置（中央ブロック）index：19 - digit（block1 は index 10〜19）。
const homeIndex = (digit: number): number => 2 * BLOCK - 1 - digit
// 定位置（ホーム）の yPercent。
const homePercent = (digit: number): number => -homeIndex(digit) * STEP_PERCENT

// value を COUNTER_DIGITS 桁のゼロ埋め数字配列にする（例：42 → [0,0,0,4,2]）。
// 桁あふれ（想定外に大きい値）でも先頭が欠けないよう、桁数は max(COUNTER_DIGITS, 実際の桁数) を確保する。
const toDigits = (value: number): number[] => {
  const safe = Math.max(0, Math.floor(value))
  const text = String(safe).padStart(COUNTER_DIGITS, '0')
  return text.split('').map((c) => Number(c))
}

// /vision 下部の機械式オドメーター・カウンター（#58）。
// value が変わると、変化した桁だけがロールして更新される。数字ロジック（isVisible 件数）は親が持ち、本コンポーネントは表示のみ。
// サイズは #56 の --screen-scale に追従。長時間稼働に備え、GSAP Tween は再ロール前・アンマウント時に必ず kill する。
export default function Counter({ value }: CounterProps) {
  const digits = useMemo(() => toDigits(value), [value])
  const digitCount = digits.length

  // 各桁リールの DOM 参照。
  const reelRefs = useRef<(HTMLDivElement | null)[]>([])
  // 各桁で現在コミット済みの表示数字（0〜9）。次回のロール計算の起点にする。
  const curDigitsRef = useRef<number[]>([])
  // 進行中の Tween を桁ごとに保持し、再ロール前・アンマウント時に kill する。
  const tweensRef = useRef<(gsap.core.Tween | null)[]>([])
  // 初回マウントかどうか。初回はロールせず定位置へ即セットする。
  const initializedRef = useRef(false)

  useEffect(() => {
    const reels = reelRefs.current
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // 初回：全桁を定位置へ即セット（アニメーションなし）。
    if (!initializedRef.current) {
      digits.forEach((d, i) => {
        const reel = reels[i]
        if (reel) gsap.set(reel, { yPercent: homePercent(d) })
      })
      curDigitsRef.current = [...digits]
      initializedRef.current = true
      return
    }

    // 値の増減で回転方向を決める（増加=順回転、減少=逆回転）。
    const prev = curDigitsRef.current
    const prevValue = prev.reduce((acc, d) => acc * 10 + d, 0)
    const nextValue = digits.reduce((acc, d) => acc * 10 + d, 0)
    const increasing = nextValue >= prevValue

    digits.forEach((target, i) => {
      const cur = prev[i] ?? target
      const reel = reels[i]
      if (!reel) return
      if (target === cur) return // 変化なしの桁はロールしない

      // 進行中の Tween を止め、いったん現在数字の定位置へ補正してから回す（多重再生・中途半端な位置を防ぐ）。
      tweensRef.current[i]?.kill()
      gsap.set(reel, { yPercent: homePercent(cur) })

      // reduced-motion：ロールせず定位置へ即切替。
      if (reduced) {
        gsap.set(reel, { yPercent: homePercent(target) })
        return
      }

      // 目標セルの index を回転方向に合わせて選ぶ（降順リール。中央ブロック=index10〜19が定位置）。
      //  増加：新しい数字を上から入れる＝リールを下へ動かす＝index を減らす方向。
      //        target≧cur は中央ブロック（19-target）、桁上がり（target<cur）は下のブロック（9-target）へ回し切る。
      //  減少：逆回転＝index を増やす方向。target≦cur は中央ブロック（19-target）、
      //        繰り下がり（target>cur）は上のブロック（29-target）へ回し切る。
      const targetIndex = increasing
        ? target >= cur
          ? homeIndex(target)
          : BLOCK - 1 - target
        : target <= cur
          ? homeIndex(target)
          : 3 * BLOCK - 1 - target

      // 桁ごとに開始を少しずらす（下位桁＝右から先に動かして機械式の連鎖感を出す）。
      const delayIndex = digitCount - 1 - i
      tweensRef.current[i] = gsap.to(reel, {
        yPercent: -targetIndex * STEP_PERCENT,
        duration: COUNTER_ROLL_MS / 1000,
        delay: (delayIndex * COUNTER_ROLL_STAGGER_MS) / 1000,
        ease: 'power2.inOut',
        onComplete: () => {
          // 回し切ったら定位置（中央ブロック）へ瞬間リセットし、次回のロール余白を確保する。
          gsap.set(reel, { yPercent: homePercent(target) })
          tweensRef.current[i] = null
        },
      })
    })

    curDigitsRef.current = [...digits]
  }, [digits, digitCount])

  // アンマウント時：進行中の Tween をすべて kill（長時間稼働のメモリリーク対策）。
  useEffect(() => {
    const tweens = tweensRef.current
    return () => {
      tweens.forEach((t) => t?.kill())
    }
  }, [])

  return (
    <div className={styles.counter} aria-hidden="true">
      <div className={styles.panel}>
        <span className={styles.label}>宣言数</span>
        <div className={styles.digits}>
          {digits.map((_, i) => (
            <div className={styles.reelWindow} key={i}>
              <div
                className={styles.reel}
                ref={(el) => {
                  reelRefs.current[i] = el
                }}
              >
                {REEL_CELLS.map((n, j) => (
                  <div className={styles.cell} key={j}>
                    {n}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <span className={styles.unit}>人</span>
        </div>
      </div>
    </div>
  )
}
