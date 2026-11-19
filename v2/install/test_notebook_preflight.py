import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import os
import subprocess
import sys
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("notebook_inventory", Path(__file__).with_name("notebook-preflight.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class NotebookTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.home = Path(self.temp.name)

    def test_unknown_old_layout_is_not_approved_or_initialized(self):
        legacy = self.home / ".local/share/opencode/storage/session"
        legacy.mkdir(parents=True)
        with patch.object(module, "node_version", return_value={"compatible": False}), patch.object(module.shutil, "which", return_value=None):
            result = module.inspect(self.home)
        self.assertFalse(result["installationApproved"])
        self.assertIn("official-legacy-history-conversion-or-explicit-path-required", result["earlyBlockers"])
        self.assertFalse((legacy.parent.parent / "opencode.db").exists())
        self.assertEqual(result["writesPerformed"], 0)

    def test_db_contents_and_marker_private_fields_never_appear(self):
        db = self.home / ".local/share/opencode/opencode.db"
        db.parent.mkdir(parents=True)
        db.write_text("SYNTHETIC_DB_CONTENT_NOT_TO_READ")
        marker = self.home / ".opencode/.opencode-background-addon.json"
        marker.parent.mkdir()
        marker.write_text(json.dumps({"mode": "managed-local-install", "irrelevant": "SYNTHETIC_PRIVATE_NOT_TO_PRINT"}))
        with patch.object(module, "node_version", return_value={"compatible": True}), patch.object(module.shutil, "which", return_value="/fixture"):
            result = module.inspect(self.home)
        self.assertIn("background-owner-cutover-required", result["earlyBlockers"])
        self.assertNotIn("SYNTHETIC", json.dumps(result))
        self.assertFalse(result["databasesOpened"])

    def test_symlinked_home_is_rejected(self):
        alias = self.home / "alias"
        alias.symlink_to(self.home, target_is_directory=True)
        with self.assertRaises(ValueError):
            module.inspect(alias)

    def test_saved_report_is_private_unique_and_gives_local_actions_for_every_blocker(self):
        with patch.object(module, "node_version", return_value={"compatible": False}), patch.object(module.shutil, "which", return_value=None):
            result = module.inspect(self.home)
        first = module.save_report(self.home, result)
        second = module.save_report(self.home, result)
        self.assertNotEqual(first, second)
        self.assertEqual(first.stat().st_mode & 0o777, 0o700)
        for name in ["diagnostic.json", "NEXT-STEPS.md"]:
            self.assertEqual((first / name).stat().st_mode & 0o777, 0o600)
        for code in module.GUIDANCE:
            self.assertIn(module.GUIDANCE[code], module.next_steps({"earlyBlockers": [code]}))
        self.assertIn("No hace falta pegar", (first / "NEXT-STEPS.md").read_text())
        self.assertFalse((self.home / ".opencode").exists())

    def test_update_cli_on_unknown_legacy_stops_with_local_report_before_any_install(self):
        legacy = self.home / ".local/share/opencode/storage/session"
        legacy.mkdir(parents=True)
        original = legacy / "fixture.json"
        original.write_text("SYNTHETIC_HISTORY_UNCHANGED")
        run = subprocess.run([sys.executable, "-I", "-B", str(Path(__file__).with_name("update.py")),
                              "update", "--home", str(self.home), "--clients-closed"],
                             env={"PATH": os.environ.get("PATH", "/usr/bin:/bin"), "HOME": str(self.home)},
                             capture_output=True, text=True, timeout=30)
        self.assertNotEqual(run.returncode, 0)
        reports = list((self.home / ".local/state/opencode-stack/install/diagnostics").glob("attempt-*"))
        self.assertEqual(len(reports), 1)
        self.assertIn(str(reports[0] / "NEXT-STEPS.md"), run.stderr)
        self.assertEqual(json.loads((reports[0] / "attempt.json").read_text())["status"], "stopped")
        self.assertEqual(original.read_text(), "SYNTHETIC_HISTORY_UNCHANGED")
        self.assertFalse((self.home / ".opencode").exists())
        self.assertFalse((self.home / ".local/share/opencode-stack/updates").exists())


if __name__ == "__main__":
    unittest.main()
