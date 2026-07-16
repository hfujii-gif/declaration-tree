'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import QRCode from 'qrcode'
import styles from './QrCodeManager.module.scss'

// リハーサル・当日に iPad から選択画面（準備用メニュー）へ素早くアクセスするための QR コードを表示する。
// URL は表示中のドメイン（window.location.origin）を自動採用するため、ステージング/本番どちらで開いても
// そのデプロイに対応した正しい QR になる。QR 生成はクライアント内で完結し、実行時に外部通信は発生しない。

// 選択画面（準備用メニュー）のパス。ここを起点に各画面へ遷移できる。
const SELECTION_PATH = '/'
// 印刷・スキャンに耐える解像度で生成する（CSS で表示サイズは調整）。
const QR_PIXEL_SIZE = 512

// origin はブラウザでのみ確定するため、ハイドレーション安全に読む（/admin の認証フラグと同じ方針）。
// サーバーでは空文字、クライアントでのみ window を参照し、React が安全に差し替える。
const subscribeOrigin = (): (() => void) => () => {}
const getOrigin = (): string => window.location.origin
const getServerOrigin = (): string => ''

export default function QrCodeManager() {
  const origin = useSyncExternalStore(subscribeOrigin, getOrigin, getServerOrigin)
  // QR がエンコードしている絶対 URL（画面にも文字で表示する）。origin 未確定のあいだは空。
  const targetUrl = origin ? `${origin}${SELECTION_PATH}` : ''

  // 生成した QR の data URL。未生成のあいだは null。
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!targetUrl) return

    let cancelled = false
    QRCode.toDataURL(targetUrl, { width: QR_PIXEL_SIZE, margin: 2 })
      .then((generated) => {
        if (!cancelled) {
          setDataUrl(generated)
          setError('')
        }
      })
      .catch((e) => {
        console.error('QRコードの生成に失敗しました:', e)
        if (!cancelled) setError('QRコードの生成に失敗しました。')
      })

    return () => {
      cancelled = true
    }
  }, [targetUrl])

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(targetUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      console.error('URLのコピーに失敗しました:', e)
      setError('URLのコピーに失敗しました。手動でURLを選択してください。')
    }
  }

  return (
    <div className={styles.wrap}>
      {error && <p className={styles.error}>{error}</p>}
      <p className={styles.subLabel}>
        選択画面（準備用メニュー）のQRコードです。iPadのカメラで読み取ると、この画面を開いているドメインの選択画面が開きます。
      </p>

      <div className={styles.card}>
        {dataUrl ? (
          // 生成済み data URL の表示。外部通信は伴わない。
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.qr} src={dataUrl} alt="選択画面のQRコード" width={QR_PIXEL_SIZE} height={QR_PIXEL_SIZE} />
        ) : (
          !error && <p className={styles.loading}>QRコードを生成中…</p>
        )}

        {targetUrl && (
          <div className={styles.urlRow}>
            <code className={styles.url}>{targetUrl}</code>
            <button type="button" className={styles.copyButton} onClick={handleCopy}>
              {copied ? 'コピーしました' : 'URLをコピー'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
