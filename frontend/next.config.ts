import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 静的書き出し：`next build` で out/ に HTML/CSS/JS を出力し、
  // Render の Static Site でそのまま配信する（Node.js サーバー不要）。
  output: "export",
  // /login → out/login/index.html の形で出力し、どの静的ホストでも開けるようにする
  trailingSlash: true,
};

export default nextConfig;
