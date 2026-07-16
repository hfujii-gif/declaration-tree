'use client'

import { useEffect, useState } from 'react'
import { db, ref, onValue } from '@/lib/firebase'
import { VISION_OFFLINE_THRESHOLD_MS } from '@/lib/constants'
import type { VisionStatus } from '@/types'
import styles from './VisionMonitor.module.scss'

// /vision の稼働状況モニタリング（#70）。/vision が settings/visionStatus に定期書き込みする状態を購読して表示する。
// 接続判定は updatedAt（サーバー時刻）の「実年齢」で行う。クロック差は /.info/serverTimeOffset で補正するため、
// 管理画面ローカルの時計がずれていても正しく判定でき、古い残留ノードを「稼働中」と誤表示しない（#70 レビュー対応）。
const GROWTH_LABEL = ['小', '中', '大'] as const

export default function VisionMonitor() {
  const [status, setStatus] = useState<VisionStatus | null>(null)
  const [error, setError] = useState('')
  // 毎秒更新する現在時刻。実年齢の再計算・相対時刻の再描画に使う（初期0でハイドレーション不整合を避ける）。
  const [now, setNow] = useState(0)
  // サーバー時刻との差分（serverTime = clientTime + offset）。クロック差の補正に使う。
  const [serverOffset, setServerOffset] = useState(0)

  useEffect(() => {
    const statusRef = ref(db, 'settings/visionStatus')
    const offsetRef = ref(db, '.info/serverTimeOffset')
    const unsubscribeStatus = onValue(
      statusRef,
      (snapshot) => {
        const val = snapshot.val() as VisionStatus | null
        if (val && typeof val.updatedAt === 'number') {
          setStatus(val)
          setError('')
          setNow(Date.now()) // 受信時点で now を更新し、待たずに実年齢を評価できるようにする。
        }
      },
      (e) => {
        console.error('モニタリング情報の取得に失敗しました:', e)
        setError('モニタリング情報の取得に失敗しました。')
      }
    )
    const unsubscribeOffset = onValue(offsetRef, (snapshot) => {
      const v = snapshot.val()
      setServerOffset(typeof v === 'number' ? v : 0)
    })
    // 毎秒 now を更新（実年齢での接続判定・相対時刻の再描画のため）。初回tickは1秒後。
    const timer = setInterval(() => setNow(Date.now()), 1000)

    return () => {
      unsubscribeStatus()
      unsubscribeOffset()
      clearInterval(timer)
    }
  }, [])

  // updatedAt（サーバー時刻）の実年齢で判定する。now===0（初回描画）では判定せず「未接続」側へ倒す。
  const ageMs = status !== null && now > 0 ? now + serverOffset - status.updatedAt : Infinity
  const online = status !== null && now > 0 && ageMs <= VISION_OFFLINE_THRESHOLD_MS
  const secondsAgo = status !== null && now > 0 ? Math.max(0, Math.floor(ageMs / 1000)) : null

  const tile = (label: string, value: string | number, tone?: 'warn' | 'error') => (
    <div className={styles.tile}>
      <div className={styles.tileLabel}>{label}</div>
      <div className={`${styles.tileValue} ${tone === 'warn' ? styles.warn : ''} ${tone === 'error' ? styles.error : ''}`}>
        {value}
      </div>
    </div>
  )

  return (
    <div className={styles.wrap}>
      {error && <p className={styles.errorMsg}>{error}</p>}

      <div className={`${styles.status} ${online ? styles.statusOnline : styles.statusOffline}`}>
        <span className={styles.dot} aria-hidden="true" />
        <span className={styles.statusText}>{online ? 'ビジョン稼働中' : 'ビジョン未接続'}</span>
        <span className={styles.statusSub}>
          {secondsAgo === null ? 'まだ状態を受信していません' : `最終更新 ${secondsAgo} 秒前`}
        </span>
      </div>

      {status ? (
        <div className={styles.tiles}>
          {tile('キュー滞留', status.queueLength, status.queueLength > 0 ? 'warn' : undefined)}
          {tile('ドロップ累計', status.droppedTotal, status.droppedTotal > 0 ? 'error' : undefined)}
          {tile('遅延（実数−表示）', status.lag, status.lag > 0 ? 'warn' : undefined)}
          {tile('スループット', `${status.throughputPerMin} 件/分`)}
          {tile('受信累計', status.receivedTotal)}
          {tile('演出済み累計', status.animatedTotal)}
          {tile('表示 / 実カウント', `${status.displayedCount} / ${status.targetCount}`)}
          {tile('成長段階', GROWTH_LABEL[status.growthLevel] ?? status.growthLevel)}
        </div>
      ) : (
        <p className={styles.subLabel}>/vision を開くと状態が表示されます。</p>
      )}

      <p className={styles.note}>
        ドロップ累計が 0 より大きい場合、混雑で宣言演出が間引かれています（データは保存されカウントには反映されます）。
        キュー滞留・遅延が大きいときはビジョンの表示が実際より遅れています。
      </p>
    </div>
  )
}
