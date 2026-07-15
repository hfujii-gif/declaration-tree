'use client'

import { useState, useSyncExternalStore } from 'react'
import DeclarationList from '@/components/admin/DeclarationList'
import NgWordManager from '@/components/admin/NgWordManager'
import DecorationManager from '@/components/admin/DecorationManager'
import CanopyLayersManager from '@/components/admin/CanopyLayersManager'
import styles from './page.module.scss'

// localStorage に保存する認証フラグのキー。リロード後も認証を維持するために使う。
// ※ あくまで簡易ゲート（クライアントで書き換え可能）。パスワード自体はサーバー側でのみ照合する。
const AUTH_KEY = 'adminAuth'

// localStorage の認証フラグをハイドレーション安全に読む（/vision の ?stage= と同じ方針）。
// サーバーでは false、クライアントでのみ localStorage を参照し、React が安全に差し替える。
const subscribeAuth = (): (() => void) => () => {}
const getStoredAuth = (): boolean => localStorage.getItem(AUTH_KEY) === 'true'
const getServerStoredAuth = (): boolean => false

export default function AdminPage() {
  // リロード後の復元（クライアントで localStorage を読む）。
  const storedAuth = useSyncExternalStore(subscribeAuth, getStoredAuth, getServerStoredAuth)
  // このセッション内でのログイン/ログアウト。null のあいだは復元値（storedAuth）に従う。
  const [sessionAuth, setSessionAuth] = useState<boolean | null>(null)
  const isAuthenticated = sessionAuth ?? storedAuth

  const [password, setPassword] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [error, setError] = useState('')
  // 左サイドバーで切り替える表示タブ。
  const [tab, setTab] = useState<'declarations' | 'ngwords' | 'decorations'>('declarations')
  // サイドバーの開閉状態。
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const handleLogin = async (): Promise<void> => {
    if (password.length === 0 || isLoggingIn) return
    setIsLoggingIn(true)
    setError('')
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = (await res.json()) as { success?: boolean }
      if (res.ok && data.success) {
        localStorage.setItem(AUTH_KEY, 'true')
        setSessionAuth(true)
        setPassword('')
      } else {
        setError('パスワードが違います')
      }
    } catch (e) {
      console.error('ログインに失敗しました:', e)
      setError('ログインに失敗しました。通信状態を確認してください。')
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleLogout = (): void => {
    localStorage.removeItem(AUTH_KEY)
    setSessionAuth(false)
  }

  if (!isAuthenticated) {
    return (
      <div className={styles.loginContainer}>
        <div className={styles.loginCard}>
          <h1 className={styles.loginTitle}>管理画面ログイン</h1>
          <input
            type="password"
            className={styles.passwordInput}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleLogin()
            }}
            placeholder="パスワード"
            autoFocus
          />
          {error && <p className={styles.loginError}>{error}</p>}
          <button
            type="button"
            className={styles.loginButton}
            onClick={handleLogin}
            disabled={password.length === 0 || isLoggingIn}
          >
            {isLoggingIn ? 'ログイン中…' : 'ログイン'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`${styles.container} ${sidebarOpen ? '' : styles.collapsed}`}>
      <aside className={styles.sidebar}>
        <button
          type="button"
          className={styles.menuToggle}
          onClick={() => setSidebarOpen((v) => !v)}
          aria-label={sidebarOpen ? 'メニューを閉じる' : 'メニューを開く'}
          aria-expanded={sidebarOpen}
        >
          {sidebarOpen ? '◀' : '▶'}
        </button>
        <div className={styles.brand}>
          宣言ツリー
          <span className={styles.brandSub}>管理画面</span>
        </div>
        <nav className={styles.nav}>
          <button
            type="button"
            className={`${styles.navItem} ${tab === 'declarations' ? styles.navItemActive : ''}`}
            onClick={() => setTab('declarations')}
          >
            宣言一覧
          </button>
          <button
            type="button"
            className={`${styles.navItem} ${tab === 'ngwords' ? styles.navItemActive : ''}`}
            onClick={() => setTab('ngwords')}
          >
            NGワード管理
          </button>
          <button
            type="button"
            className={`${styles.navItem} ${tab === 'decorations' ? styles.navItemActive : ''}`}
            onClick={() => setTab('decorations')}
          >
            演出 ON/OFF
          </button>
        </nav>
      </aside>

      <main className={styles.main}>
        <div className={styles.mainHeader}>
          <h1 className={styles.pageTitle}>
            {tab === 'declarations' ? '宣言一覧' : tab === 'ngwords' ? 'NGワード管理' : '演出 ON/OFF'}
          </h1>
          <button type="button" className={styles.logoutButton} onClick={handleLogout}>
            ログアウト
          </button>
        </div>
        <div className={styles.panel}>
          {tab === 'declarations' ? (
            <DeclarationList />
          ) : tab === 'ngwords' ? (
            <NgWordManager />
          ) : (
            <>
              <DecorationManager />
              <CanopyLayersManager />
            </>
          )}
        </div>
      </main>
    </div>
  )
}
