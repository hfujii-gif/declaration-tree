// Firebase の初期化と操作関数を集約する単一の入口。
// 各ファイルで firebase を直接 import・初期化せず、必ずここから import する。
import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, push, onValue, onChildAdded, update, set, off, serverTimestamp } from 'firebase/database'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
}

// 必須の環境変数が欠けている場合は起動時に明示的に失敗させる。
// undefined のまま initializeApp が成功すると DB 操作時まで失敗が表面化せず、
// 本番の env 設定漏れに気付けないため（無音で止まるのを防ぐ）。
const missingEnv = (['apiKey', 'authDomain', 'databaseURL', 'projectId'] as const).filter(
  (key) => !firebaseConfig[key]
)
if (missingEnv.length > 0) {
  throw new Error(`Firebase の環境変数が未設定です: ${missingEnv.join(', ')}`)
}

// Next.js の HMR / SSR による多重初期化を防ぐ
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
const db = getDatabase(app)

export { db, ref, push, onValue, onChildAdded, update, set, off, serverTimestamp }
