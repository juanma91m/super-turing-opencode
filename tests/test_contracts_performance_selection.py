"""Stage C contract checks and examples, not measured LLM selection or behavior."""
import json
import os
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
CLAUDE = Path(os.environ.get('OPENCODE_HEURISTICS_SOURCES', str(ROOT.parent))) / 'super-turing-claude-code'
CONTRACTS = 'contratos-api-y-datos'
PERFORMANCE = 'performance-cache-concurrencia'
NAMES = (CONTRACTS, PERFORMANCE)
TEXT = {name: (ROOT / f'skills/{name}/SKILL.md').read_text() for name in NAMES}
ROLES = ('reviewer', 'code-reviewer', 'backend-java-developer', 'backend-python-developer', 'backend-typescript-developer')
CHECKLISTS = {
    CONTRACTS: (
        '- Pido revisar contratos REST y SOAP, errores, timeouts, idempotencia y trazabilidad.',
        '- Refuerzo compatibilidad hacia atras en endpoints, payloads, serializacion y manejo de errores.',
        '- Hago pensar el acceso a datos en terminos de cardinalidad, joins, filtros, indices, locks y costo.',
        '- Evito cambios que rompan integraciones externas por detalles no validados.',
    ),
    PERFORMANCE: (
        '- Obligo a evaluar costo, contencion y consistencia antes de cerrar un cambio sensible.',
        '- Refuerzo analisis de cardinalidad, indices, scans, locks, round trips y puntos de bloqueo.',
        '- Hago explicitar fuente de verdad, estrategia de refresh e invalidacion de cache.',
        '- Pido considerar transacciones, idempotencia, orden de ejecucion y riesgos de concurrencia.',
    ),
}
OUTPUTS = {
    CONTRACTS: ('- Contratos afectados.', '- Riesgos de compatibilidad o integracion.', '- Impacto en acceso a datos.', '- Validaciones necesarias.'),
    PERFORMANCE: ('- Impacto potencial en performance.', '- Riesgos de cache, transacciones o concurrencia.', '- Supuestos tecnicos que hay que validar.', '- Mitigaciones o chequeos recomendados.'),
}


def section(text, heading):
    return text.split(heading + '\n', 1)[1].split('\n## ', 1)[0].strip()


class ContractsPerformanceSelectionTests(unittest.TestCase):
    def test_both_have_selective_discovery_metadata(self):
        for name in NAMES:
            with self.subTest(skill=name):
                header = TEXT[name].split('\n---\n', 1)[0]
                self.assertIn(f'name: {name}\n', header)
                description = json.loads(next(line.partition(': ')[2] for line in header.splitlines() if line.startswith('description: ')))
                for clause in ('Usar ', 'pedido explícito', 'no por la sola presencia'):
                    self.assertIn(clause, description)

    def test_contracts_selects_affected_surface_not_project_stack(self):
        text = TEXT[CONTRACTS]
        self.assertNotIn('- En APIs, clientes externos, colas o integraciones entre sistemas.', text)
        self.assertIn('semántica/datos compartidos', text)
        self.assertIn('no por la sola presencia de API/DB', text)
        self.assertIn('acceso a datos con riesgo de costo o bloqueo', text)

    def test_performance_selects_plausible_risk_not_backend_label(self):
        text = TEXT[PERFORMANCE]
        self.assertNotIn('- En cambios que tocan queries, ORM, transacciones o base de datos.', text)
        self.assertIn('superficie afectada o riesgo plausible', text)
        self.assertIn('no por la sola presencia de backend/DB/cache', text)

    def test_specific_checklists_remain_literal(self):
        for name in NAMES:
            with self.subTest(skill=name):
                self.assertEqual(section(TEXT[name], '## Que hago'), '\n'.join(CHECKLISTS[name]))

    def test_eight_output_bullets_remain_literal(self):
        for name in NAMES:
            with self.subTest(skill=name):
                self.assertEqual(section(TEXT[name], '## Salida esperada'), '\n'.join(OUTPUTS[name]))

    def test_absence_of_incident_or_metrics_does_not_imply_safety(self):
        self.assertIn('No exigir una rotura demostrada', TEXT[CONTRACTS])
        self.assertIn('un cambio pequeño puede afectar consumidores', TEXT[CONTRACTS])
        self.assertIn('No exigir un incidente o benchmark', TEXT[PERFORMANCE])
        self.assertIn('Sin métricas, declarar supuestos: no inferir inocuidad', TEXT[PERFORMANCE])

    def test_covered_risk_does_not_require_fixed_pair_or_erase_checklist(self):
        for name in NAMES:
            with self.subTest(skill=name):
                self.assertIn('no duplicar el mismo análisis', TEXT[name])
                self.assertIn('No cargarlas como paquete fijo', TEXT[name])
                self.assertIn('skill local', TEXT[name])
        self.assertIn('el checklist SQL sigue vigente', TEXT[CONTRACTS])

    def test_scope_and_authority_remain_local(self):
        for name in NAMES:
            with self.subTest(skill=name):
                self.assertIn('preservar formatos y reglas locales', TEXT[name])
                self.assertIn('solo ítems aplicables', TEXT[name])
        self.assertIn('sin bloques vacíos ni inventar una DB afectada', TEXT[CONTRACTS])
        self.assertIn('La skill no amplía permisos', TEXT[CONTRACTS])
        self.assertIn('No autoriza benchmarks, DBs, migraciones ni indexado', TEXT[PERFORMANCE])

    def test_documented_boundary_examples_have_contract_support(self):
        # Desired behavior is specified, not inferred from a fake routing algorithm.
        cases = (
            ('presentation', CONTRACTS, 'no por la sola presencia de API/DB'),
            ('backend-only', PERFORMANCE, 'no por la sola presencia de backend/DB/cache'),
            ('payload', CONTRACTS, 'endpoints, payloads, serializacion'),
            ('shared-semantics', CONTRACTS, 'semántica/datos compartidos'),
            ('query-loop', PERFORMANCE, 'cardinalidad, indices, scans, locks, round trips'),
            ('cache-refresh', PERFORMANCE, 'fuente de verdad, estrategia de refresh e invalidacion'),
            ('schema-compatibility', CONTRACTS, 'compatibilidad hacia atras'),
            ('race', PERFORMANCE, 'idempotencia, orden de ejecucion y riesgos de concurrencia'),
            ('missing-metrics', PERFORMANCE, 'no inferir inocuidad'),
            ('covered-workflow', CONTRACTS, 'no duplicar el mismo análisis'),
            ('local-specialization', PERFORMANCE, 'preservar formatos y reglas locales'),
            ('explicit-both', CONTRACTS, 'Por pedido explícito'),
        )
        for case, name, clause in cases:
            with self.subTest(case=case):
                self.assertIn(clause, TEXT[name])

    def test_core_catalog_still_distributes_both_skills(self):
        managed = json.loads((ROOT / 'STACK-MANIFEST.json').read_text())['managedFiles']
        for name in NAMES:
            self.assertIn(f'skills/{name}/SKILL.md', managed)

    @unittest.skipUnless((CLAUDE / 'STACK-MANIFEST.json').exists(), 'Optional Claude source not available')
    def test_ten_conditional_entries_keep_existing_read_access(self):
        counts = dict.fromkeys(NAMES, 0)
        for role in ROLES:
            text = (CLAUDE / f'base/agents/{role}.md').read_text()
            tools = next(line for line in text.split('\n---\n', 1)[0].splitlines() if line.startswith('tools: '))
            self.assertIn('Read', tools)
            self.assertNotIn('Skill', tools)
            for name in NAMES:
                entries = [line for line in text.splitlines() if line.startswith(f'- `{name}`')]
                self.assertEqual(len(entries), 1)
                counts[name] += 1
                for clause in ('solo por pedido explícito', 'sin `Skill`', '`Read`', f'~/.claude/skills/{name}/SKILL.md'):
                    self.assertIn(clause, entries[0])
        self.assertEqual(counts, {CONTRACTS: 5, PERFORMANCE: 5})

    @unittest.skipUnless((CLAUDE / 'STACK-MANIFEST.json').exists(), 'Optional Claude source not available')
    def test_shared_bindings_are_declared_without_independent_copies(self):
        declared = json.loads((CLAUDE / 'STACK-MANIFEST.json').read_text())['crossStackSymlinks']['globalSkillsSymlinkedToOpencode']
        for name in NAMES:
            link = CLAUDE / f'base/skills/{name}/SKILL.md'
            self.assertTrue(link.is_symlink())
            self.assertIn(name, declared)
            self.assertTrue(str(link.readlink()).endswith(f'/.config/opencode/skills/{name}/SKILL.md'))


if __name__ == '__main__':
    unittest.main()
