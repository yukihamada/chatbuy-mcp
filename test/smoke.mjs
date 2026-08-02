// Smoke test: stdio MCPサーバーを起動し tools/list を確認する。
// ブラウザ/実サイトを触る検証(ログイン・検索・レビュー)はここでは行わない(手動確認)。
// Usage: node test/smoke.mjs
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
let failures = 0;

function check(name, cond, detail = '') {
  const ok = !!cond;
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

const transport = new StdioClientTransport({
  command: 'node',
  args: [join(__dirname, '..', 'server.mjs')],
});
const client = new Client({ name: 'smoke', version: '0' }, { capabilities: {} });
await client.connect(transport);

const { tools } = await client.listTools();
const names = tools.map((t) => t.name).sort();
check('4 tools', names.length === 4, names.join(','));
check(
  'expected tool names',
  ['chatbuy_login', 'chatbuy_review', 'chatbuy_search', 'chatbuy_status'].every((n) => names.includes(n)),
  names.join(','),
);
check(
  '決済系ツールが存在しない(安全弁)',
  !names.some((n) => /pay|checkout|purchase|confirm/i.test(n)),
  names.join(','),
);

await client.close();
console.log(failures === 0 ? `\n✅ smoke OK (${tools.length} tools)` : `\n❌ ${failures} failures`);
process.exit(failures === 0 ? 0 : 1);
