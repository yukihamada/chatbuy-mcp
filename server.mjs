#!/usr/bin/env node
// chatbuy — 言えば、届く。ローカルで動くAI買い物MCPサーバー。
// あなたのログインはあなたのマシンの中だけ。決済確定ボタンには一切触れない
// (chatbuy_checkout / chatbuy_pay のようなツールは意図的に存在しない)。
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as amazon from './lib/sites/amazon.mjs';
import { gateSearch, activate, PAYMENT_LINK } from './lib/license.mjs';

const SITES = { amazon };

function siteAdapter(site) {
  const s = SITES[site || 'amazon'];
  if (!s) throw new Error(`未対応サイト: ${site}(対応: ${Object.keys(SITES).join(', ')})`);
  return s;
}

function text(obj) {
  return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] };
}

// 自然文の買い物リクエストを検索クエリの並びに分解する簡易プランナー。
function plan(prompt) {
  const p = (prompt || '').trim();
  const parts = p
    .split(/[、,，\/／\nと]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const items = (parts.length ? parts : p ? [p] : []).map((s) => [s, s]);
  return { label: p || '指定の品', items };
}

const server = new McpServer(
  { name: 'chatbuy', version: '1.0.0' },
  {
    instructions:
      'chatbuy — 言えば、届く。あなたのマシン上でだけ動くローカルAI買い物MCP。' +
      'chatbuy_login → chatbuy_search → chatbuy_review の順で使う。' +
      '購入確定(決済)は一切自動化しない: chatbuy_review はカート/確認ページを開くところで止まり、' +
      '最後の「注文を確定する」ボタンは必ずあなた自身がブラウザ画面上で押す。決済系のツールは存在しない。' +
      `月${20}回まで無料。それ以降は ${PAYMENT_LINK} のサブスク(任意)で無制限 — chatbuy_activate で有効化する。`,
  },
);

server.tool(
  'chatbuy_status',
  'ログイン状態を確認する。/ Check login status for a shopping site.',
  { site: z.string().optional().describe('amazon(既定・現状唯一の対応サイト)') },
  async ({ site }) => {
    const logged_in = await siteAdapter(site).isLoggedIn();
    return text({ site: site || 'amazon', logged_in });
  },
);

server.tool(
  'chatbuy_login',
  '実ブラウザでログインページを開く。ログイン自体は人が手で行い、以後セッションはこのマシンにローカル保存される。/ Opens a real browser to the login page — you log in yourself once, session persists locally on this machine only.',
  { site: z.string().optional() },
  async ({ site }) => text(await siteAdapter(site).openLogin()),
);

server.tool(
  'chatbuy_search',
  '自然文の買い物リクエストを商品候補+価格に変換する。/ Turn a natural-language shopping request into candidate items with prices.',
  {
    prompt: z.string().describe('例: 犬が長生きする健康な食材'),
    site: z.string().optional(),
  },
  async ({ prompt, site }) => {
    const gate = await gateSearch();
    if (!gate.allowed) return text(gate);
    const adapter = siteAdapter(site);
    const { label, items } = plan(prompt);
    const picks = [];
    for (const [itemLabel, query] of items) {
      try {
        const pick = await adapter.searchOne(itemLabel, query);
        if (pick) picks.push(pick);
      } catch (e) {
        picks.push({ label: itemLabel, error: String(e?.message || e) });
      }
    }
    const total = picks.reduce((sum, p) => sum + (p.yen || 0), 0);
    const result = { label, items: picks, total };
    if (!gate.licensed) result.free_searches_remaining = gate.remaining;
    return text(result);
  },
);

server.tool(
  'chatbuy_activate',
  'サポーターサブスク(任意)を有効化する。登録済みのメールアドレスを渡すと無料枠の上限が外れる。/ Activate the optional supporter subscription by email — removes the free-tier search limit.',
  { email: z.string().email().describe('Stripeサブスク登録に使ったメールアドレス') },
  async ({ email }) => text(await activate(email)),
);

server.tool(
  'chatbuy_review',
  'カートに入れて確認/レビューページまで開く。購入確定ボタンには一切触れない — 最後の1クリックは必ずあなた自身。/ Adds items to cart and opens the review page. NEVER clicks the final purchase button — that click is always yours.',
  {
    ids: z.array(z.string()).describe('chatbuy_search で得た商品ID(asin等)の一覧'),
    site: z.string().optional(),
  },
  async ({ ids, site }) => text(await siteAdapter(site).openReview(ids)),
);

const transport = new StdioServerTransport();
await server.connect(transport);
