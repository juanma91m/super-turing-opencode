from __future__ import annotations

import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]


def load_module(name: str, relative: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


audit = load_module("check_local_overlays", "scripts/check_local_overlays.py")
parity = load_module("check_overlay_sync", "scripts/check_overlay_sync.py")


class OverlayAuditTests(unittest.TestCase):
    def test_explicit_tool_restriction_is_accepted(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            global_agent = root / "global.md"
            local_agent = root / "local.md"
            global_agent.write_text("---\nmode: subagent\ntools:\n  playwright_*: true\n---\n", encoding="utf-8")
            local_agent.write_text("---\nmode: subagent\ntools:\n  playwright_*: false\n---\n", encoding="utf-8")
            with patch.object(audit, "GLOBAL_ROOT", root):
                item = audit.audit_agent(local_agent, global_agent, root)
            self.assertEqual(item.status, "OK")
            self.assertEqual([finding.severity for finding in item.findings], ["accepted"])

    def test_missing_tool_is_still_a_warning(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            global_agent = root / "global.md"
            local_agent = root / "local.md"
            global_agent.write_text("---\nmode: subagent\ntools:\n  playwright_*: true\n---\n", encoding="utf-8")
            local_agent.write_text("---\nmode: subagent\ntools:\n  bash: true\n---\n", encoding="utf-8")
            with patch.object(audit, "GLOBAL_ROOT", root):
                item = audit.audit_agent(local_agent, global_agent, root)
            self.assertEqual(item.status, "warning")
            self.assertEqual(item.findings[0].code, "agent.tool.missing")

    def test_irrelevant_gradle_allowlist_is_accepted_without_wrapper(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            global_agent = root / "global.md"
            local_agent = root / "local.md"
            global_agent.write_text(
                "---\nmode: subagent\npermission:\n  bash:\n    '*': ask\n    './gradlew spotlessApply*': allow\n---\n",
                encoding="utf-8",
            )
            local_agent.write_text("---\nmode: subagent\npermission:\n  bash:\n    '*': ask\n---\n", encoding="utf-8")
            with patch.object(audit, "GLOBAL_ROOT", root):
                item = audit.audit_agent(local_agent, global_agent, root)
            self.assertEqual(item.status, "OK")
            self.assertEqual(item.findings[0].code, "agent.permission.bash_not_applicable")

    def test_gradle_allowlist_is_required_when_wrapper_exists(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "gradlew").write_text("#!/bin/sh\n", encoding="utf-8")
            global_agent = root / "global.md"
            local_agent = root / "local.md"
            global_agent.write_text(
                "---\nmode: subagent\npermission:\n  bash:\n    '*': ask\n    './gradlew spotlessApply*': allow\n---\n",
                encoding="utf-8",
            )
            local_agent.write_text("---\nmode: subagent\npermission:\n  bash:\n    '*': ask\n---\n", encoding="utf-8")
            with patch.object(audit, "GLOBAL_ROOT", root):
                item = audit.audit_agent(local_agent, global_agent, root)
            self.assertEqual(item.status, "warning")
            self.assertEqual(item.findings[0].code, "agent.permission.bash_allow_missing")


class OverlayParityTests(unittest.TestCase):
    def make_roots(self, base: Path) -> tuple[Path, Path]:
        source = base / "source"
        target = base / "target"
        source.mkdir()
        target.mkdir()
        (source / "sync_manifest.txt").write_text("AGENTS.md\n.opencode/agents/\n", encoding="utf-8")
        (source / "obsolete_targets.txt").write_text(".opencode/old.md\n", encoding="utf-8")
        for root in (source, target):
            (root / "AGENTS.md").write_text("rules\n", encoding="utf-8")
            (root / ".opencode/agents").mkdir(parents=True)
            (root / ".opencode/agents/main.md").write_text("agent\n", encoding="utf-8")
        return source, target

    def test_matching_overlay_passes(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            source, target = self.make_roots(Path(temp))
            report = parity.build_report(source, target, source / "sync_manifest.txt", source / "obsolete_targets.txt")
            self.assertEqual(report["status"], "pass")

    def test_extra_and_obsolete_files_report_drift(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            source, target = self.make_roots(Path(temp))
            (target / ".opencode/agents/extra.md").write_text("extra\n", encoding="utf-8")
            (target / ".opencode/old.md").write_text("old\n", encoding="utf-8")
            report = parity.build_report(source, target, source / "sync_manifest.txt", source / "obsolete_targets.txt")
            self.assertEqual(report["status"], "drift")
            self.assertEqual(report["obsoletePresent"], [".opencode/old.md"])
            self.assertEqual(report["mismatches"][0]["extra"], ["extra.md"])

    def test_obsolete_file_cannot_remain_in_canonical_source(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            source, target = self.make_roots(Path(temp))
            (source / ".opencode/old.md").write_text("old\n", encoding="utf-8")
            report = parity.build_report(source, target, source / "sync_manifest.txt", source / "obsolete_targets.txt")
            self.assertEqual(report["status"], "drift")
            self.assertEqual(report["obsoleteInSource"], [".opencode/old.md"])

    def test_unsafe_manifest_entry_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            manifest = Path(temp) / "manifest.txt"
            manifest.write_text("../outside\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "insegura"):
                parity.read_entries(manifest, required=True)


if __name__ == "__main__":
    unittest.main()
