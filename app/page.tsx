import Link from 'next/link'
import styles from './page.module.scss'

// 準備用のナビ。各画面へすぐ移動できるようにする（スタッフ・リハーサル用）。
const LINKS = [
  { href: '/input', label: '入力画面', desc: 'タブレットで宣言を入力' },
  { href: '/vision', label: 'ビジョン画面', desc: '大型ビジョン表示' },
  { href: '/admin', label: '管理画面', desc: '宣言・NGワードの管理' },
] as const

export default function Home() {
  return (
    <main className={styles.container}>
      <h1 className={styles.title}>宣言ツリー</h1>
      <p className={styles.subtitle}>準備用メニュー</p>
      <nav className={styles.links}>
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} className={styles.linkCard}>
            <span className={styles.linkLabel}>{link.label}</span>
            <span className={styles.linkDesc}>{link.desc}</span>
            <span className={styles.linkPath}>{link.href}</span>
          </Link>
        ))}
      </nav>
    </main>
  )
}
