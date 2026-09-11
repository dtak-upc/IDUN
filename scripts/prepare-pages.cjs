// Only an explicitly reviewed synthetic bundle may enter the Pages artifact.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const input = path.join(root, 'site-demo');
const output = path.join(root, '.idun/showcase-build');
const manifestPath = path.join(input, 'publication.json');
if (!fs.existsSync(manifestPath)) throw Error('Pages publication blocked: approved synthetic site-demo bundle is not ready. Never substitute .idun or Datasets.');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (manifest.approved !== true || manifest.origin !== 'independently-authored-synthetic' || !manifest.files || !Object.keys(manifest.files).includes('snapshot.json')) throw Error('Pages requires an approved independently authored synthetic bundle.');
const allowed = /^(snapshot\.json|(?:all|TREATS|ADVERSE_EFFECT|DISCONTINUED|CONTRAINDICATED)\.csv)$/;
for (const [name, sha] of Object.entries(manifest.files)) {
  if (!allowed.test(name) || !/^[a-f0-9]{64}$/.test(sha)) throw Error('Unexpected publication file');
  const source = path.join(input, name);
  if (fs.lstatSync(source).isSymbolicLink()) throw Error('Publication symlinks are not permitted');
  const actual = crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex');
  if (actual !== sha) throw Error('Publication file changed after review: ' + name);
}
// Vite empties this isolated build directory before this packaging step.
fs.mkdirSync(path.join(output, 'demo'), {recursive:true});
for (const name of Object.keys(manifest.files)) fs.copyFileSync(path.join(input,name),path.join(output,'demo',name));
fs.renameSync(path.join(output,'showcase.html'),path.join(output,'index.html'));
fs.writeFileSync(path.join(output,'.nojekyll'),'');
console.log('Reviewed synthetic demo packaged for GitHub Pages.');
