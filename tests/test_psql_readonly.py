"""No real DB, credentials, SQL files or psql startup files are read by tests."""
from contextlib import redirect_stdout, redirect_stderr
import importlib.util
import io
import json
import os
from pathlib import Path
import shlex
import subprocess
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]


def load(name, relative):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


db = load('psql_readonly', 'scripts/psql_readonly.py')
broker = load('planner_shell', 'scripts/planner_shell.py')


class PostgreSQLReadOnlyTests(unittest.TestCase):
    def args(self, *extra):
        return db.parser().parse_args(['query', '--service', 'synthetic', '--sql', 'SELECT 1', *extra])

    def test_select_join_cte_aggregate_pagination_and_quoted_literals(self):
        for sql in ("SELECT count(*) FROM public.items", "WITH x AS (SELECT 1 id) SELECT * FROM x;",
                    "SELECT a.id FROM public.a a JOIN public.b b USING(id) ORDER BY a.id OFFSET 20",
                    "SELECT ';$--/*' AS \"odd;name\", 'O''Brien'", "VALUES (1), (2)",
                    "SELECT pg_catalog.pg_get_viewdef(123), pg_total_relation_size('public.items')"):
            with self.subTest(sql=sql):
                self.assertEqual(db.select_sql(sql), sql.rstrip(';'))

    def test_sql_escape_and_statement_boundaries_fail_closed(self):
        for sql in ("DELETE FROM t", "UPDATE t SET x=1", "CREATE TABLE t(x int)",
                    "COPY t TO PROGRAM 'id'", "DO 'anything'", 'CALL f()', 'EXPLAIN ANALYZE SELECT 1',
                    'SELECT 1; COMMIT; DELETE FROM t', 'SELECT 1;;', 'SELECT 1; --x',
                    'SELECT 1 --comment', 'SELECT /*comment*/ 1', r"SELECT E'\'; COMMIT; --'",
                    'SELECT $$x$$', 'SELECT $1', r'\! id', r'SELECT 1 \gexec', "SELECT 'unclosed",
                    'SELECT "unclosed', 'SELECT \x00', 'SELECT ' + 'x' * db.MAX_SQL):
            with self.subTest(sql=sql), self.assertRaises(ValueError):
                db.select_sql(sql)

    def test_known_side_effect_and_file_routines_are_not_approved(self):
        for name in ('pg_read_file', 'pg_ls_dir', 'pg_terminate_backend', 'pg_cancel_backend',
                     'pg_sleep', 'pg_advisory_lock', 'set_config', 'nextval', 'setval',
                     'dblink', 'dblink_exec', 'lo_export', 'query_to_xml'):
            for syntax in (name + "(1)", 'pg_catalog."' + name + '"(1)'):
                with self.subTest(syntax=syntax), self.assertRaises(ValueError):
                    db.select_sql('SELECT ' + syntax)
        with self.assertRaises(ValueError):
            db.select_sql('SELECT U&"pg!005fterminate_backend" UESCAPE \'!\'(1)')

    def test_exact_readonly_transaction_and_noninteractive_client(self):
        with patch.object(db.shutil, 'which', return_value='/usr/bin/psql'):
            command, env = db.prepare(self.args())
        for value in ('-X', '--no-password', '--quiet', '--csv', '--pset=pager=off', '--set=ON_ERROR_STOP=1'):
            self.assertIn(value, command)
        sql = command[-1]
        self.assertTrue(sql.startswith('--command=BEGIN READ ONLY;'))
        self.assertIn('SET LOCAL statement_timeout = 10000;', sql)
        self.assertIn('SET LOCAL lock_timeout = 2000;', sql)
        self.assertIn('SELECT * FROM (\nSELECT 1\n) AS planner_result LIMIT 100;', sql)
        self.assertTrue(sql.endswith('ROLLBACK;'))
        self.assertIn('default_transaction_read_only=on', env['PGOPTIONS'])
        self.assertIn('standard_conforming_strings=on', env['PGOPTIONS'])

    def test_connection_is_explicit_and_not_uri_or_conninfo(self):
        args = db.parser().parse_args(['query', '--host', 'localhost', '--database', 'fixture', '--user', 'reader', '--sql', 'SELECT 1'])
        self.assertEqual(db.connection(args), ['--host=localhost', '--port=5432', '--dbname=fixture', '--username=reader'])
        for flags in ([], ['--database', 'postgresql://user:synthetic@host/db'],
                      ['--host', 'localhost', '--database', 'db user=admin', '--user', 'reader'],
                      ['--service', 'fixture', '--user', 'reader'], ['--service', 'x options=bad'],
                      ['--host', 'localhost;id', '--database', 'db', '--user', 'reader']):
            with self.subTest(flags=flags), self.assertRaises(ValueError):
                db.connection(db.parser().parse_args(['query', '--sql', 'SELECT 1', *flags]))

    def test_existing_libpq_auth_survives_without_reading_or_printing_it(self):
        synthetic = {'PGPASSWORD':'synthetic-only', 'PGPASSFILE':'/synthetic/no-read',
                     'PGSERVICEFILE':'/synthetic/no-service-read', 'PGSSLMODE':'verify-full',
                     'PGOPTIONS':'-c default_transaction_read_only=off', 'PGHOST':'unwanted.invalid',
                     'PGDATABASE':'unwanted', 'PGUSER':'unwanted', 'PSQLRC':'/synthetic/no-read',
                     'BASH_ENV':'/synthetic/no-read', 'ENV':'/synthetic/no-read'}
        with patch.dict(os.environ, synthetic, clear=True), patch.object(db.shutil, 'which', return_value='/usr/bin/psql'):
            command, env = db.prepare(self.args())
        for name in ('PGPASSWORD', 'PGPASSFILE', 'PGSERVICEFILE', 'PGSSLMODE'):
            self.assertEqual(env[name], synthetic[name])
            self.assertNotIn(synthetic[name], ' '.join(command))
        for name in ('PGHOST', 'PGUSER', 'PGDATABASE', 'PSQLRC', 'BASH_ENV', 'ENV'):
            self.assertNotIn(name, env)
        self.assertNotEqual(env['PGOPTIONS'], synthetic['PGOPTIONS'])

    def test_flags_and_bounds_cannot_be_relaxed(self):
        for flags in (['--rows', '0'], ['--rows', '1001'], ['--timeout', '0'], ['--timeout', '31'],
                      ['--port', '65536'], ['--sql-file', 'x.sql'], ['--password', 'synthetic'],
                      ['--command', 'anything'], ['--set', 'x=y'], ['--out', 'file'], ['--row', '2']):
            with self.subTest(flags=flags), redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                self.args(*flags)

    def test_no_binary_no_target_and_invalid_sql_never_spawn(self):
        with patch.object(db.subprocess, 'Popen') as run, redirect_stderr(io.StringIO()):
            self.assertEqual(db.main(['query', '--sql', 'SELECT 1']), 2)
            self.assertEqual(db.main(['query', '--service', 'synthetic', '--sql', 'DELETE FROM t']), 2)
            with patch.object(db.shutil, 'which', return_value=None):
                self.assertEqual(db.main(['query', '--service', 'synthetic', '--sql', 'SELECT 1']), 2)
            run.assert_not_called()

    def test_help_does_not_connect_or_need_credentials(self):
        with patch.object(db.subprocess, 'Popen') as run, redirect_stdout(io.StringIO()):
            self.assertEqual(db.main(['help']), 0)
            run.assert_not_called()

    def test_client_byte_and_time_limits_are_errors(self):
        output, code, reason = db.execute([sys.executable, '-c', 'print("x"*10000)'], {}, 5, limit=512)
        self.assertLessEqual(len(output.encode()), 512)
        self.assertEqual(code, 3)
        self.assertIn('incomplete', reason)
        output, code, reason = db.execute([sys.executable, '-c', 'import time;time.sleep(5)'], {}, .05)
        self.assertEqual(code, 3)
        self.assertIn('timeout', reason)
        output, code, reason = db.execute([sys.executable, '-c', 'raise SystemExit(7)'], {}, 5)
        self.assertEqual(code, 7)
        self.assertIsNone(reason)

    def test_terminal_control_escaping_is_also_bounded(self):
        output, code, reason = db.execute([sys.executable, '-c', 'print(chr(27)*400)'], {}, 5, limit=512)
        self.assertNotIn('\x1b', output)
        self.assertLessEqual(len(output.encode()), 512)
        self.assertEqual(code, 3)

    def test_registry_uses_the_existing_broker_not_raw_psql(self):
        argv = ['psql-readonly', 'query', '--host', 'localhost', '--database', 'fixture', '--user', 'reader', '--sql', "SELECT 'a; b'"]
        command, _ = broker.helper_command(argv, ROOT, ROOT)
        self.assertEqual(command[1], str(ROOT / 'scripts/psql_readonly.py'))
        literal = shlex.join(['python3', str(broker.BROKER), 'helper', *argv])
        broker.check_invocation(literal, ROOT)
        for command in ('psql -d fixture', 'PGPASSWORD=synthetic psql -d fixture', literal + '; psql -d fixture'):
            with self.subTest(command=command), self.assertRaises(ValueError):
                broker.check_invocation(command, ROOT)
        for flags in (['--password', 'synthetic'], ['--file', 'query.sql'], ['--output', 'file']):
            with self.subTest(flags=flags), self.assertRaises(ValueError):
                broker.helper_command(argv + flags, ROOT, ROOT)

    def test_distribution_and_planner_guidance_own_this_generic_capability(self):
        manifest = json.loads((ROOT / 'STACK-MANIFEST.json').read_text())
        for asset in ('scripts/psql_readonly.py', 'planner-helpers/core-psql.json'):
            self.assertIn(asset, manifest['managedFiles'])
        self.assertIn('helper psql-readonly help', (ROOT / 'agents/planner.md').read_text())


if __name__ == '__main__':
    unittest.main()
