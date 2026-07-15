'use client'

import { useEffect, useState } from 'react'
import { db, ref, onValue } from '@/lib/firebase'
import { CANOPY_LAYERS_DEFAULT, normalizeCanopyLayers } from '@/lib/constants'

// /vision で樹冠の葉の重なり密度（#60）を Firebase（settings/canopyLayers）から購読する。
// 未設定・読み込み失敗・不正値は既定（3）にフォールバックする。管理画面での変更に即追従する。
// メモリリーク対策：onValue のリスナーをクリーンアップで必ず解除する。
export function useCanopyLayers(): number {
  const [layers, setLayers] = useState<number>(CANOPY_LAYERS_DEFAULT)

  useEffect(() => {
    const layersRef = ref(db, 'settings/canopyLayers')
    const unsubscribe = onValue(
      layersRef,
      (snapshot) => setLayers(normalizeCanopyLayers(snapshot.val())),
      (error) => {
        console.error('樹冠の葉密度設定の購読に失敗しました:', error)
        // 失敗時は既定（3）のままにし、樹冠が消えないようにする。
      }
    )
    return () => unsubscribe()
  }, [])

  return layers
}
