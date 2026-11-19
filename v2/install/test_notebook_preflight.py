import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
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


if __name__ == "__main__":
    unittest.main()
