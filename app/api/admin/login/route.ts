import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_PASSWORD_ENV } from '@/lib/constants'

// 管理画面のログイン。パスワードは**サーバー側だけ**で照合し、クライアントには出さない。
// （NEXT_PUBLIC_ を使うとパスワードがクライアントバンドルに露出するため使わない）
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await request.json()
    const password =
      typeof body === 'object' && body !== null && 'password' in body && typeof body.password === 'string'
        ? body.password
        : ''

    const expected = process.env[ADMIN_PASSWORD_ENV]
    // 環境変数が未設定・空のときは誤って通さない（無音で素通りさせない）。
    if (!expected) {
      console.error(`${ADMIN_PASSWORD_ENV} が未設定です。ログインを許可しません。`)
      return NextResponse.json({ success: false }, { status: 500 })
    }

    if (password.length > 0 && password === expected) {
      return NextResponse.json({ success: true }, { status: 200 })
    }
    return NextResponse.json({ success: false }, { status: 401 })
  } catch (error) {
    console.error('ログイン処理に失敗しました:', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}

// POST以外は許可しない（PUT/DELETE/PATCH は Next.js が自動で 405 を返す）
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ message: 'Method Not Allowed' }, { status: 405 })
}
