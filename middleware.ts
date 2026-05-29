import { NextRequest, NextResponse } from 'next/server'

// ステージング限定のサイト全体パスワード保護（HTTP Basic 認証）。
// 環境変数 STAGING_BASIC_AUTH_PASSWORD が設定されている環境でだけ有効になる。
// 本番（イベント当日の /input・/vision・/admin）ではこの環境変数を設定しないため、
// 認証は無効化され通常どおり誰でもアクセスできる（参加者・iPad・大型ビジョンを妨げない）。
//
// 設定方法（Vercel のステージング環境のみ）:
//   STAGING_BASIC_AUTH_PASSWORD … クライアントに伝えるパスワード（必須・これで有効化）
//   STAGING_BASIC_AUTH_USER     … ユーザー名（任意・未設定なら "client"）
// 本番環境には STAGING_BASIC_AUTH_PASSWORD を設定しないこと。
export function middleware(request: NextRequest): NextResponse {
  const expectedPassword = process.env.STAGING_BASIC_AUTH_PASSWORD
  // 未設定なら保護しない（＝本番では無効）。
  if (!expectedPassword) {
    return NextResponse.next()
  }

  const expectedUser = process.env.STAGING_BASIC_AUTH_USER ?? 'client'
  const header = request.headers.get('authorization')

  if (header?.startsWith('Basic ')) {
    try {
      const decoded = atob(header.slice('Basic '.length))
      const separator = decoded.indexOf(':')
      const user = decoded.slice(0, separator)
      const password = decoded.slice(separator + 1)
      if (user === expectedUser && password === expectedPassword) {
        return NextResponse.next()
      }
    } catch {
      // デコード失敗は認証失敗として扱う。
    }
  }

  return new NextResponse('認証が必要です', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Staging", charset="UTF-8"',
    },
  })
}

// 静的アセット・画像最適化・favicon は除外し、ページとAPIを保護対象にする。
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
