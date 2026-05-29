'use client'

import { useEffect, useState } from 'react'
import { db, ref, onValue, set } from '@/lib/firebase'
import { DEFAULT_NG_WORDS } from '@/lib/ngWords'
import styles from './NgWordManager.module.scss'

// 管理対象は Firebase settings/ngWords（追加リスト）のみ。
// DEFAULT_NG_WORDS はコード固定で常時有効なので、ここでは参考表示（編集不可）にとどめる。
// /input は settings/ngWords を購読済みのため、追加・削除はバリデーションに即反映される。
export default function NgWordManager() {
  const [ngWords, setNgWords] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const ngWordsRef = ref(db, 'settings/ngWords')
    const unsubscribe = onValue(
      ngWordsRef,
      (snapshot) => {
        // RTDB は配列を疎なときオブジェクトで返すことがあるため、配列以外は [] にフォールバックする。
        const value: unknown = snapshot.val()
        setNgWords(Array.isArray(value) ? value.filter((w): w is string => typeof w === 'string') : [])
        setError('')
      },
      (e) => {
        console.error('NGワードの購読に失敗しました:', e)
        setError('NGワードの読み込みに失敗しました。')
      }
    )
    return () => unsubscribe()
  }, [])

  const addWord = async (): Promise<void> => {
    const word = input.trim()
    if (word.length === 0) return
    // 重複判定は実際の検閲（containsNgWord）に合わせて小文字化・大小文字無視で揃える。
    if (ngWords.some((w) => w.toLowerCase() === word.toLowerCase())) {
      setError('すでに登録されています。')
      return
    }
    setError('')
    try {
      await set(ref(db, 'settings/ngWords'), [...ngWords, word])
      setInput('')
    } catch (e) {
      console.error('NGワードの追加に失敗しました:', e)
      setError('NGワードの追加に失敗しました。')
    }
  }

  const removeWord = async (word: string): Promise<void> => {
    setError('')
    try {
      await set(
        ref(db, 'settings/ngWords'),
        ngWords.filter((w) => w !== word)
      )
    } catch (e) {
      console.error('NGワードの削除に失敗しました:', e)
      setError('NGワードの削除に失敗しました。')
    }
  }

  return (
    <div className={styles.wrap}>
      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.addRow}>
        <input
          type="text"
          className={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addWord()
          }}
          placeholder="追加するNGワード"
        />
        <button
          type="button"
          className={styles.addButton}
          onClick={addWord}
          disabled={input.trim().length === 0}
        >
          追加
        </button>
      </div>

      <p className={styles.subLabel}>追加済みのNGワード（{ngWords.length}）</p>
      {ngWords.length === 0 ? (
        <p className={styles.empty}>追加されたNGワードはありません。</p>
      ) : (
        <ul className={styles.list}>
          {ngWords.map((w) => (
            <li key={w} className={styles.chip}>
              <span>{w}</span>
              <button
                type="button"
                className={styles.removeButton}
                onClick={() => removeWord(w)}
                aria-label={`${w} を削除`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <details className={styles.defaults}>
        <summary>既定のNGワード（{DEFAULT_NG_WORDS.length}・編集不可）</summary>
        <p className={styles.defaultsList}>{DEFAULT_NG_WORDS.join('、')}</p>
      </details>
    </div>
  )
}
