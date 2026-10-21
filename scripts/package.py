"""Build an unpacked-extension ZIP from an explicit runtime allowlist."""
from pathlib import Path
import json
import zipfile

root = Path(__file__).resolve().parents[1]
runtime = ["hook.js", "model.js", "state.js", "background.js", "content.js", "README.md", "LICENSE"]
manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
package = json.loads((root / "package.json").read_text(encoding="utf-8"))
assert manifest["version"] == package["version"], "Manifest and package versions must match"
for name in runtime:
    assert (root / name).is_file(), f"Missing runtime file: {name}"
for target, source in [("x-daily-rings.zip", "manifest.json"), ("x-daily-rings-firefox.zip", "manifest.firefox.json"),
                       ("x-daily-rings-firefox-unsigned.xpi", "manifest.firefox.json"), ("x-daily-rings-safari-source.zip", "manifest.json")]:
    selected = json.loads((root / source).read_text(encoding="utf-8"))
    assert selected["version"] == manifest["version"]
    if "firefox" in target:
        assert "service_worker" not in selected["background"]
    output = root / "dist" / target
    output.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.write(root / source, "manifest.json")
        for name in runtime:
            archive.write(root / name, name)
    with zipfile.ZipFile(output) as archive:
        assert archive.testzip() is None
        assert set(archive.namelist()) == set(["manifest.json", *runtime])
    print(f"Packaged v{manifest['version']}: {output}")
