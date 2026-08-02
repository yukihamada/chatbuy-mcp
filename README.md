# chatbuy — 言えば、届く。

「犬が長生きする健康な食材」のような短いひとことから、商品候補と合計金額を出し、
カート/確認ページまで開く、ローカルで動くAI買い物MCPサーバー。

**あなたのログインはあなたのマシンの中だけ。** chatbuy.ai(このサーバーの提供元)は
あなたのAmazonログインを一切見ません・保持しません — すべてこのマシン上の
Chromeプロファイル(`~/.chatbuy/profile`)に閉じています。

**購入確定(決済)は絶対に自動化しません。** `chatbuy_review` はカート/確認ページを
開くところで止まります。最後の「注文を確定する」ボタンは、必ずあなた自身が実際の
ブラウザ画面で押してください。決済を行うツールはこのサーバーに存在しません。

## インストール

npm未公開のため、現状はGitHubから直接実行する:

```bash
npx github:yukihamada/chatbuy-mcp
```

### Claude Code に追加

```bash
claude mcp add chatbuy -- npx github:yukihamada/chatbuy-mcp
```

### 初回セットアップ

1. `chatbuy_login` を呼ぶ → Chromeが開くので、Amazonに一度だけ手でログインする
2. `chatbuy_search("探したいもの")` → 候補と価格が返る
3. `chatbuy_review(["<asin>", ...])` → カートに入り確認ページが開く
4. **あなたの手で** ブラウザの「注文を確定する」を押す

## ツール一覧

| ツール | できること |
|---|---|
| `chatbuy_status` | ログイン状態の確認 |
| `chatbuy_login` | ログインページを開く(ログインは人力) |
| `chatbuy_search` | 自然文 → 商品候補+価格 |
| `chatbuy_review` | カート追加 → 確認ページを開く(購入確定ボタンには触れない) |

## 対応サイト

- Amazon.co.jp(v1)
- 今後追加予定(サイトごとに `lib/sites/*.mjs` を1つ足すだけの構成)

## ローカル開発

```bash
npm install
npm run smoke   # MCPサーバーが起動しtools/listに応答することを確認
node server.mjs # 実行(stdio MCPサーバー)
```
