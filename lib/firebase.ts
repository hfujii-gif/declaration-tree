// Firebase の初期化と操作関数を集約する単一の入口。
// 各ファイルで firebase を直接 import・初期化せず、必ずここから import する。
import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, push, onValue, update, set, off } from 'firebase/database'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
}

// Next.js の HMR / SSR による多重初期化を防ぐ
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
const db = getDatabase(app)

export { db, ref, push, onValue, update, set, off }
