'use client'

import { useEffect, useState } from 'react'
import { db, ref, onValue, set } from '@/lib/firebase'
import {
  CANOPY_LAYERS_MIN,
  CANOPY_LAYERS_MAX,
  CANOPY_LAYERS_DEFAULT,
  normalizeCanopyLayers,
} from '@/lib/constants'
import styles from './CanopyLayersManager.module.scss'

// 選択肢（1〜5）。CANOPY_LAYERS_MIN〜MAX から生成する（マジックナンバーを避ける）。
const OPTIONS: number[] = Array.from(
  { length: CANOPY_LAYERS_MAX - CANOPY_LAYERS_MIN + 1 },
  (_, i) => CANOPY_LAYERS_MIN + i
)

// /vision 中央の木の樹冠（極小文字の葉）の重なり密度を管理する（#60）。
// Firebase settings/canopyLayers に 1〜5 の数値で保存し、/vision はこれを購読して樹冠を作り直す。
export default function CanopyLayersManager() {
  const [layers, setLayers] = useState<number>(CANOPY_LAYERS_DEFAULT)
  const [error, setError] = useState('')

  useEffect(() => {
    const layersRef = ref(db, 'settings/canopyLayers')
    const unsubscribe = onValue(
      layersRef,
      (snapshot) => {
        setLayers(normalizeCanopyLayers(snapshot.val()))
        setError('')
      },
      (e) => {
        console.error('樹冠の葉密度設定の購読に失敗しました:', e)
        setError('葉密度設定の読み込みに失敗しました。')
      }
    )
    return () => unsubscribe()
  }, [])

  const select = async (value: number): Promise<void> => {
    // 楽観的更新（onValue で確定値が上書きされる）。
    setLayers(value)
    setError('')
    try {
      await set(ref(db, 'settings/canopyLayers'), value)
    } catch (e) {
      console.error('樹冠の葉密度設定の保存に失敗しました:', e)
      setError('葉密度設定の保存に失敗しました。')
    }
  }

  return (
    <div className={styles.wrap}>
      {error && <p className={styles.error}>{error}</p>}
      <p className={styles.subLabel}>
        中央の木の葉の重なり具合（{CANOPY_LAYERS_MIN}＝控えめ 〜 {CANOPY_LAYERS_MAX}＝モリモリ）。既定は{' '}
        {CANOPY_LAYERS_DEFAULT}。
      </p>
      <div className={styles.options} role="radiogroup" aria-label="葉の重なり">
        {OPTIONS.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            className={`${styles.option} ${value === layers ? styles.optionActive : ''}`}
            aria-checked={value === layers}
            onClick={() => select(value)}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  )
}
