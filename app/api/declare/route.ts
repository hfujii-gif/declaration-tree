import { NextRequest, NextResponse } from 'next/server'
import { db, ref, push, get, serverTimestamp } from '@/lib/firebase'
import { containsNgWord, DEFAULT_NG_WORDS } from '@/lib/ngWords'
import { MAX_CHARS } from '@/lib/constants'
import type { DeclareRequestBody } from '@/types'

// 既定リストと、管理画面(#12)が管理する Firebase settings/ngWords をマージして返す。
// 読み取りに失敗しても全送信をブロックしないよう、その場合は既定リストのみで判定する。
async function loadNgWords(): Promise<readonly string[]> {
  try {
    const snapshot = await get(ref(db, 'settings/ngWords'))
    const value: unknown = snapshot.val()
    if (Array.isArray(value)) {
      const extra = value.filter((w): w is string => typeof w === 'string')
      return [...DEFAULT_NG_WORDS, ...extra]
    }
  } catch (error) {
    console.error('settings/ngWords の取得に失敗しました（既定リストのみで判定します）:', error)
  }
  return DEFAULT_NG_WORDS
}

// 宣言の受付。POSTのみ受け付け、サーバ側でバリデーション後に
// Firebase Realtime Database の declarations/ へ書き込む。
export async function POST(request: NextRequest): Promise<NextResponse> {
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

    // 文字数上限チェック（保存値と判定を揃えるため trim 後の長さで比較する）
    if (text.trim().length > MAX_CHARS) {
      return NextResponse.json(
        { success: false, message: `${MAX_CHARS}文字以内で入力してください` },
        { status: 400 }
      )
    }

    // NGワード判定（既定リスト＋管理画面で追加された Firebase settings/ngWords をマージ）
    const ngWords = await loadNgWords()
    if (containsNgWord(text, ngWords)) {
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
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ message: 'Method Not Allowed' }, { status: 405 })
}
