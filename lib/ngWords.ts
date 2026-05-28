// 既定のNGワードリスト。
// ここに並ぶのは一般的な不適切語の「仮リスト」であり、本番投入前にクライアント確認で確定させる。
// 部分一致（containsNgWord）で判定するため、誤検知（地名・人名等への巻き込み）の可能性がある語が
// 含まれる。確定時に語句の取捨と誤検知チェックを必ず行うこと。
// 実運用では「DEFAULT_NG_WORDS ＋ Firebase settings/ngWords」をマージして
// containsNgWord の第2引数に渡す（マージは呼び出し側=入力画面/APIの責務）。
export const DEFAULT_NG_WORDS: readonly string[] = [
  // 暴力・脅迫
  '殺す',
  '殺害',
  '死ね',
  'しね',
  '殴る',
  '暴力',
  'テロ',
  // 差別・侮辱・中傷
  '差別',
  'バカ',
  'アホ',
  'クズ',
  'ブス',
  'デブ',
  'ハゲ',
  'キモい',
  'ウザい',
  // 性的表現
  'セックス',
  'エロ',
  'ポルノ',
  'わいせつ',
  'レイプ',
]

// text に ngWords のいずれかが含まれるかを判定する。
// 大文字小文字を無視して部分一致でチェックする。
// 空文字・空白のみの word は除外する（includes("") が常に true となり
// 全宣言がブロックされる事故を防ぐため）。
export const containsNgWord = (text: string, ngWords: readonly string[]): boolean => {
  const normalizedText = text.toLowerCase()
  return ngWords.some((word) => {
    const w = word.trim().toLowerCase()
    return w.length > 0 && normalizedText.includes(w)
  })
}
