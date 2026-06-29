'use client'

import { useEffect, useState } from 'react'
import { db, ref, onValue } from '@/lib/firebase'
import { DEFAULT_DECORATIONS, normalizeDecorations, type DecorationSettings } from '@/lib/constants'

// /vision で装飾演出（#55）の ON/OFF を Firebase（settings/decorations）から購読する。
// 未設定・読み込み失敗時はデフォルト（全 ON）。管理画面での切替に即追従する。
// メモリリーク対策：onValue のリスナーをクリーンアップで必ず解除する。
export function useDecorationSettings(): DecorationSettings {
  const [settings, setSettings] = useState<DecorationSettings>(DEFAULT_DECORATIONS)

  useEffect(() => {
    const decorationsRef = ref(db, 'settings/decorations')
    const unsubscribe = onValue(
      decorationsRef,
      (snapshot) => setSettings(normalizeDecorations(snapshot.val())),
      (error) => {
        console.error('装飾設定の購読に失敗しました:', error)
        // 失敗時はデフォルト（全 ON）のままにし、演出が消えないようにする。
      }
    )
    return () => unsubscribe()
  }, [])

  return settings
}
