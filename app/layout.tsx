import type { Metadata } from "next";
import "./globals.scss";

export const metadata: Metadata = {
  title: "宣言ツリー",
  description: "参加者の宣言が大型ビジョン上の木として育つ体験型システム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
