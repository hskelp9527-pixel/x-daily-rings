import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const read = name => JSON.parse(readFileSync(new URL(name, root), 'utf8').replace(/^\uFEFF/, ''));
const pkg = read('package.json'), chrome = read('manifest.json'), firefox = read('manifest.firefox.json');
for (const manifest of [chrome, firefox]) {
  assert.equal(manifest.version, pkg.version);
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.equal(manifest.content_scripts[0].world, 'MAIN');
  assert.equal(manifest.content_scripts[0].run_at, 'document_start');
  for (const file of manifest.content_scripts.flatMap(script => script.js)) assert.ok(existsSync(new URL(file, root)), file);
}
assert.equal(chrome.background.service_worker, 'background.js');
assert.equal(firefox.background.service_worker, undefined);
assert.deepEqual(firefox.background.scripts, ['model.js', 'state.js', 'background.js']);
assert.ok(firefox.browser_specific_settings.gecko.id);
assert.ok(firefox.browser_specific_settings.gecko_android.strict_min_version);
assert.deepEqual(firefox.browser_specific_settings.gecko.data_collection_permissions.required, ['none']);
console.log('Desktop Chrome and Firefox/Android manifests validated (static checks only).');
