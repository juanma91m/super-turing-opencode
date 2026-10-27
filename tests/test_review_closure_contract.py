"""Stage B text/metadata regressions; examples do not execute an LLM classifier."""
import json
import os
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
CLAUDE = Path(os.environ.get('OPENCODE_HEURISTICS_SOURCES', str(ROOT.parent))) / 'super-turing-claude-code'
VERIFY = 'verificacion-antes-de-cerrar'
REVIEW = 'revision-por-etapas'
V = (ROOT / f'skills/{VERIFY}/SKILL.md').read_text()
R = (ROOT / f'skills/{REVIEW}/SKILL.md').read_text()
ROLES = ('dev-test', 'reviewer', 'frontend-web-developer', 'backend-java-developer',
         'backend-python-developer', 'backend-typescript-developer', 'merge-conflict-resolver')
HANDOFF = '- Usar `verdict.md` y `result-dev.md` como referencias solo si hay handoff de implementación aplicable/activo y archivos existentes. No exigirlos ni crear carpetas en tareas ad-hoc, review interno sin handoff o proyectos que solo habilitan code review.'


class ReviewClosureContractTests(unittest.TestCase):
    def test_selective_discovery_metadata_and_explicit_requests(self):
        for name, text in ((VERIFY, V), (REVIEW, R)):
            with self.subTest(skill=name):
                header = text.split('\n---\n', 1)[0]
                self.assertIn(f'name: {name}', header)
                description = json.loads(next(line.partition(': ')[2] for line in header.splitlines() if line.startswith('description: ')))
                self.assertTrue(description.startswith('Usar '))
                self.assertIn('pedido explícito', description)
                self.assertIn('no ', description)

    def test_final_response_alone_does_not_trigger_verification_framework(self):
        self.assertNotIn('- Antes de entregar resultado final o pedir review.', V)
        self.assertIn('No por una confirmación sin cambios ni afirmaciones nuevas', V)
        self.assertIn('pertinencia, cobertura o vigencia', V)

    def test_central_evidence_requirement_is_preserved(self):
        self.assertIn('Si no corriste la verificación en este trabajo y no leíste el resultado, no afirmes que está bien.', V)
        self.assertIn('no solo con un comando “verde”', V)
        self.assertIn('se cargue o no esta skill', V)

    def test_valid_evidence_can_be_reused_in_same_work_without_ritual_rerun(self):
        self.assertIn('ya se ejecutó y su resultado se leyó en este trabajo', V)
        self.assertIn('sigue vigente para ese estado', V)
        self.assertIn('no repetir por ritual', V)
        self.assertIn('No usar evidencia histórica o no inspeccionada como prueba vigente', V)

    def test_invalidating_changes_require_revalidation(self):
        for word in ('código', 'formatter', 'configuración', 'dependencias', 'entorno'):
            self.assertIn(word, V)
        self.assertIn('invalidan la evidencia, revalidar lo afectado', V)

    def test_verification_scope_is_sufficient_not_automatically_full_suite(self):
        self.assertIn('suficiente para la afirmación y el alcance', V)
        self.assertIn('no exige por defecto toda la suite', V)
        self.assertIn('Preservar las validaciones requeridas por usuario o contrato local', V)

    def test_no_permission_expansion_or_false_success_when_verification_unavailable(self):
        self.assertIn('No habilita comandos fuera del rol ni salta confirmaciones', V)
        self.assertIn('declarar qué queda sin comprobar y por qué; no afirmar que pasó', V)

    def test_evidence_kind_and_behavioral_relevance_remain_distinct(self):
        for clause in ('Linter ok no implica build ok.', 'Build ok no implica tests ok.',
                       'Cambio aplicado no implica bug resuelto.',
                       'Un test verde desconectado del comportamiento esperado tampoco implica cierre.'):
            self.assertIn(clause, V)

    def test_specific_review_checklists_and_order_remain(self):
        self.assertLess(R.index('## Etapa 1: cumplimiento contra intención'), R.index('## Etapa 2: calidad y riesgo técnico'))
        for question in ('¿Cumple el objetivo pedido?', '¿Respeta plan, spec, `verdict.md` o alcance explícito?',
                         '¿Cubre los criterios de aceptación o escenarios clave, si existían?',
                         '¿Falta algo importante?', '¿Agregó comportamiento no pedido o abrió scope nuevo?',
                         '¿Hay riesgos de regresión?', '¿Hay problemas de compatibilidad, performance, concurrencia o contratos?',
                         '¿La validación ejecutada es suficiente para el tipo de cambio?',
                         '¿Hay deuda, supuestos no probados o zonas frágiles?'):
            self.assertIn(question, R)
        self.assertIn('Si falla la etapa 1, marcarlo primero', R)

    def test_review_is_not_triggered_by_old_handoff_or_duplicate_formal_workflow(self):
        self.assertIn('No por la mera existencia de un plan, ticket o handoff', R)
        self.assertIn('si el procedimiento aplicado ya cubre las etapas, no duplicarlo', R)
        self.assertIn('no crear una revisión formal ad-hoc', R)
        self.assertIn('Cargues o no esta skill', R)
        self.assertIn('code-review-branch-to-branch', R)

    def test_literal_handoff_guard_and_materiality_are_preserved(self):
        self.assertIn(HANDOFF, R)
        self.assertIn('Separar bloqueantes de no bloqueantes.', R)
        self.assertIn('Citar evidencia por cada observación importante.', R)

    def test_proportional_output_preserves_required_formats(self):
        self.assertIn('no un formulario vacío', V)
        self.assertIn('no seis bloques vacíos', R)
        for text in (V, R):
            self.assertIn('formatos locales exigidos', text)
            self.assertIn('No cargarlas como paquete automático', text)
        for clause in ('snapshot', 'conversación', 'rereview', 'storage'):
            self.assertIn(clause, R)

    def test_documented_boundary_examples_have_supporting_clauses(self):
        # Desired selection remains a contract, not a measured model decision.
        cases = (
            ('confirmation', V, 'confirmación sin cambios ni afirmaciones nuevas'),
            ('unverified-success', V, 'no afirmar que pasó'),
            ('still-valid', V, 'no repetir por ritual'),
            ('invalidated', V, 'revalidar lo afectado'),
            ('unrelated-green', V, 'Un test verde desconectado'),
            ('read-only', V, 'No habilita comandos fuera del rol'),
            ('wrong-scope', R, 'Si falla la etapa 1, marcarlo primero'),
            ('formal-review', R, 'si el procedimiento aplicado ya cubre las etapas, no duplicarlo'),
            ('old-handoff', R, 'handoff de implementación aplicable/activo y archivos existentes'),
            ('explicit-request', V + R, 'Por pedido explícito'),
        )
        for case, text, clause in cases:
            with self.subTest(case=case):
                self.assertIn(clause, text)

    @unittest.skipUnless((CLAUDE / 'STACK-MANIFEST.json').exists(), 'Optional Claude source not available')
    def test_eight_conditional_claude_entries_use_existing_read_access(self):
        counts = {VERIFY: 0, REVIEW: 0}
        for role in ROLES:
            text = (CLAUDE / f'base/agents/{role}.md').read_text()
            tools = next(line for line in text.split('\n---\n', 1)[0].splitlines() if line.startswith('tools: '))
            self.assertIn('Read', tools)
            self.assertNotIn('Skill', tools)
            for name in (VERIFY, REVIEW):
                entries = [line for line in text.splitlines() if line.startswith(f'- `{name}`')]
                expected = role != 'merge-conflict-resolver' if name == VERIFY else role in ('reviewer', 'merge-conflict-resolver')
                self.assertEqual(len(entries), int(expected))
                for entry in entries:
                    counts[name] += 1
                    for clause in ('solo por pedido explícito', 'sin `Skill`', '`Read`', f'~/.claude/skills/{name}/SKILL.md'):
                        self.assertIn(clause, entry)
        self.assertEqual(counts, {VERIFY: 6, REVIEW: 2})

    @unittest.skipUnless((CLAUDE / 'STACK-MANIFEST.json').exists(), 'Optional Claude source not available')
    def test_existing_shared_bindings_remain_declared(self):
        declared = json.loads((CLAUDE / 'STACK-MANIFEST.json').read_text())['crossStackSymlinks']['globalSkillsSymlinkedToOpencode']
        for name in (VERIFY, REVIEW):
            link = CLAUDE / f'base/skills/{name}/SKILL.md'
            self.assertTrue(link.is_symlink())
            self.assertIn(name, declared)


if __name__ == '__main__':
    unittest.main()
