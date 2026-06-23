#!/usr/bin/env bash
# 背景動画（#52）をシームレスループ化するスクリプト。
# 末尾 CROSS 秒を先頭 CROSS 秒へクロスフェード（xfade）で重ね、つなぎ目のないループ動画を作る。
# 出力の長さは「元の長さ - CROSS 秒」になる。/vision の <video loop> はこの出力を再生する。
#
# 生素材（IN）は git 管理外（.gitignore）。出力（OUT）のみコミットする。
# 差し替え時はこのスクリプトで生素材から seamless 版を作り直す。
#
# 使い方:
#   sudo apt install -y ffmpeg   # 事前に ffmpeg / ffprobe が必要
#   bash scripts/make-seamless.sh [入力mp4] [出力mp4] [クロスフェード秒]
#   例: bash scripts/make-seamless.sh public/videos/starfield-bg.mp4 public/videos/starfield-bg-seamless.mp4 1.2

set -euo pipefail

IN="${1:-public/videos/starfield-bg.mp4}"
OUT="${2:-public/videos/starfield-bg-seamless.mp4}"
CROSS="${3:-1.2}"

if ! command -v ffmpeg >/dev/null 2>&1 || ! command -v ffprobe >/dev/null 2>&1; then
  echo "ffmpeg / ffprobe が必要です（sudo apt install -y ffmpeg）" >&2
  exit 1
fi
if [[ ! -f "$IN" ]]; then
  echo "入力ファイルが見つかりません: $IN" >&2
  exit 1
fi

# 元動画の長さ（秒）を取得する。
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$IN")

# xfade の重なり開始位置（offset）= 全体 - 2*CROSS。CROSS は全体の半分未満である必要がある。
OFFSET=$(awk -v d="$DUR" -v c="$CROSS" 'BEGIN { printf "%.3f", d - 2 * c }')
if awk -v o="$OFFSET" 'BEGIN { exit (o > 0) ? 0 : 1 }'; then :; else
  echo "クロスフェード秒（$CROSS）が長すぎます（動画長 $DUR 秒の半分未満にしてください）" >&2
  exit 1
fi

# 先頭 CROSS 秒（head）を、末尾を含む残り（rest）の終端へ xfade で重ねる。
# これにより末尾→先頭の継ぎ目が消え、loop 再生で途切れない。音声は使わないため落とす（-an）。
ffmpeg -y -i "$IN" -filter_complex "\
[0]split[a][b];\
[a]trim=0:${CROSS},setpts=PTS-STARTPTS[head];\
[b]trim=start=${CROSS},setpts=PTS-STARTPTS[rest];\
[rest][head]xfade=transition=fade:duration=${CROSS}:offset=${OFFSET}[v]" \
  -map "[v]" -an -pix_fmt yuv420p -movflags +faststart "$OUT"

echo "出力: $OUT （元 ${DUR}s → 約 $(awk -v d="$DUR" -v c="$CROSS" 'BEGIN { printf "%.3f", d - c }')s）"
