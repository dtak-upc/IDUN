// Package only individually approved, hash-verified public files.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const input = path.join(root, 'site-demo');
const output = path.join(root, '.idun/showcase-build');
const manifest = JSON.parse(fs.readFileSync(path.join(input, 'publication.json'), 'utf8'));
if (manifest.approved !== true || manifest.origin !== 'reviewed-public-datasets' || !manifest.files?.['lakes.json']) throw Error('Approved public lake manifest required');
const allowed = /^(lakes\.json|(?:dummy|doc2db)\/(?:snapshot\.json|[a-f0-9]{32}--(?:all|[A-Z0-9_]+)\.csv|links\/(?:page-\d+|source-[a-f0-9-]+)\.json\.gz|evidence\/[a-f0-9]{2}\.json\.gz))$/;
for (const [name, sha] of Object.entries(manifest.files)) {
  if (!allowed.test(name) || !/^[a-f0-9]{64}$/.test(sha)) throw Error('Unexpected publication file: '+name);
  const source = path.resolve(input, name);
  if (!source.startsWith(input + path.sep)) throw Error('Invalid publication path');
  let current = source;
  while (current !== input) {if (fs.lstatSync(current).isSymbolicLink()) throw Error('Publication symlinks prohibited');current = path.dirname(current);}
  if (crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex') !== sha) throw Error('Publication file changed after review: '+name);
}
for (const name of Object.keys(manifest.files)) {
  const destination = path.join(output, 'demo', name);
  fs.mkdirSync(path.dirname(destination), {recursive:true});
  fs.copyFileSync(path.join(input,name), destination);
}
fs.renameSync(path.join(output,'showcase.html'),path.join(output,'index.html'));
fs.writeFileSync(path.join(output,'.nojekyll'),'');
console.log('Approved Dummy and Doc2DB results packaged for GitHub Pages.');
