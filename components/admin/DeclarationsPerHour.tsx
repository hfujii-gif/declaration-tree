'use client'

import { useEffect, useState } from 'react'
import { db, ref, onValue } from '@/lib/firebase'
import type { Declaration } from '@/types'
import styles from './DeclarationsPerHour.module.scss'

// 1時間あたりの宣言数（#70）。/declarations の isVisible=true を timestamp で1時間ごとに集計し棒グラフで表示する。
// 直近 HOURS 時間ぶんを連続表示（データの無い時間帯は0の棒）。
const HOURS = 24
const HOUR_MS = 3_600_000

type Bar = { hourStart: number; count: number }

// 表示サイズ（viewBox。実表示は幅100%）。
const W = 720
const H = 240
const PAD_L = 44
const PAD_R = 12
const PAD_T = 16
const PAD_B = 30

export default function DeclarationsPerHour() {
  const [bars, setBars] = useState<Bar[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    const declarationsRef = ref(db, 'declarations')
    const unsubscribe = onValue(
      declarationsRef,
      (snapshot) => {
        const data = snapshot.val()
        // 現在の正時（UTC正時＝JST等の整数時オフセットでは現地:00に一致）を基準に直近HOURS分のバケットを用意。
        const currentHour = Math.floor(Date.now() / HOUR_MS) * HOUR_MS
        const startHour = currentHour - (HOURS - 1) * HOUR_MS
        const counts = new Map<number, number>()
        for (let h = startHour; h <= currentHour; h += HOUR_MS) counts.set(h, 0)
        if (data) {
          for (const value of Object.values(data)) {
            const d = value as Omit<Declaration, 'id'>
            if (!d.isVisible || typeof d.text !== 'string' || typeof d.timestamp !== 'number') continue
            const bucket = Math.floor(d.timestamp / HOUR_MS) * HOUR_MS
            if (bucket >= startHour && bucket <= currentHour) {
              counts.set(bucket, (counts.get(bucket) ?? 0) + 1)
            }
          }
        }
        const next: Bar[] = []
        for (let h = startHour; h <= currentHour; h += HOUR_MS) next.push({ hourStart: h, count: counts.get(h) ?? 0 })
        setBars(next)
        setError('')
      },
      (e) => {
        console.error('宣言数の集計に失敗しました:', e)
        setError('宣言数の集計に失敗しました。')
      }
    )
    return () => unsubscribe()
  }, [])

  const total = bars.reduce((sum, b) => sum + b.count, 0)
  const maxCount = bars.reduce((m, b) => Math.max(m, b.count), 0)
  const yMax = Math.max(1, Math.ceil((maxCount * 1.1) / 5) * 5) // 上に少し余白＋5刻みの見やすい上限
  const plotW = W - PAD_L - PAD_R
  const plotH = H - PAD_T - PAD_B
  const baseY = PAD_T + plotH
  const slot = plotW / bars.length || plotW
  const barW = slot * 0.68

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <h2 className={styles.title}>1時間あたりの宣言数</h2>
        <span className={styles.sub}>直近{HOURS}時間 ・ 合計 {total} 件</span>
      </div>
      {error && <p className={styles.error}>{error}</p>}

      {total === 0 ? (
        <p className={styles.empty}>直近{HOURS}時間の宣言はまだありません。</p>
      ) : (
        <svg className={styles.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="1時間あたりの宣言数の棒グラフ">
          {/* Y軸グリッド＋目盛り（4分割） */}
          {[0, 1, 2, 3, 4].map((i) => {
            const v = (yMax * i) / 4
            const y = baseY - (v / yMax) * plotH
            return (
              <g key={i}>
                <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} className={styles.grid} />
                <text x={PAD_L - 8} y={y + 4} className={styles.ytick}>
                  {Math.round(v)}
                </text>
              </g>
            )
          })}
          {/* 棒＋ホバーツールチップ（native title）＋X軸ラベル */}
          {bars.map((b, i) => {
            const barH = (b.count / yMax) * plotH
            const x = PAD_L + i * slot + (slot - barW) / 2
            const y = baseY - barH
            const hour = new Date(b.hourStart).getHours()
            const showXLabel = i % 4 === 0 || i === bars.length - 1
            return (
              <g key={b.hourStart}>
                <rect x={x} y={y} width={barW} height={barH} rx={Math.min(3, barW / 2)} className={styles.bar}>
                  <title>{`${hour}時台 ${b.count}件`}</title>
                </rect>
                {showXLabel && (
                  <text x={x + barW / 2} y={H - 10} className={styles.xtick}>
                    {hour}時
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}
