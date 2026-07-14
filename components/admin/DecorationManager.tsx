'use client'

import { useEffect, useState } from 'react'
import { db, ref, onValue, update } from '@/lib/firebase'
import {
  DECORATIONS,
  DEFAULT_DECORATIONS,
  normalizeDecorations,
  type DecorationKey,
  type DecorationSettings,
} from '@/lib/constants'
import styles from './DecorationManager.module.scss'

// /vision の装飾演出（#55）の ON/OFF を管理する。Firebase settings/decorations に真偽値で保存し、
// /vision はこれを購読して即座に表示/非表示を切り替える。未設定キーは ON 扱い（デフォルト ON）。
export default function DecorationManager() {
  const [settings, setSettings] = useState<DecorationSettings>(DEFAULT_DECORATIONS)
  const [error, setError] = useState('')

  useEffect(() => {
    const decorationsRef = ref(db, 'settings/decorations')
    const unsubscribe = onValue(
      decorationsRef,
      (snapshot) => {
        setSettings(normalizeDecorations(snapshot.val()))
        setError('')
      },
      (e) => {
        console.error('装飾設定の購読に失敗しました:', e)
        setError('装飾設定の読み込みに失敗しました。')
      }
    )
    return () => unsubscribe()
  }, [])

  const toggle = async (key: DecorationKey, next: boolean): Promise<void> => {
    // 楽観的更新（onValue で確定値が上書きされる）。
    setSettings((prev) => ({ ...prev, [key]: next }))
    setError('')
    try {
      await update(ref(db, 'settings/decorations'), { [key]: next })
    } catch (e) {
      console.error('装飾設定の更新に失敗しました:', e)
      setError('装飾設定の保存に失敗しました。')
    }
  }

  return (
    <div className={styles.wrap}>
      {error && <p className={styles.error}>{error}</p>}
      <p className={styles.subLabel}>大型ビジョンに表示する装飾演出を個別に切り替えます（既定はすべて ON）。</p>
      <ul className={styles.list}>
        {DECORATIONS.map((d) => (
          <li key={d.key} className={styles.row}>
            <span className={styles.label}>{d.label}</span>
            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={settings[d.key]}
                onChange={(e) => toggle(d.key, e.target.checked)}
              />
              <span className={styles.slider} aria-hidden="true" />
              <span className={styles.state}>{settings[d.key] ? 'ON' : 'OFF'}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}
