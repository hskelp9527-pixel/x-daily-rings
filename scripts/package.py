"""Build an unpacked-extension ZIP from an explicit runtime allowlist."""
from pathlib import Path
import json
import zipfile

root = Path(__file__).resolve().parents[1]
runtime = ["manifest.json", "hook.js", "model.js", "content.js", "README.md", "LICENSE"]
manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
package = json.loads((root / "package.json").read_text(encoding="utf-8"))
assert manifest["version"] == package["version"], "Manifest and package versions must match"
for name in runtime:
    assert (root / name).is_file(), f"Missing runtime file: {name}"
output = root / "dist" / "x-daily-rings.zip"
output.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
    for name in runtime:
        archive.write(root / name, name)
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None
    assert set(archive.namelist()) == set(runtime)
print(f"Packaged v{manifest['version']}: {output}")
