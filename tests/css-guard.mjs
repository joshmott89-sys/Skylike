// Style-clash guard: fails when a plain class (".name") is defined at the top level of css/app.css more than once,
// unless it's on the allow-list below. Two features picking the same class name broke the phone inventory and Planner;
// this catches the next one before it ships. To allow a deliberate second rule, add the name to css-allow.json.
import fs from 'fs';
const here = new URL('.', import.meta.url).pathname;
const css = fs.readFileSync(here + '../css/app.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const allow = new Set(JSON.parse(fs.readFileSync(here + 'css-allow.json', 'utf8')));
const seen = {}; let depth = 0, sel = '', line = 1;
for (let i = 0; i < css.length; i++) {
  const ch = css[i];
  if (ch === '\n') line++;
  if (ch === '{') { if (depth === 0 && !sel.trim().startsWith('@')) sel.split(',').map(x => x.trim()).filter(x => /^\.[\w-]+$/.test(x)).forEach(x => (seen[x] = seen[x] || []).push(line)); depth++; sel = ''; }
  else if (ch === '}') { depth--; sel = ''; }
  else if (depth === 0) sel += ch;
}
const dup = Object.entries(seen).filter(([k, v]) => v.length > 1);
if (process.argv.includes('--baseline')) { fs.writeFileSync(here + 'css-allow.json', JSON.stringify(dup.map(([k]) => k).sort(), null, 1) + '\n'); console.log('baseline written:', dup.length); process.exit(0); }
const fresh = dup.filter(([k]) => !allow.has(k));
fresh.forEach(([k, v]) => console.log(`FAIL ${k} is defined ${v.length} times (lines ${v.join(', ')}). Pick a feature-specific name, or add it to tests/css-allow.json if the second rule is deliberate.`));
console.log(fresh.length ? `\n${fresh.length} style clash(es)` : `ok   no new style clashes (${Object.keys(seen).length} classes checked, ${dup.length} known)`);
process.exit(fresh.length ? 1 : 0);
