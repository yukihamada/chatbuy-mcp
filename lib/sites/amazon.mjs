// chatbuy — Amazon.co.jp アダプタ。
// 検索・カート追加・レビュー(確認)ページ表示までしか行わない。
// 購入確定("注文を確定する")ボタンには、このファイルのどの関数も一切触れない。
import { getPage } from '../browser.mjs';

export const id = 'amazon';
export const label = 'Amazon.co.jp';

function yen(s) {
  const d = (s || '').replace(/[^0-9]/g, '');
  return d ? parseInt(d, 10) : 0;
}

export async function isLoggedIn() {
  const page = await getPage();
  const cookies = await page.context().cookies();
  const names = new Set(cookies.filter((c) => c.value).map((c) => c.name));
  if (['at-main', 'x-main', 'sess-at-main'].some((n) => names.has(n))) return true;
  try {
    const el = await page.$('#nav-link-accountList-nav-line-1');
    if (el) {
      const t = (await el.innerText()) || '';
      if (t && !t.includes('ログイン')) return true;
    }
  } catch {
    // ignore — フォールバック判定なので失敗時は未ログイン扱いでよい
  }
  return false;
}

export async function openLogin() {
  const page = await getPage();
  // 保護ページに行くと未ログイン時は正規のサインイン画面へリダイレクトされる
  await page.goto('https://www.amazon.co.jp/gp/css/order-history', { waitUntil: 'domcontentloaded' });
  try {
    await page.bringToFront();
  } catch {
    // ヘッドフルでないなど、失敗しても致命的ではない
  }
  return { logged_in: await isLoggedIn() };
}

export async function searchOne(itemLabel, query) {
  const page = await getPage();
  await page.goto('https://www.amazon.co.jp/s?k=' + encodeURIComponent(query) + '&i=food-beverage', {
    waitUntil: 'domcontentloaded',
  });
  try {
    await page.waitForSelector('div[data-component-type="s-search-result"]', { timeout: 15000 });
  } catch {
    // 結果が出ない/遅い場合はそのまま次の抽出へ(空配列になる)
  }
  const items = await page.$$eval('div[data-component-type="s-search-result"]', (els) =>
    els
      .slice(0, 20)
      .map((el) => ({
        asin: el.getAttribute('data-asin'),
        title:
          el.querySelector('h2 span')?.textContent?.trim() || el.querySelector('h2')?.textContent?.trim(),
        price: el.querySelector('span.a-price > span.a-offscreen')?.textContent?.trim(),
        rating: el.querySelector('span.a-icon-alt')?.textContent?.trim(),
        image: el.querySelector('img.s-image')?.getAttribute('src'),
        prime: !!el.querySelector('i.a-icon-prime,[aria-label*="Prime"],[aria-label*="プライム"]'),
        sponsored: !!el.querySelector('[aria-label*="スポンサー"],.puis-sponsored-label-text'),
      }))
      .filter((x) => x.asin && x.title && x.price),
  );
  const cands = items.filter((x) => !x.sponsored);
  cands.sort((a, b) => (a.prime ? 0 : 1) - (b.prime ? 0 : 1) || yen(a.price) - yen(b.price));
  const pick = cands[0];
  if (!pick) return null;
  delete pick.sponsored;
  pick.label = itemLabel;
  pick.url = 'https://www.amazon.co.jp/dp/' + pick.asin;
  pick.yen = yen(pick.price);
  return pick;
}

async function addToCart(asin) {
  const page = await getPage();
  await page.goto('https://www.amazon.co.jp/dp/' + asin, { waitUntil: 'domcontentloaded' });
  const btn = await page.$('#add-to-cart-button');
  if (!btn) return false;
  await btn.click();
  await page.waitForTimeout(2000);
  return true;
}

// カートに入れて確認ページを開くところまで。
// 「注文を確定する」ボタンはこの関数もこのファイルのどこも押さない — 最後の1クリックは常に人。
export async function openReview(asins) {
  if (!(await isLoggedIn())) {
    return { ok: false, msg: '未ログインです。先に chatbuy_login を呼んでください。' };
  }
  const page = await getPage();
  const added = [];
  for (const asin of asins) {
    if (await addToCart(asin)) added.push(asin);
  }
  await page.goto('https://www.amazon.co.jp/gp/cart/view.html', { waitUntil: 'domcontentloaded' });
  const sub = await page.$('#sc-subtotal-amount-activecart,#sc-subtotal-amount-buybox');
  const total = yen(sub ? await sub.innerText() : '');
  try {
    await page.bringToFront();
  } catch {
    // 致命的ではない
  }
  return {
    ok: true,
    added,
    total,
    note: 'カート/確認ページを開きました。内容を見て、購入確定は必ずご自身の手でブラウザ上のボタンを押してください。このツールは購入確定ボタンには一切触れていません。',
  };
}
