'use client'

import { useEffect, useMemo, useState } from 'react'
import { db, ref, onValue, update } from '@/lib/firebase'
import type { Declaration } from '@/types'
import styles from './DeclarationList.module.scss'

// 一度に表示する件数。「もっと見る」で PAGE_SIZE ずつ増やす。
// declarations は最大1万件規模になりうるため、全件を一度にDOMへ出さない。
const PAGE_SIZE = 100

type VisibilityFilter = 'all' | 'visible' | 'hidden'

export default function DeclarationList() {
  const [declarations, setDeclarations] = useState<Declaration[]>([])
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<VisibilityFilter>('all')
  const [limit, setLimit] = useState(PAGE_SIZE)

  // declarations をリアルタイム購読する。長時間稼働を想定し cleanup で必ず解除する。
  useEffect(() => {
    const declarationsRef = ref(db, 'declarations')
    const unsubscribe = onValue(
      declarationsRef,
      (snapshot) => {
        const data: unknown = snapshot.val()
        const list: Declaration[] = []
        if (data && typeof data === 'object') {
          for (const [id, raw] of Object.entries(data as Record<string, unknown>)) {
            if (raw && typeof raw === 'object') {
              const d = raw as { text?: unknown; timestamp?: unknown; isVisible?: unknown }
              if (typeof d.text === 'string') {
                list.push({
                  id,
                  text: d.text,
                  timestamp: typeof d.timestamp === 'number' ? d.timestamp : 0,
                  isVisible: d.isVisible === true,
                })
              }
            }
          }
        }
        // 投稿日時の降順（新しい順）。
        list.sort((a, b) => b.timestamp - a.timestamp)
        setDeclarations(list)
        setError('')
      },
      (e) => {
        console.error('宣言一覧の購読に失敗しました:', e)
        setError('宣言の読み込みに失敗しました。')
      }
    )
    return () => unsubscribe()
  }, [])

  // 物理削除はせず isVisible を切り替える（/vision に即反映される）。
  const toggleVisible = async (id: string, next: boolean): Promise<void> => {
    try {
      await update(ref(db, `declarations/${id}`), { isVisible: next })
    } catch (e) {
      console.error('表示状態の更新に失敗しました:', e)
      setError('表示状態の更新に失敗しました。')
    }
  }

  const formatDate = (ts: number): string => {
    if (!ts) return '—'
    return new Date(ts).toLocaleString('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const totalVisible = declarations.filter((d) => d.isVisible).length
  const totalHidden = declarations.length - totalVisible

  // 検索（部分一致）と表示状態フィルタで絞り込む。
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return declarations.filter((d) => {
      if (filter === 'visible' && !d.isVisible) return false
      if (filter === 'hidden' && d.isVisible) return false
      if (q.length > 0 && !d.text.toLowerCase().includes(q)) return false
      return true
    })
  }, [declarations, query, filter])

  const shown = filtered.slice(0, limit)
  const remaining = filtered.length - shown.length

  return (
    <div className={styles.wrap}>
      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.controls}>
        <input
          type="text"
          className={styles.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="宣言を検索"
        />
        <div className={styles.filters}>
          <button
            type="button"
            className={`${styles.filterButton} ${filter === 'all' ? styles.filterButtonActive : ''}`}
            onClick={() => setFilter('all')}
          >
            すべて
          </button>
          <button
            type="button"
            className={`${styles.filterButton} ${filter === 'visible' ? styles.filterButtonActive : ''}`}
            onClick={() => setFilter('visible')}
          >
            表示中
          </button>
          <button
            type="button"
            className={`${styles.filterButton} ${filter === 'hidden' ? styles.filterButtonActive : ''}`}
            onClick={() => setFilter('hidden')}
          >
            非表示
          </button>
        </div>
      </div>

      <p className={styles.summary}>
        全 {declarations.length} 件（表示中 {totalVisible} / 非表示 {totalHidden}）／該当 {filtered.length} 件
      </p>

      {shown.length === 0 ? (
        <p className={styles.empty}>該当する宣言がありません。</p>
      ) : (
        <ul className={styles.list}>
          {shown.map((d) => (
            <li key={d.id} className={`${styles.row} ${d.isVisible ? '' : styles.hiddenRow}`}>
              <span className={styles.date}>{formatDate(d.timestamp)}</span>
              <span className={styles.text}>{d.text}</span>
              <button
                type="button"
                className={d.isVisible ? styles.hideButton : styles.showButton}
                onClick={() => toggleVisible(d.id, !d.isVisible)}
              >
                {d.isVisible ? '非表示にする' : '再表示する'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {remaining > 0 && (
        <button type="button" className={styles.loadMore} onClick={() => setLimit((l) => l + PAGE_SIZE)}>
          もっと見る（残り {remaining} 件）
        </button>
      )}
    </div>
  )
}
