'use client'

import { useEffect, useRef, useState } from 'react'
import { db, ref, onValue, off } from '@/lib/firebase'
import type { Declaration } from '@/types'
import Tree from '@/components/vision/Tree'
import styles from './page.module.scss'

export default function VisionPage() {
  const [declarations, setDeclarations] = useState<Declaration[]>([])
  // 登録時と解除時で同一の ref インスタンスを使うため useRef で保持する。
  const dbRef = useRef(ref(db, 'declarations'))

  useEffect(() => {
    const declarationsRef = dbRef.current
    onValue(
      declarationsRef,
      (snapshot) => {
        const data = snapshot.val()
        if (!data) {
          // データが無ければ空状態を反映する（全件非表示/削除でも一覧とカウンターをリセット）。
          setDeclarations([])
          return
        }
        const list: Declaration[] = Object.entries(data)
          .map(([id, val]) => ({ id, ...(val as Omit<Declaration, 'id'>) }))
          .filter((d) => d.isVisible) // 表示対象（isVisible: true）のみ描画・カウントする
          .sort((a, b) => a.timestamp - b.timestamp)
        setDeclarations(list)
      },
      (error) => {
        // 購読エラーを握りつぶさない（無音で止まるのを防ぐ）。
        console.error('宣言の購読に失敗しました:', error)
      }
    )
    // メモリリーク対策：アンマウント時にリスナーを解除する。
    return () => off(declarationsRef)
  }, [])

  return (
    <div className={styles.container}>
      <Tree declarations={declarations} />
      <div className={styles.counter} aria-live="polite">
        {declarations.length.toLocaleString()}人が宣言しました
      </div>
    </div>
  )
}
