'use client'

import { useEffect, useRef, useState } from 'react'
import { MAX_CHARS, RESET_DELAY_MS } from '@/lib/constants'
import { containsNgWord, DEFAULT_NG_WORDS } from '@/lib/ngWords'
import { db, ref, onValue, off } from '@/lib/firebase'
import type { DeclareRequestBody } from '@/types'
import styles from './DeclarationForm.module.scss'

export default function DeclarationForm() {
  const [text, setText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  // 管理画面(#11)で追加されるNGワード。Firebase settings/ngWords を購読して保持する。
  const [firebaseNgWords, setFirebaseNgWords] = useState<string[]>([])

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // 送信完了後のリセット用タイマー。アンマウント時に確実に破棄するため参照を保持する。
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // マウント時にフォーカスを当てる。
  // iPad Safari ではプログラムからキーボードを自動表示できない（初回はスタッフがタップ）が、
  // 本画面は画面遷移せずオーバーレイ方式のため、一度開いたキーボードは閉じない。
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  // settings/ngWords をリアルタイム購読し、DEFAULT_NG_WORDS とマージして判定に使う。
  // 8時間以上の長時間稼働を想定し、cleanup で必ずリスナーを解除してメモリリークを防ぐ。
  useEffect(() => {
    const ngWordsRef = ref(db, 'settings/ngWords')
    onValue(ngWordsRef, (snapshot) => {
      // RTDB は配列を疎なときオブジェクトで返すことがあり、管理画面(#11)が配列以外で書き込む
      // 可能性もあるため、配列以外は [] にフォールバックしてスプレッド時のクラッシュを防ぐ。
      const value: unknown = snapshot.val()
      setFirebaseNgWords(Array.isArray(value) ? (value as string[]) : [])
    })
    return () => off(ngWordsRef)
  }, [])

  // アンマウント時に未発火のリセットタイマーを破棄する。
  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    }
  }, [])

  const isOverLimit = text.length > MAX_CHARS
  const isTooShort = text.trim().length === 0
  const hasNgWord = containsNgWord(text, [...DEFAULT_NG_WORDS, ...firebaseNgWords])
  const isSubmittable = !isTooShort && !isOverLimit && !hasNgWord && !isSubmitting

  const handleSubmit = async (): Promise<void> => {
    if (!isSubmittable) return
    setIsSubmitting(true)
    setErrorMessage('')
    try {
      const body: DeclareRequestBody = { text: text.trim() }
      const res = await fetch('/api/declare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('送信失敗')
      setIsComplete(true)
      // 完了オーバーレイを一定時間表示したのち、フォームを初期状態に戻す。
      resetTimerRef.current = setTimeout(() => {
        setText('')
        setIsComplete(false)
        setIsSubmitting(false)
        textareaRef.current?.focus()
      }, RESET_DELAY_MS)
    } catch (error) {
      // 送信失敗時はユーザーへ通知し、入力テキストは保持して再送信できる状態を維持する。
      console.error('宣言の送信に失敗しました:', error)
      setErrorMessage('送信に失敗しました。もう一度お試しください。')
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.formArea}>
        <h1 className={styles.title}>明日から取り組む行動を宣言しよう</h1>

        <textarea
          ref={textareaRef}
          className={`${styles.textarea} ${hasNgWord || isOverLimit ? styles.textareaError : ''}`}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            // 送信失敗の通知は再入力を始めたら消す（古いエラーが残り続けないように）。
            if (errorMessage) setErrorMessage('')
          }}
          placeholder="例：毎日30分歩く"
          rows={3}
        />

        <div className={styles.meta}>
          <span className={styles.validationMessage}>
            {hasNgWord
              ? '使用できない言葉が含まれています'
              : isOverLimit
                ? `${MAX_CHARS}文字以内で入力してください`
                : ''}
          </span>
          <span className={`${styles.counter} ${isOverLimit ? styles.counterOver : ''}`}>
            {text.length} / {MAX_CHARS}文字
          </span>
        </div>

        {errorMessage && <p className={styles.errorMessage}>{errorMessage}</p>}

        <button
          type="button"
          className={styles.submitButton}
          onClick={handleSubmit}
          disabled={!isSubmittable}
        >
          宣言する
        </button>
      </div>

      {isComplete && (
        <div className={styles.overlay} aria-live="polite">
          <p className={styles.overlayText}>宣言を受け付けました！</p>
          <p className={styles.overlaySub}>ありがとうございます</p>
        </div>
      )}
    </div>
  )
}
