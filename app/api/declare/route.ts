import { NextRequest, NextResponse } from 'next/server'
import { db, ref, push, serverTimestamp } from '@/lib/firebase'
import { containsNgWord, DEFAULT_NG_WORDS } from '@/lib/ngWords'
import { MAX_CHARS } from '@/lib/constants'
import type { DeclareRequestBody } from '@/types'

// 宣言の受付。POSTのみ受け付け、サーバ側でバリデーション後に
// Firebase Realtime Database の declarations/ へ書き込む。
export async function POST(request: NextRequest) {
  try {
    const body: DeclareRequestBody = await request.json()
    const { text } = body

    // 空文字・空白のみは受け付けない
    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { success: false, message: '宣言を入力してください' },
        { status: 400 }
      )
    }

    // 文字数上限チェック（MAX_CHARS を使用）
    if (text.length > MAX_CHARS) {
      return NextResponse.json(
        { success: false, message: `${MAX_CHARS}文字以内で入力してください` },
        { status: 400 }
      )
    }

    // NGワード判定（既定リストのみ。Firebase settings/ngWords のマージは別Issue）
    if (containsNgWord(text, DEFAULT_NG_WORDS)) {
      return NextResponse.json(
        { success: false, message: 'この内容は送信できません' },
        { status: 400 }
      )
    }

    // serverTimestamp() はセンチネル値のため Declaration 型注釈は付けない
    // （timestamp は number ではなくサーバ解決前のオブジェクトになるため）
    await push(ref(db, 'declarations'), {
      text: text.trim(),
      timestamp: serverTimestamp(),
      isVisible: true,
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('宣言の保存に失敗しました:', error)
    return NextResponse.json(
      { success: false, message: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}

// POST以外は許可しない（PUT/DELETE/PATCH は Next.js が自動で 405 を返す）
export async function GET() {
  return NextResponse.json({ message: 'Method Not Allowed' }, { status: 405 })
}
