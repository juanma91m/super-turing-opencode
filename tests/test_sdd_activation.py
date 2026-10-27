"""Stage E contract/metadata checks, not measured LLM routing or test quality."""
import json
import os
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
CLAUDE = Path(os.environ.get('OPENCODE_HEURISTICS_SOURCES', str(ROOT.parent))) / 'super-turing-claude-code'
NAME = 'sdd-tdd-bdd-pragmatico'
TEXT = (ROOT / f'skills/{NAME}/SKILL.md').read_text()
ROLES = ('planner', 'reviewer', 'code-reviewer', 'dev-test', 'frontend-web-developer',
         'backend-java-developer', 'backend-python-developer', 'backend-typescript-developer')


class SddActivationTests(unittest.TestCase):
    def test_original_discovery_metadata_is_retained(self):
        header = TEXT.split('\n---\n', 1)[0]
        self.assertIn(f'name: {NAME}\n', header)
        self.assertIn('compatibility: opencode', header)
        self.assertIn('description: SDD, TDD, BDD, criterios de aceptación, Given-When-Then', header)
        self.assertIn('sin imponer ceremonias rígidas.', header)

    def test_request_or_strategy_need_replaces_incidental_mention(self):
        self.assertNotIn('- Cuando el usuario menciona SDD, TDD, BDD, criterios de aceptación, Given/When/Then, escenarios o pruebas de regresión.', TEXT)
        self.assertIn('pide aplicar o explicar SDD/TDD/BDD', TEXT)
        self.assertIn('no por citar un test o una regresión con intención y validación ya resueltas', TEXT)

    def test_three_existing_need_based_triggers_remain(self):
        for line in ('- Antes de implementar si el alcance todavía está difuso.',
                     '- Cuando `planner`, `master-dev`, `reviewer` o `dev-test` necesitan trazar mejor la relación entre spec, cambio y validación.',
                     '- Cuando hace falta decidir si conviene test-first, repro-first o una validación más liviana.'):
            self.assertIn(line, TEXT)

    def test_sdd_and_bdd_stay_light_and_behavior_driven(self):
        for clause in ('Definir objetivo, alcance, no alcance y riesgos.',
                       'Mantener la spec liviana: no documentar más de lo que ayuda a decidir o validar.',
                       'No forzar Gherkin formal por reflejo.',
                       'Priorizar pocos escenarios de alto valor antes que un catálogo exhaustivo.'):
            self.assertIn(clause, TEXT)

    def test_test_first_and_legacy_alternatives_are_preserved(self):
        for clause in ('intentar primero con test o repro que falle.', 'failing repro acotado,',
                       'characterization test,', 'regression test después de reproducir,',
                       'validación manual o de integración explícita con evidencia.',
                       'No inflar tests solo para decir que hubo TDD.'):
            self.assertIn(clause, TEXT)

    def test_explicit_requests_are_not_silently_downgraded(self):
        self.assertIn('Pedidos explícitos y requisitos locales se respetan incluso en microcambios', TEXT)
        self.assertIn('explicitarlo y acordar una alternativa', TEXT)
        self.assertIn('no degradar silenciosamente TDD requerido', TEXT)
        self.assertIn('Un test concreto con estrategia fijada no exige otra spec formal', TEXT)

    def test_loading_sdd_does_not_activate_handoff_or_expand_role(self):
        for clause in ('no activa handoff', 'no inventa tickets ni exige archivos',
                       'no convierte review en implementación ni amplía permisos',
                       'Sin workflow habilitado, responder sin artefactos',
                       'si es requerido, conservar el contrato completo'):
            self.assertIn(clause, TEXT)

    def test_traceability_rules_and_output_are_retained(self):
        for clause in ('`planner`: objetivo, alcance, criterios o escenarios cuando sumen claridad, validación esperada.',
                       '`master-dev` e implementadores: qué comportamiento cambia, qué prueba o repro lo cubre y por qué no se hizo test-first si no convenía.',
                       '`reviewer`: cumplimiento contra criterios o escenarios antes de entrar en cosmética.',
                       '`dev-test`: qué criterios o escenarios quedaron validados y cuáles pendientes.',
                       'Build verde no prueba por sí solo comportamiento correcto.',
                       'Un test que no representa el comportamiento esperado no reemplaza la spec.',
                       'No forzar SDD/TDD/BDD en microcambios triviales.',
                       'Si el costo de automatizar es alto, decirlo explícitamente y dejar la mejor evidencia alternativa.'):
            self.assertIn(clause, TEXT)
        output = TEXT.split('## Salida esperada\n', 1)[1].strip()
        self.assertEqual(output, '\n'.join(('- comportamiento esperado,', '- criterios o escenarios relevantes,',
                                           '- estrategia de prueba o validación,', '- trazabilidad entre cambio y evidencia.')))

    def test_proportional_output_respects_local_reads_without_fixed_package(self):
        for clause in ('sin apartados vacíos', 'formatos y lecturas locales obligatorias',
                       'no cargar otros marcos como paquete'):
            self.assertIn(clause, TEXT)

    @unittest.skipUnless((CLAUDE / 'STACK-MANIFEST.json').exists(), 'Optional Claude source not available')
    def test_eight_conditional_entries_use_existing_read_tool(self):
        count = 0
        for role in ROLES:
            text = (CLAUDE / f'base/agents/{role}.md').read_text()
            tools = next(line for line in text.split('\n---\n', 1)[0].splitlines() if line.startswith('tools: '))
            self.assertIn('Read', tools)
            self.assertNotIn('Skill', tools)
            entries = [line for line in text.splitlines() if line.startswith(f'- `{NAME}`')]
            self.assertEqual(len(entries), 1)
            for clause in ('solo por pedido explícito', 'si falta definir criterios/escenarios o estrategia de pruebas',
                           'sin `Skill`', '`Read`', f'~/.claude/skills/{NAME}/SKILL.md'):
                self.assertIn(clause, entries[0])
            count += 1
        self.assertEqual(count, 8)

    @unittest.skipUnless((CLAUDE / 'STACK-MANIFEST.json').exists(), 'Optional Claude source not available')
    def test_existing_binding_stays_shared_and_declared(self):
        self.assertTrue((CLAUDE / f'base/skills/{NAME}/SKILL.md').is_symlink())
        declared = json.loads((CLAUDE / 'STACK-MANIFEST.json').read_text())['crossStackSymlinks']['globalSkillsSymlinkedToOpencode']
        self.assertIn(NAME, declared)


if __name__ == '__main__':
    unittest.main()
