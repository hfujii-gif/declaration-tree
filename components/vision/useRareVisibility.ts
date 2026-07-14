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

    // 確認用プレビュー：URL に ?preview が付いていれば休止を数秒に短縮し、すぐ繰り返し出す。
    // パラメータが無ければ従来どおり（本番に影響しない）。当日のデバッグにも使える。
    const preview =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).has('preview')
    const hMin = preview ? 2000 : hiddenMinMs
    const hMax = preview ? 5000 : hiddenMaxMs
    const first = preview ? 800 : firstDelayMs ?? rand(hiddenMinMs, hiddenMaxMs)

    const hide = (): void => {
      setVisible(false)
      timer = setTimeout(show, rand(hMin, hMax))
    }
    const show = (): void => {
      setVisible(true)
      timer = setTimeout(hide, activeMs)
    }

    timer = setTimeout(show, first)
    return () => clearTimeout(timer)
  }, [activeMs, hiddenMinMs, hiddenMaxMs, firstDelayMs])

  return visible
}
