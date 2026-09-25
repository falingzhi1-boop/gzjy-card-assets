import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(process.argv[2] || path.join(root, '..', 'v1.2'));
const baseUrl = process.argv[3]?.replace(/\/$/, '');
const dist = path.join(root, 'dist');
const candidate = path.join(root, '..', 'gzjy-cdn-candidate');

const files = {
  opening: 'regex-开局界面.json',
  status: 'regex-状态栏界面.json',
  phone: '酒馆助手脚本-归真纪元-灵讯手机.json',
};
const expected = {
  opening: 'DB2222AB0BD3EF968F524C2BD18E34D596EFD3B27D3CF39A27725117DF0516C6',
  status: '465A765AC7D236C8F085C9EC35E63C15B83F3E4AC309E69D3A0AF4ABCDD604F5',
  phone: '83798DA976E166064DF048C01D013DCC97FC702EDECACE381B6A2A304C39A8EC',
};
const sha = data => crypto.createHash('sha256').update(data).digest('hex').toUpperCase();
const inputs = {};
for (const [key, name] of Object.entries(files)) {
  const raw = fs.readFileSync(path.join(source, name));
  if (sha(raw) !== expected[key]) throw new Error(`Source changed since review: ${name}`);
  inputs[key] = { name, raw, value: JSON.parse(raw.toString('utf8')) };
}

function splitHtml(label, html) {
  const styleStart = html.indexOf('<style>');
  const styleEnd = html.indexOf('</style>', styleStart);
  const scriptStart = html.lastIndexOf('<script>');
  const scriptEnd = html.lastIndexOf('</script>');
  if (styleStart < 0 || styleEnd < 0 || scriptStart < 0 || scriptEnd < 0 || scriptStart < styleEnd) {
    throw new Error(`${label}: expected one inline style block and one final inline script block`);
  }
  const css = html.slice(styleStart + '<style>'.length, styleEnd);
  const js = html.slice(scriptStart + '<script>'.length, scriptEnd);
  const replace = (cssUrl, jsUrl) =>
    html.slice(0, styleStart) + `<link rel="stylesheet" href="${cssUrl}">` +
    html.slice(styleEnd + '</style>'.length, scriptStart) +
    `<script src="${jsUrl}"></script>` + html.slice(scriptEnd + '</script>'.length);
  return { css, js, replace };
}

const opening = splitHtml('opening', inputs.opening.value.replaceString);
const status = splitHtml('status', inputs.status.value.replaceString);
const images = [...opening.css.matchAll(/data:image\/jpeg;base64,([A-Za-z0-9+/=]+)/g)];
if (images.length !== 1) throw new Error(`Expected one opening image, found ${images.length}`);
const background = Buffer.from(images[0][1], 'base64');
if (background.length !== 187475) throw new Error('Opening image bytes differ from reviewed baseline');
const openingCss = opening.css.replace(images[0][0], './opening-bg.jpg');

fs.mkdirSync(dist, { recursive: true });
const outputs = {
  'opening-bg.jpg': background,
  'opening.css': openingCss,
  'opening.js': opening.js,
  'status.css': status.css,
  'status.js': status.js,
  'phone.js': inputs.phone.value.content,
};
for (const [name, data] of Object.entries(outputs)) fs.writeFileSync(path.join(dist, name), data);

const manifest = {
  schemaVersion: 1,
  source: Object.fromEntries(Object.entries(inputs).map(([key, x]) => [key, { file: x.name, sha256: sha(x.raw), bytes: x.raw.length, id: x.value.id }])),
  outputs: Object.fromEntries(Object.entries(outputs).map(([name, data]) => [name, { sha256: sha(data), bytes: Buffer.byteLength(data) }])),
};
fs.writeFileSync(path.join(root, 'build-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

if (baseUrl) {
  if (!/^https:\/\/cdn\.jsdelivr\.net\/gh\/[^/]+\/gzjy-card-assets@[0-9a-f]{40}\/dist$/i.test(baseUrl)) {
    throw new Error('Candidate URL must pin a 40-character Git commit on jsDelivr');
  }
  fs.mkdirSync(candidate, { recursive: true });
  const replacements = [
    ['opening', 'replaceString', opening.replace(`${baseUrl}/opening.css`, `${baseUrl}/opening.js`)],
    ['status', 'replaceString', status.replace(`${baseUrl}/status.css`, `${baseUrl}/status.js`)],
    ['phone', 'content', `import "${baseUrl}/phone.js";`],
  ];
  for (const [key, field, content] of replacements) {
    const value = { ...inputs[key].value, [field]: content };
    fs.writeFileSync(path.join(candidate, inputs[key].name), JSON.stringify(value, null, 2) + '\n');
  }
  fs.writeFileSync(path.join(candidate, 'candidate-manifest.json'), JSON.stringify({
    schemaVersion: 1,
    baseUrl,
    source: manifest.source,
    candidates: Object.fromEntries(replacements.map(([key]) => {
      const name = inputs[key].name;
      const data = fs.readFileSync(path.join(candidate, name));
      return [key, { file: name, sha256: sha(data), bytes: data.length }];
    })),
  }, null, 2) + '\n');
}

console.log(JSON.stringify({ dist, candidate: baseUrl ? candidate : null, manifest }, null, 2));
