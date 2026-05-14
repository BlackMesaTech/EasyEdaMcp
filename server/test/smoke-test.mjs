/**
 * Smoke test for the EasyEDA MCP server.
 *
 * Spawns dist/index.js, speaks raw JSON-RPC over stdio, and verifies:
 *   - the server starts and completes the MCP initialize handshake
 *   - all tools register with valid schemas
 *   - easyeda_connection_status works (no extension required)
 *   - jlcpcb_search_parts works (real HTTP, no extension required)
 *
 * The 80 bridge tools that require EasyEDA Pro are listed but not invoked.
 *
 * Usage: node test/smoke-test.mjs
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = join(__dirname, '..', 'dist', 'index.js');

const child = spawn(process.execPath, [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, EASYEDA_WS_PORT: '3777' },
});

let buffer = '';
const pending = new Map();
let nextId = 1;

child.stdout.on('data', (chunk) => {
  buffer += chunk.toString();
  let idx;
  while ((idx = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    if (msg.id !== undefined && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});

child.stderr.on('data', (d) => {
  for (const l of d.toString().split('\n')) if (l.trim()) console.error('  [server]', l.trim());
});

function send(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout: ${method}`)), 30000);
    pending.set(id, (msg) => { clearTimeout(timer); resolve(msg); });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}
function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
}

let passed = 0;
let failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

async function main() {
  console.log('\n=== EasyEDA MCP server smoke test ===\n');

  // 1. initialize handshake
  const init = await send('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'smoke-test', version: '1.0.0' },
  });
  check('initialize handshake', init.result?.serverInfo?.name === 'easyeda-pro',
    JSON.stringify(init.result?.serverInfo));
  notify('notifications/initialized');

  // 2. tools/list
  const list = await send('tools/list', {});
  const tools = list.result?.tools ?? [];
  check('tools/list returns tools', tools.length > 0, `got ${tools.length}`);
  console.log(`        ${tools.length} tools registered`);

  // every tool has a name + description + inputSchema
  const malformed = tools.filter((t) => !t.name || !t.description || !t.inputSchema);
  check('all tools have name/description/inputSchema', malformed.length === 0,
    malformed.map((t) => t.name).join(', '));

  // expected categories present
  const names = new Set(tools.map((t) => t.name));
  for (const expected of [
    'easyeda_connection_status', 'easyeda_get_project_info', 'easyeda_create_project',
    'easyeda_sch_place_component', 'easyeda_sch_find_at_point',
    'easyeda_pcb_place_component', 'easyeda_pcb_auto_route', 'easyeda_pcb_get_design_rules',
    'easyeda_pcb_cross_probe', 'easyeda_lib_search_device', 'easyeda_export_gerber',
    'jlcpcb_search_parts', 'jlcpcb_search_resistors', 'jlcpcb_search_capacitors',
  ]) {
    check(`tool present: ${expected}`, names.has(expected));
  }

  // 3. connection_status (works without extension)
  const conn = await send('tools/call', { name: 'easyeda_connection_status', arguments: {} });
  const connText = conn.result?.content?.[0]?.text ?? '';
  check('easyeda_connection_status responds', connText.includes('connected'),
    connText.slice(0, 80));
  check('connection_status reports NOT connected (no extension)',
    connText.includes('"connected": false'));

  // 4. a bridge tool fails gracefully when no extension is connected
  const noExt = await send('tools/call', { name: 'easyeda_get_project_info', arguments: {} });
  const noExtText = noExt.result?.content?.[0]?.text ?? '';
  check('bridge tool errors cleanly without extension',
    noExt.result?.isError === true && noExtText.includes('not connected'),
    noExtText.slice(0, 80));

  // 5. jlcpcb_search_parts (real HTTP)
  try {
    const jlc = await send('tools/call', {
      name: 'jlcpcb_search_parts',
      arguments: { keyword: '10k 0402 resistor', limit: 3 },
    });
    const jlcText = jlc.result?.content?.[0]?.text ?? '';
    const ok = !jlc.result?.isError && /C\d+/.test(jlcText);
    check('jlcpcb_search_parts returns real parts', ok, jlcText.slice(0, 120));
    if (ok) console.log(`        sample: ${jlcText.split('\n')[1]?.slice(0, 100) ?? ''}`);
  } catch (e) {
    check('jlcpcb_search_parts returns real parts', false, e.message);
  }

  // 6. input validation rejects bad args
  const badArgs = await send('tools/call', {
    name: 'jlcpcb_search_parts',
    arguments: { keyword: 'x', limit: 9999 },
  });
  check('schema rejects out-of-range limit',
    badArgs.result?.isError === true || badArgs.error !== undefined);

  console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
  child.kill();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Test harness error:', err);
  child.kill();
  process.exit(1);
});
