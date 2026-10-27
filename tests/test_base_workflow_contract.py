"""Shared role contracts; does not execute application or model workflows."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class BaseWorkflowTests(unittest.TestCase):
    def test_core_validator_reuses_current_evidence_and_runs_missing_checks(self):
        text = (ROOT / 'agents/dev-test.md').read_text()
        for clause in ('ejecutada/leída en este trabajo', 'sigue vigente', 'no repetir por ritual',
                       'validación faltante', 'checks obligatorios definidos por usuario/proyecto',
                       'revalidar lo afectado', 'sin afirmar éxito no verificado'):
            self.assertIn(clause, text)

    def test_core_reviewer_requires_applicable_active_handoff(self):
        text = (ROOT / 'agents/reviewer.md').read_text()
        for clause in ('aplicables al trabajo actual', 'workflow de implementación aplicable/activo y archivo existente',
                       'un ID o archivo viejo no activa handoff ni crea artefactos', 'no edites codigo ni configuracion'):
            self.assertIn(clause, text)

    def test_claude_validator_has_equivalent_sequence_when_available(self):
        path = ROOT.parent / 'super-turing-claude-code/base/agents/dev-test.md'
        if not path.exists():
            self.skipTest('Optional Claude source unavailable')
        core = (ROOT / 'agents/dev-test.md').read_text().split('Secuencia de trabajo:\n', 1)[1].split('\n\n', 1)[0]
        claude = path.read_text().split('Secuencia de trabajo:\n', 1)[1].split('\n\n', 1)[0]
        self.assertEqual(core.splitlines()[2:], claude.splitlines()[2:])


if __name__ == '__main__':
    unittest.main()
