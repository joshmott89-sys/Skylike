// Skylike smoke test: runs on every push (GitHub Actions) and locally with `node tests/smoke.mjs`.
// Serves nothing itself: expects the site on http://localhost:8080 (the workflow starts it).
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8080';
const fails = [];
const check = (ok, what) => { if (!ok) fails.push(what); console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); };
const b = await chromium.launch();
const page = async (w, h) => {
  const p = await (await b.newContext({viewport: {width: w, height: h}, timezoneId: 'Australia/Perth'})).newPage();
  p._errs = []; p.on('pageerror', e => p._errs.push(e.message));
  p.on('console', m => { if (/Content Security Policy|Refused to/i.test(m.text())) p._errs.push('CSP: ' + m.text().slice(0, 140)); });
  await p.clock.install({time: new Date('2026-11-23T07:20:00+08:00')});
  await p.route(/open-meteo|photon|nominatim|osrm/, r => r.fulfill({body: '{}', contentType: 'application/json'}));
  return p;
};
// 1. every view renders, tablet and phone, with no errors
for (const [w, h, size] of [[1280, 800, 'tablet'], [390, 844, 'phone']]) {
  for (const v of ['family', 'focus', 'planner', 'calendar', 'lists', 'notes', 'kids', 'meals', 'sitter', 'settings']) {
    const p = await page(w, h);
    await p.goto(`${BASE}/index.html?demo&view=${v}`); await p.clock.runFor(3000);
    const txt = await p.evaluate(() => (document.querySelector('#main') || {}).textContent || '');
    check(txt.trim().length > 40 && !p._errs.length, `${size} ${v} renders${p._errs.length ? ': ' + p._errs[0] : ''}`);
    await p.close();
  }
}
// 2. the smart Add routes groceries, to-dos for someone, and events
{
  const p = await page(390, 844);
  await p.goto(`${BASE}/index.html?demo&view=focus`); await p.clock.runFor(3000);
  const n = () => p.evaluate(() => ({g: S.items.filter(i => i.list_id === listByKind('grocery').id).length, t: S.items.filter(i => i.list_id === listByKind('todo').id).length}));
  const add = async t => { await p.fill('#fq', t); await p.press('#fq', 'Enter'); await p.clock.runFor(500); };
  const a = await n(); await add('milk and bread'); const c = await n();
  check(c.g === a.g + 2, 'smart Add: food goes to groceries');
  await add('Sam: book the car service');
  check(await p.evaluate(() => { const it = S.items.filter(i => /book the car/i.test(i.text)).pop(); return !!it && (memberById(it.assignee) || {}).name === 'Sam'; }), 'smart Add: "Name: task" assigns it');
  await add('Swimming Tuesday 4pm');
  check(await p.evaluate(() => { const f = document.querySelector('#sheet-root form.evform'); return !!f && f.start.value === '16:00'; }), 'smart Add: an event opens the form filled in');
  check(!p._errs.length, 'smart Add: no errors');
  await p.close();
}
// 3. the real (signed-out) page boots: library loads, sign-in shows, nothing blocked
{
  const p = await page(1280, 800);
  await p.goto(`${BASE}/index.html`); await p.waitForTimeout(3000);
  check(await p.evaluate(() => !!(window.supabase && window.supabase.createClient)), 'Supabase library loads');
  check(!p._errs.filter(e => !/Failed to fetch|NetworkError|supabase\.co/i.test(e)).length, 'sign-in page boots without errors');
  await p.close();
}
await b.close();
console.log(fails.length ? `\n${fails.length} check(s) failed` : '\nALL CLEAN');
process.exit(fails.length ? 1 : 0);
