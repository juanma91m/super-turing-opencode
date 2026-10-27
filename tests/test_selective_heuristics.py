"""Text/metadata regressions, not a classifier or an evaluation of LLM behavior."""
import json
import os
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
BASE = Path(os.environ.get('OPENCODE_HEURISTICS_SOURCES', str(ROOT.parent)))
CLAUDE = BASE / 'super-turing-claude-code'
NAMES = ('analisis-tecnico-evidencia', 'cambio-seguro-enterprise')
ROLES = ('planner', 'code-inspector', 'code-reviewer', 'reviewer', 'dev-test',
         'merge-conflict-resolver', 'backend-java-developer', 'backend-python-developer',
         'backend-typescript-developer', 'frontend-web-developer')


def text(name):
    return (ROOT / 'skills' / name / 'SKILL.md').read_text()


class SelectiveHeuristicsTests(unittest.TestCase):
    def test_both_skills_have_selective_discovery_metadata(self):
        for name in NAMES:
            with self.subTest(skill=name):
                header = text(name).split('\n---\n', 1)[0]
                self.assertIn(f'name: {name}\n', header)
                description = json.loads(next(line.partition(': ')[2] for line in header.splitlines() if line.startswith('description: ')))
                self.assertTrue(description.startswith('Usar '))
                self.assertIn('pedido explícito', description)
                self.assertIn('no ', description)

    def test_evidence_no_longer_triggers_before_any_solution(self):
        skill = text(NAMES[0])
        self.assertNotIn('- Antes de proponer una solucion tecnica.', skill)
        self.assertIn('No por hacer planning', skill)
        self.assertIn('una consulta puntual puede bastar', skill)
        self.assertIn('evidencia incompleta o contradictoria', skill)

    def test_safe_change_is_not_triggered_by_enterprise_label_or_diff_size(self):
        skill = text(NAMES[1])
        self.assertIn('No por la etiqueta enterprise/legacy', skill)
        self.assertIn('una línea puede afectar auth o datos', skill)
        self.assertIn('riesgos plausibles', skill)

    def test_evidence_obligations_remain_without_loading(self):
        skill = text(NAMES[0])
        for clause in ('Cargues o no esta skill', 'inferencias fundamentadas',
                       'no asumir que el código existente es correcto', 'evidencia concreta',
                       'validación realizada o pendiente'):
            self.assertIn(clause, skill)

    def test_safe_change_obligations_remain_without_loading(self):
        skill = text(NAMES[1])
        for clause in ('Cargues o no esta skill', 'flujo y patrón previo', 'compatibilidad',
                       'preservar trabajo ajeno', 'separar fix de cleanup', 'validación pertinente'):
            self.assertIn(clause, skill)

    def test_neither_skill_requires_empty_sections_or_a_fixed_pair(self):
        for name in NAMES:
            with self.subTest(skill=name):
                skill = text(name)
                self.assertIn('no cuatro secciones vacías', skill)
                self.assertIn('No cargarla como pareja fija', skill)
                self.assertIn('pedido explícito', skill)

    def test_selection_examples_have_supporting_contract_clauses(self):
        # These examples document desired selection; no inferred model decision is tested.
        cases = json.loads((ROOT / 'tests/fixtures/selective_heuristics.json').read_text())
        self.assertEqual(len(cases), 12)
        for case in cases:
            with self.subTest(case=case['id']):
                self.assertTrue(case['scenario'])
                self.assertTrue(case['expected_contract'])
                for name, clause in case['support']:
                    self.assertIn(clause, text(name))

    def test_catalog_still_distributes_both_skills(self):
        managed = json.loads((ROOT / 'STACK-MANIFEST.json').read_text())['managedFiles']
        for name in NAMES:
            self.assertIn(f'skills/{name}/SKILL.md', managed)

    @unittest.skipUnless((CLAUDE / 'STACK-MANIFEST.json').exists(), 'Optional Claude source not available')
    def test_claude_references_are_conditional_and_readable_without_new_tools(self):
        paths = [CLAUDE / 'base/agents' / (role + '.md') for role in ROLES]
        paths += [CLAUDE / 'addons/knowledge/agents/knowledge-curator.md']
        counts = dict.fromkeys(NAMES, 0)
        for path in paths:
            role = path.read_text()
            tools = next(line for line in role.split('\n---\n', 1)[0].splitlines() if line.startswith('tools: '))
            self.assertIn('Read', tools)
            self.assertNotIn('Skill', tools)
            for name in NAMES:
                entries = [line for line in role.splitlines() if line.startswith(f'- `{name}`')]
                self.assertEqual(len(entries), 0 if path.stem == 'code-reviewer' and name == NAMES[1] else 1)
                for entry in entries:
                    counts[name] += 1
                    for clause in ('solo por pedido explícito', 'sin `Skill`', '`Read`', f'~/.claude/skills/{name}/SKILL.md'):
                        self.assertIn(clause, entry)
        self.assertEqual(counts, {NAMES[0]: 11, NAMES[1]: 10})

    @unittest.skipUnless((CLAUDE / 'STACK-MANIFEST.json').exists(), 'Optional Claude source not available')
    def test_claude_shared_bindings_are_declared_without_independent_copies(self):
        declared = json.loads((CLAUDE / 'STACK-MANIFEST.json').read_text())['crossStackSymlinks']['globalSkillsSymlinkedToOpencode']
        for name in NAMES:
            link = CLAUDE / f'base/skills/{name}/SKILL.md'
            self.assertTrue(link.is_symlink())
            self.assertIn(name, declared)
            self.assertTrue(str(link.readlink()).endswith(f'/.config/opencode/skills/{name}/SKILL.md'))

    def test_optional_addon_templates_only_condition_existing_evidence_entry(self):
        found = 0
        for addon in ('knowledge', 'ticketing'):
            root = BASE / ('super-turing-opencode-' + addon)
            if not root.exists():
                continue
            for name in ('plan', 'build'):
                role = (root / 'agents' / (name + '.md')).read_text()
                entry = next(line for line in role.splitlines() if line.startswith(f'- `{NAMES[0]}`'))
                self.assertIn('solo por pedido explícito', entry)
                self.assertIn('no como paso rutinario', entry)
                self.assertNotIn(NAMES[1], role)
                found += 1
        if not found:
            self.skipTest('Optional addon sources not available')


if __name__ == '__main__':
    unittest.main()
