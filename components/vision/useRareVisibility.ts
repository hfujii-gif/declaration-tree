'use client'

import { useEffect, useState } from 'react'

// レア演出（土星・UFO・彗星・ロケット・クジラ #55）の共通出現サイクル。
// 初回出現 → activeMs 表示 → 退場 → hiddenMin〜Max のランダム休止 → 再出現、を繰り返す。
// firstDelayMs を省略すると初回も hiddenMin〜Max のランダム待ちにする（＝最初からレア）。
// 保留中のタイマーは常に1つだけ。アンマウント時に必ず解除する（長時間稼働のメモリリーク対策）。
export function useRareVisibility(opts: {
  activeMs: number
  hiddenMinMs: number
  hiddenMaxMs: number
  firstDelayMs?: number
}): boolean {
  const { activeMs, hiddenMinMs, hiddenMaxMs, firstDelayMs } = opts
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const rand = (min: number, max: number): number => min + Math.random() * (max - min)

    const hide = (): void => {
      setVisible(false)
      timer = setTimeout(show, rand(hiddenMinMs, hiddenMaxMs))
    }
    const show = (): void => {
      setVisible(true)
      timer = setTimeout(hide, activeMs)
    }

    timer = setTimeout(show, firstDelayMs ?? rand(hiddenMinMs, hiddenMaxMs))
    return () => clearTimeout(timer)
  }, [activeMs, hiddenMinMs, hiddenMaxMs, firstDelayMs])

  return visible
}
