from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class SkillMetadataTests(unittest.TestCase):
    def test_repaired_skills_have_discovery_metadata(self):
        for name in ('debugging-sistematico', 'verificacion-antes-de-cerrar', 'revision-por-etapas'):
            with self.subTest(skill=name):
                text = (ROOT / 'skills' / name / 'SKILL.md').read_text()
                self.assertTrue(text.startswith('---\n'))
                header = text.split('\n---', 1)[0]
                self.assertIn(f'\nname: {name}\n', header)
                self.assertRegex(header, r'\ndescription: .+')

    def test_context_gaps_do_not_require_a_feedback_form(self):
        for name in ('code-inspector', 'reviewer', 'dev-test', 'ui-web-designer',
                     'merge-conflict-resolver', 'backend-java-developer', 'frontend-web-developer'):
            with self.subTest(agent=name):
                text = (ROOT / 'agents' / f'{name}.md').read_text()
                self.assertNotIn('Contexto recibido:', text)
                self.assertNotIn('Sobró:', text)
                self.assertIn('Señalá solo faltantes de contexto que afecten el resultado.', text)


if __name__ == '__main__':
    unittest.main()
