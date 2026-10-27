"""Checks existing debugging contract and Claude activation, not LLM behavior."""
import json
import os
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
CLAUDE = Path(os.environ.get('OPENCODE_HEURISTICS_SOURCES', str(ROOT.parent))) / 'super-turing-claude-code'
NAME = 'debugging-sistematico'
SKILL = (ROOT / f'skills/{NAME}/SKILL.md').read_text()
ROLES = ('dev-test', 'frontend-web-developer', 'backend-java-developer', 'backend-python-developer', 'backend-typescript-developer')


class DebuggingActivationTests(unittest.TestCase):
    def test_specific_discovery_metadata_is_preserved(self):
        header = SKILL.split('\n---\n', 1)[0]
        self.assertIn(f'name: {NAME}', header)
        description = json.loads(next(line.partition(': ')[2] for line in header.splitlines() if line.startswith('description: ')))
        self.assertTrue(description.startswith('Investiga bugs, fallos de tests o builds'))
        self.assertIn('fixes que no resolvieron la causa', description)

    def test_eight_diagnostic_steps_remain_ordered(self):
        steps = ('**Leer errores completos**', '**Reproducir**', '**Revisar cambios recientes**',
                 '**Seguir el flujo real**', '**Separar hechos e hipotesis**', '**Formular una sola hipotesis**',
                 '**Probar minimamente**', '**Recién después**')
        positions = []
        for number, heading in enumerate(steps, 1):
            positions.append(SKILL.index(f'{number}. {heading}'))
        self.assertEqual(positions, sorted(positions))

    def test_investigation_boundary_and_third_failed_fix_guard_remain(self):
        for clause in ('No proponer ni aplicar fixes sin investigacion previa.',
                       'No apilar varios cambios a la vez “a ver si alguno funciona”.',
                       'capturar evidencia en cada boundary antes de decidir.',
                       'Si el tercer intento de fix falla, frenar y cuestionar si el problema es de arquitectura o de entendimiento del sistema.',
                       'Si no entendés una parte crítica, decilo explícitamente.'):
            self.assertIn(clause, SKILL)

    def test_reproduction_and_validation_outputs_remain(self):
        output = SKILL.split('## Salida esperada\n', 1)[1].strip()
        self.assertEqual(output, '\n'.join(('- sintomas observados,', '- reproduccion,', '- hechos confirmados,',
                                           '- hipotesis vigente,', '- experimento o evidencia usada para confirmarla,',
                                           '- causa raiz,', '- fix propuesto o aplicado,', '- validacion.')))

    @unittest.skipUnless((CLAUDE / 'STACK-MANIFEST.json').exists(), 'Optional Claude source not available')
    def test_five_references_are_conditional_and_explicitly_readable(self):
        count = 0
        for role in ROLES:
            with self.subTest(role=role):
                text = (CLAUDE / f'base/agents/{role}.md').read_text()
                entries = [line for line in text.splitlines() if line.startswith(f'- `{NAME}`')]
                self.assertEqual(len(entries), 1)
                for clause in ('solo por pedido explícito', 'diagnosticar fallos inesperados/fixes no resueltos',
                               'sin `Skill`', '`Read`', f'~/.claude/skills/{NAME}/SKILL.md'):
                    self.assertIn(clause, entries[0])
                count += len(entries)
        self.assertEqual(count, 5)

    @unittest.skipUnless((CLAUDE / 'STACK-MANIFEST.json').exists(), 'Optional Claude source not available')
    def test_existing_read_tool_and_shared_binding_need_no_new_loader(self):
        for role in ROLES:
            text = (CLAUDE / f'base/agents/{role}.md').read_text()
            tools = next(line for line in text.split('\n---\n', 1)[0].splitlines() if line.startswith('tools: '))
            self.assertIn('Read', tools)
            self.assertNotIn('Skill', tools)
        link = CLAUDE / f'base/skills/{NAME}/SKILL.md'
        self.assertTrue(link.is_symlink())
        declared = json.loads((CLAUDE / 'STACK-MANIFEST.json').read_text())['crossStackSymlinks']['globalSkillsSymlinkedToOpencode']
        self.assertIn(NAME, declared)

    @unittest.skipUnless((CLAUDE / 'STACK-MANIFEST.json').exists(), 'Optional Claude source not available')
    def test_normal_validation_is_not_a_blanket_activation_rule(self):
        for role in ROLES:
            text = (CLAUDE / f'base/agents/{role}.md').read_text()
            entry = next(line for line in text.splitlines() if line.startswith(f'- `{NAME}`'))
            self.assertIn('fallos inesperados', entry)
            self.assertNotIn('siempre antes de validar', entry)
            self.assertNotIn('solo para incidentes complejos', entry)

    def test_documented_boundaries_have_existing_contract_support(self):
        # These are expected boundaries, not observed routing decisions from a model.
        activation = (CLAUDE / 'base/agents/dev-test.md').read_text() if (CLAUDE / 'base/agents/dev-test.md').exists() else ''
        cases = (
            ('normal-green', activation, 'diagnosticar fallos inesperados'),
            ('expected-tdd-red', activation, 'fallos inesperados/fixes no resueltos'),
            ('small-unexplained-bug', SKILL, 'Ante bugs, tests rotos, builds fallando o comportamiento inesperado.'),
            ('failed-fix', SKILL, 'uno o mas intentos de fix sin cerrar el problema'),
            ('third-fix', SKILL, 'Si el tercer intento de fix falla, frenar'),
            ('multiple-layers', SKILL, 'agregar evidencia en cada frontera antes de tocar codigo'),
            ('missing-context', SKILL, 'Si no entendés una parte crítica, decilo explícitamente'),
            ('explicit-request', activation, 'solo por pedido explícito'),
        )
        for case, text, clause in cases:
            if not text:
                continue  # Optional adapter sources may be absent in a standalone Core checkout.
            with self.subTest(case=case):
                self.assertIn(clause, text)


if __name__ == '__main__':
    unittest.main()
