// chatbuy — 無料枠カウンタ + サポーターサブスク確認。
// 買い手の決済資金にはここでは一切触れない(Stripe Payment Linkで完結)。
// OSSなのでこのゲートはコード改変で回避できる — 強制ではなく「応援課金で快適枠が広がる」ための正直な仕組み。
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const STATE_DIR = join(homedir(), '.chatbuy');
const STATE_PATH = join(STATE_DIR, 'state.json');
const VERIFY_URL = process.env.CHATBUY_LICENSE_URL || 'https://chatbuy-license.fly.dev/verify';
export const PAYMENT_LINK =
  process.env.CHATBUY_PAYMENT_LINK || 'https://buy.stripe.com/test_9B63cvdUv2bM0FqgFGefC0a';

const FREE_LIMIT = 20;
const PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
const RECHECK_MS = 24 * 60 * 60 * 1000;

function load() {
  if (!existsSync(STATE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function save(state) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function currentPeriodCount(state) {
  const now = Date.now();
  if (!state.periodStart || now - state.periodStart > PERIOD_MS) {
    state.periodStart = now;
    state.searchCount = 0;
  }
  return state;
}

export async function activate(email) {
  const state = load();
  try {
    const r = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email }),
      signal: AbortSignal.timeout(10000),
    });
    const body = await r.json();
    state.licenseEmail = email;
    state.licenseActive = !!body.active;
    state.licenseCheckedAt = Date.now();
    save(state);
    return { active: state.licenseActive, email };
  } catch (e) {
    return { active: false, email, error: `確認サーバーに到達できませんでした: ${String(e?.message || e)}` };
  }
}

async function isLicensed(state) {
  if (!state.licenseEmail) return false;
  const stale = !state.licenseCheckedAt || Date.now() - state.licenseCheckedAt > RECHECK_MS;
  if (!stale) return !!state.licenseActive;
  const result = await activate(state.licenseEmail);
  return result.active;
}

// 検索1回ごとに呼ぶ。無料枠内 or サポーター有効なら {allowed:true}。
export async function gateSearch() {
  let state = load();
  state = currentPeriodCount(state);
  if (await isLicensed(state)) {
    save(state);
    return { allowed: true, licensed: true };
  }
  if (state.searchCount < FREE_LIMIT) {
    state.searchCount += 1;
    save(state);
    return { allowed: true, licensed: false, remaining: FREE_LIMIT - state.searchCount };
  }
  save(state);
  return {
    allowed: false,
    licensed: false,
    remaining: 0,
    note: `今月の無料検索(${FREE_LIMIT}回)を使い切りました。chatbuy_activate(email) にサブスク登録済みのメールを渡すか、${PAYMENT_LINK} でサポーターになると無制限になります。`,
  };
}
