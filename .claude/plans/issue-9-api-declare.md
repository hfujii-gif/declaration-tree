# 実装プラン：Issue #9 /api/declare API Route

## 対象Issue

- **Issue番号**：#9
- **タイトル**：[Phase3] /api/declare API Route の実装
- **URL**：https://github.com/hfujii-gif/declaration-tree/issues/9

---

## ステータス

- [ ] プラン作成中
- [ ] レビュー待ち
- [ ] 承認済み → 実装開始可能
- [ ] 実装完了
- [x] PR作成済み（PR #28）

---

## 概要

iPad（入力画面）からの宣言送信を受け取り、サーバ側でバリデーションしたうえで
Firebase Realtime Database の `declarations/` に書き込む API Route を実装する。
クライアント（/input）と同じバリデーションをサーバ側でも行う「二重の防御」が目的。

---

## 実装対象ファイル

### 新規作成するファイル
```
app/api/declare/route.ts
```

### 編集するファイル
```
lib/firebase.ts   # serverTimestamp を追加 export する（後述・論点1の決定による）
```

> Issue本文のサンプルは `serverTimestamp` を `firebase/database` から直接importしているが、
> 「Firebase操作は lib/firebase.ts 経由」というプロジェクト規約に合わせ、
> lib/firebase.ts に serverTimestamp を追加 export してそこから import する方針に決定。

---

## 依存関係の確認

| 依存するファイル/Issue | 状態 | 確認結果 |
|---|---|---|
| lib/constants.ts | ✅ 完了 | `MAX_CHARS = 50` を export 済み |
| types/index.ts | ✅ 完了 | `DeclareRequestBody` / `DeclareResponse` を定義済み |
| lib/firebase.ts | ✅ 完了 | `db, ref, push` を export 済み（`serverTimestamp` は未export → 追加が必要） |
| lib/ngWords.ts | ✅ 完了 | `DEFAULT_NG_WORDS` / `containsNgWord(text, ngWords)` を export 済み |

依存はすべて満たされている。`lib/firebase.ts` への `serverTimestamp` 追加のみ必要。

---

## 設計上の決定事項（プラン作成時に確認済み）

### 論点1：serverTimestamp の import 元 → **lib/firebase.ts に集約**
- Issueサンプルは `import { serverTimestamp } from 'firebase/database'` だが、
  プロジェクト規約「Firebase操作は lib/firebase.ts からimportする／各ファイルで firebase を直接importしない」に従う。
- `lib/firebase.ts` の import 行に `serverTimestamp` を追加し、export 文にも追加する。
- route.ts では `import { db, ref, push, serverTimestamp } from '@/lib/firebase'` とする。

### 論点2：NGワードの参照元 → **DEFAULT_NG_WORDS のみ（Firebaseマージしない）**
- Issue #9 のスコープを最小に保つ（1 Issue = 1 PR / 変更は最小限）。
- 現実的な入力経路は会場のiPad（/input）に限定され、入力画面は既に
  `DEFAULT_NG_WORDS ＋ Firebase settings/ngWords` を購読・検査しているため、
  管理画面で追加したNGワードも実運用上はブロックされる。
- APIでFirebaseをマージすると正常送信1件ごとにDB読み取りが発生し、
  新たなレイテンシ・障害点が増える割に、防御対象（生POSTの直接攻撃）は本イベントでは想定しにくい。
- `lib/ngWords.ts` の設計意図（マージは呼び出し側の責務）に沿った Firebaseマージは、
  将来 直接API利用が懸念になった場合の follow-up Issue として残す。

### 補足：timestamp は serverTimestamp() を採用
- クライアント（iPad）のローカル時計はずれる可能性があるため、サーバ時刻を使う `serverTimestamp()` を採用。
- `serverTimestamp()` は書き込み時はセンチネル値、サーバで解決されて number になる。
  読み出し時（/vision の onValue）は number として扱えるため `Declaration.timestamp: number` と整合する。

---

## 実装ステップ

承認後、以下の順で実装する。

1. **lib/firebase.ts に serverTimestamp を追加**
   - `import { ..., serverTimestamp } from 'firebase/database'` に追記
   - `export { db, ref, push, onValue, update, set, off, serverTimestamp }` に追記
2. **app/api/declare/route.ts を新規作成**（POST ハンドラ）
   - `request.json()` でボディを取得し `DeclareRequestBody` 型で受ける
   - バリデーションを以下の順で実施（最初に違反したものでreturn）
     1. 空文字／空白のみ（`!text || text.trim().length === 0`）→ 400「宣言を入力してください」
     2. 文字数超過（`text.length > MAX_CHARS`）→ 400「50文字以内で入力してください」（メッセージは `${MAX_CHARS}` を使用）
     3. NGワード含有（`containsNgWord(text, DEFAULT_NG_WORDS)`）→ 400「この内容は送信できません」
   - 通過したら `push(ref(db, 'declarations'), { text: text.trim(), timestamp: serverTimestamp(), isVisible: true })`
   - 成功時 `{ success: true }` を 200 で返す
   - `try-catch` で全体を囲み、例外時は `console.error` の後に 500「サーバーエラーが発生しました」を返す
3. **GET ハンドラを追加**
   - `{ message: 'Method Not Allowed' }` を 405 で返す
   - （PUT/DELETE/PATCH は未定義のまま。Next.js App Router が自動で 405 を返すため明示不要）
4. **ビルド・型・lint・動作確認**
   - `npm run build` / `npx tsc --noEmit` / `npm run lint`
   - `npm run dev` で curl による正常系・異常系の確認（CLAUDE.md / rules/testing.md の curl 一式）

---

## 考慮が必要な点

### エラーハンドリング
- Firebase書き込み（push）は try-catch で囲み、失敗時は 500 を返す（無音で握りつぶさない）。
- `request.json()` が不正なJSONで throw した場合も同じ try-catch で 500 になる。
  本イベントの入力経路（/input）は正しいJSONを送るため、不正ボディの厳密な 400 区別は本Issueのスコープ外とする。
- レスポンスのステータスコードは 200 / 400 / 405 / 500 を使い分ける。

### 型の定義
- リクエストは `DeclareRequestBody`（`{ text: string }`）で受ける。新規の型追加は不要。
- 書き込みペイロードは `Declaration` 型として注釈しない。
  `serverTimestamp()` は number ではなくセンチネルオブジェクトを返すため、
  `Omit<Declaration, 'id'>`（timestamp: number）に厳密代入すると型エラーになる。
  インラインのオブジェクトリテラルとして push に渡す（Issueサンプル踏襲）。
- レスポンスは `DeclareResponse` 型に沿った形（`{ success, message? }`）で返す。

### メモリリーク対策
- 本Issueは onValue 等のリスナーを張らない（push の単発書き込みのみ）ため、該当なし。

### HTTPメソッドの扱い
- GET は明示ハンドラで `{ message: 'Method Not Allowed' }` + 405 を返す（testing.md のGETテストはJSONボディを期待するため明示が必要）。
- DELETE / PUT / PATCH は未定義のまま。Next.js が自動で 405 を返す（testing.md のDELETEテストはステータス405のみ期待のためこれで充足）。

### セキュリティ
- 環境変数のハードコードはしない（Firebase設定は lib/firebase.ts に集約済み）。
- `process.env.NEXT_PUBLIC_*` 以外の環境変数をこのRouteから露出させない。

---

## 実装方針（route.ts の最終形イメージ）

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db, ref, push, serverTimestamp } from '@/lib/firebase'
import { containsNgWord, DEFAULT_NG_WORDS } from '@/lib/ngWords'
import { MAX_CHARS } from '@/lib/constants'
import type { DeclareRequestBody } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const body: DeclareRequestBody = await request.json()
    const { text } = body

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { success: false, message: '宣言を入力してください' }, { status: 400 }
      )
    }
    if (text.length > MAX_CHARS) {
      return NextResponse.json(
        { success: false, message: `${MAX_CHARS}文字以内で入力してください` }, { status: 400 }
      )
    }
    if (containsNgWord(text, DEFAULT_NG_WORDS)) {
      return NextResponse.json(
        { success: false, message: 'この内容は送信できません' }, { status: 400 }
      )
    }

    await push(ref(db, 'declarations'), {
      text: text.trim(),
      timestamp: serverTimestamp(),
      isVisible: true,
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('宣言の保存に失敗しました:', error)
    return NextResponse.json(
      { success: false, message: 'サーバーエラーが発生しました' }, { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Method Not Allowed' }, { status: 405 })
}
```

> Issueサンプルとの差分は import 行のみ（serverTimestamp を `@/lib/firebase` から取得）。

---

## 完了条件

Issue #9 の完了条件を転記。

- [x] POST /api/declare に正常なリクエストを送るとFirebaseに書き込まれること（50文字ちょうど→200確認）
- [x] 空文字で400が返ること
- [x] 50文字超で400が返ること（真の51文字→400確認）
- [x] NGワード含有で400が返ること
- [x] GETリクエストで405が返ること
- [x] npm run buildが通ること

### 追加で確認するもの（rules準拠）
- [x] `npx tsc --noEmit` で型エラーがないこと
- [x] `npm run lint` でエラーがないこと
- [x] 空白のみ（`"   "`）で400が返ること
- [x] DELETE で405が返ること（Next.js自動応答）

### 動作確認メモ
- `.claude/rules/testing.md` の「51文字」テスト文字列は実測 **47文字** だった（五十音46字＋あ）。
  47≤50 のため 200 が正しい挙動。testing.md のテストデータ側の誤りであり、実装は正しい。
- 動作確認の過程で Firebase の `declarations/` にテストデータが書き込まれた
  （47文字の五十音文字列／「国」×50）。本番前に削除が必要。

---

## 承認コメント欄

> プランを確認したら以下に承認コメントを記入してください。

**承認者**：
**承認日**：
**コメント**：
