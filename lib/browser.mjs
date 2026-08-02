// chatbuy — 永続ブラウザプロファイルのラッパー。
// セッション(ログイン情報)は常にこのマシンのローカルディスクにのみ保存される。
// サーバー側(chatbuy.ai)は一切あなたのログインを保持しない。
import { chromium } from 'playwright';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

const PROFILE_DIR = process.env.CHATBUY_PROFILE_DIR || join(homedir(), '.chatbuy', 'profile');
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0 Safari/537.36';

let contextPromise = null;

export async function getContext() {
  if (!contextPromise) {
    mkdirSync(PROFILE_DIR, { recursive: true });
    contextPromise = chromium.launchPersistentContext(PROFILE_DIR, {
      headless: false,
      viewport: { width: 1280, height: 900 },
      userAgent: UA,
      locale: 'ja-JP',
    });
  }
  return contextPromise;
}

export async function getPage() {
  const ctx = await getContext();
  const pages = ctx.pages();
  return pages[0] || ctx.newPage();
}

export async function closeBrowser() {
  if (!contextPromise) return;
  const ctx = await contextPromise;
  contextPromise = null;
  await ctx.close();
}
