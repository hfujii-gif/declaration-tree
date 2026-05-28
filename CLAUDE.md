# 宣言ツリーシステム - CLAUDE.md

このファイルはClaude Codeがプロジェクトを理解するためのコンテキストファイルです。
実装・レビュー・テストのどのエージェントも必ずこのファイルを最初に読んでください。

---

## プロジェクト概要

イベント会場のiPad（25台）から参加者が「明日から取り組む行動」を宣言し、
大型ビジョンにリアルタイムで反映される体験型Webシステム。
宣言が増えるごとに画面上の木が成長し、1万人達成で満開演出が流れる。

---

## 本番環境

- 本番URL：https://declaration-tree.vercel.app
- 各画面：
  - 入力画面：https://declaration-tree.vercel.app/input
  - ビジョン画面：https://declaration-tree.vercel.app/vision
  - 管理画面：https://declaration-tree.vercel.app/admin

---

## 技術スタック

| 役割 | 技術 |
|---|---|
| フレームワーク | Next.js 14（App Router） |
| リアルタイム通信 | Firebase Realtime Database |
| アニメーション | GSAP |
| スタイリング | SCSS Modules |
| ホスティング | Vercel |
| 言語 | TypeScript |

---

## ディレクトリ構成

```
declaration-tree/
├── app/
│   ├── input/
│   │   └── page.tsx          # タブレット入力画面
│   ├── vision/
│   │   └── page.tsx          # 大型ビジョン表示画面
│   ├── admin/
│   │   └── page.tsx          # 管理画面（パスワード認証あり）
│   └── api/
│       └── declare/
│           └── route.ts      # 宣言受付API Route
├── components/
│   ├── input/                # 入力画面用コンポーネント
│   ├── vision/               # ビジョン画面用コンポーネント
│   └── admin/                # 管理画面用コンポーネント
├── lib/
│   ├── firebase.ts           # Firebase初期化
│   ├── ngWords.ts            # NGワードリスト
│   └── constants.ts          # 定数（文字数制限など）
├── styles/
│   └── globals.scss
├── types/
│   └── index.ts              # 型定義
└── CLAUDE.md
```

---

## 画面仕様

### /input（タブレット入力画面）
- 文字数制限：**50文字**
- 入力中リアルタイムでNGワードチェック（赤枠＋エラーメッセージ）
- 送信後はオーバーレイで完了メッセージを表示（画面遷移しない）
- キーボードを常時表示状態に維持（オーバーレイ方式）
- 完了表示から**3秒後**に自動でリセット
- 空文字・空白のみは送信不可（ボタンをグレーアウト）

### /vision（ビジョン表示画面）
- Firebase `onValue()` でリアルタイム監視
- 新しい宣言が届くたびに葉を1枚追加（GSAPアニメーション）
- アニメーション：`gsap.from(leaf, { opacity: 0, scale: 0, duration: 0.8, ease: 'back.out' })`
- 画面下部に累計宣言数を常時表示
- マイルストーン演出：**2,500 / 5,000 / 7,500人**で木の成長＋テキスト
- **10,000人達成**で満開演出（花びら＋光＋「1万人達成！」テキスト）

### /admin（管理画面）
- パスワード認証（環境変数 `ADMIN_PASSWORD` で管理）
- 宣言一覧表示（投稿日時・テキスト）
- 宣言の非表示化（物理削除ではなく `isVisible: false`）
- NGワードの追加・削除

### /api/declare（API Route）
- POSTのみ受付
- バリデーション：空文字・50文字超・NGワード含有をチェック
- 正常時：Firebase Realtime DBの `declarations/` に書き込む
- データ構造：`{ text: string, timestamp: number, isVisible: boolean }`

---

## Firebase データ構造

```json
{
  "declarations": {
    "-abc123": {
      "text": "毎日運動する",
      "timestamp": 1234567890000,
      "isVisible": true
    }
  },
  "settings": {
    "ngWords": ["不適切語1", "不適切語2"]
  }
}
```

---

## 環境変数（.env.local）

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_DATABASE_URL=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
ADMIN_PASSWORD=
```

---

## 定数

```typescript
// lib/constants.ts
export const MAX_CHARS = 50
export const RESET_DELAY_MS = 3000
export const MILESTONES = [2500, 5000, 7500, 10000]
```

---

## コーディングルール

- **TypeScript必須**。`any`は原則禁止
- コンポーネントは関数コンポーネント（React hooks使用）
- Firebase操作は `lib/firebase.ts` に集約する
- SCSS Modulesを使用（グローバルスタイルは最小限）
- エラーハンドリングは必ず実装する（特にFirebase操作）
- コメントは日本語でOK

---

## エージェントへの指示

### 実装エージェントへ
- 1つのIssueを1つのPRとして実装する
- 実装前に必ずこのCLAUDE.mdの該当仕様を確認すること
- 実装後は `npm run build` が通ることを確認すること

### レビューエージェントへ
- CLAUDE.mdの仕様と実装が一致しているか確認する
- TypeScriptの型が適切か確認する
- エラーハンドリングが漏れていないか確認する
- レビュー結果はIssueまたはPRにコメントとして残す

### テストエージェントへ
- 各画面の正常系・異常系を確認する
- 特にNGワードバリデーション・文字数制限・Firebase連携を重点的にテストする
- バグを発見した場合は新しいIssueを作成する

---

## 注意事項

- **当日はコード変更禁止**。本番前日にVercelのデプロイを固定する
- Firebase は Blazeプラン（従量課金）を使用すること（無料枠超過対策）
- iPadのSafariでキーボードを自動表示することはできない（初回のみスタッフがタップ）
- ビジョン画面は長時間稼働（8時間以上）するため、メモリリーク対策を必ず行う