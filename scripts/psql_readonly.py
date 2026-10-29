#!/usr/bin/env python3
"""Bounded SELECT queries through psql; no interactive client or credential input.

READ ONLY is enforced by PostgreSQL, not a promise of an OS/function sandbox.
Use a least-privilege database account and trusted server-side routines.
"""
import argparse
import os
import re
import selectors
import shutil
import signal
import subprocess
import sys
import time

MAX_BYTES = 262144
MAX_SQL = 16384
NAME = r'[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}'
SAFE_PG_FUNCTIONS = {
    'pg_backend_pid', 'pg_database_size', 'pg_encoding_to_char',
    'pg_get_constraintdef', 'pg_get_expr', 'pg_get_functiondef',
    'pg_get_indexdef', 'pg_get_serial_sequence', 'pg_get_userbyid',
    'pg_get_viewdef', 'pg_indexes_size', 'pg_is_in_recovery',
    'pg_relation_size', 'pg_size_pretty', 'pg_table_is_visible',
    'pg_total_relation_size', 'pg_typeof',
}


def bounded_int(low, high):
    def parse(value):
        if not re.fullmatch(r'[0-9]+', value) or not low <= int(value) <= high:
            raise argparse.ArgumentTypeError(f'Expected integer {low}..{high}')
        return int(value)
    return parse


def parser():
    cli = argparse.ArgumentParser(description=__doc__, allow_abbrev=False)
    verbs = cli.add_subparsers(dest='operation', required=True)
    verbs.add_parser('help', allow_abbrev=False)
    query = verbs.add_parser('query', allow_abbrev=False)
    query.add_argument('--service')
    query.add_argument('--host')
    query.add_argument('--port', type=bounded_int(1, 65535))
    query.add_argument('--database')
    query.add_argument('--user')
    query.add_argument('--sql', required=True)
    query.add_argument('--rows', type=bounded_int(1, 1000), default=100)
    query.add_argument('--timeout', type=bounded_int(1, 30), default=10)
    return cli


def select_sql(text):
    """Conservative lexical boundary, NOT a full SQL parser or function audit.

    No comments, dollar quotes, escapes or multiple statements. PostgreSQL parses
    the remaining expression inside a SELECT subquery in a READ ONLY transaction.
    """
    if not text or len(text.encode()) > MAX_SQL or '\\' in text or '\x00' in text:
        raise ValueError('SQL must be <=16 KiB, without backslash escapes or NUL')
    text = text.strip()
    masked, index = [], 0
    while index < len(text):
        char = text[index]
        if char in "'\"":
            quote, start = char, index
            index += 1
            while index < len(text):
                if text[index] == quote:
                    index += 1
                    if index < len(text) and text[index] == quote:
                        index += 1
                        continue
                    break
                index += 1
            else:
                raise ValueError('Unterminated SQL quote')
            # Keep quoted identifiers visible to the routine checks below.
            masked.append(text[start + 1:index - 1].replace('""', '"') if quote == '"' else ' ')
            continue
        if text[index:index + 2] in ('--', '/*') or char == '$':
            raise ValueError('SQL comments and dollar syntax are not accepted; submit a plain query')
        if char == ';':
            if index != len(text) - 1:
                raise ValueError('Only one SQL statement is allowed')
            text = text[:-1]
            break
        masked.append(char)
        index += 1
    visible = ''.join(masked)
    if re.search(r'\bU\s*&', visible, re.I):
        raise ValueError('Encoded SQL identifiers are not supported')
    if not re.match(r'^\s*(SELECT|WITH|VALUES)\b', visible, re.I):
        raise ValueError('Only SELECT, WITH or VALUES queries are supported')
    for call in re.findall(r'([A-Za-z_][A-Za-z_0-9]*)\s*\(', visible):
        call = call.lower()
        if ((call.startswith('pg_') and call not in SAFE_PG_FUNCTIONS)
                or call.startswith(('dblink', 'lo_'))
                or call in {'set_config', 'nextval', 'setval', 'query_to_xml',
                            'query_to_xmlschema', 'query_to_xml_and_xmlschema',
                            'database_to_xml', 'schema_to_xml', 'table_to_xml'}):
            raise ValueError('Administrative, external or dynamic-SQL routine is not approved')
    return text


def connection(args):
    fields = (args.host, args.port, args.database, args.user)
    if args.service:
        if any(value is not None for value in fields) or not re.fullmatch(NAME, args.service):
            raise ValueError('Use a literal libpq service OR explicit host/port/database/user')
        return ['--dbname=service=' + args.service]
    if not all(value is not None for value in (args.host, args.database, args.user)):
        raise ValueError('Explicit --host, --database and --user are required without --service')
    if not re.fullmatch(NAME, args.database) or not re.fullmatch(NAME, args.user):
        raise ValueError('Database/user must be literal identifiers, not URIs or connection strings')
    if not re.fullmatch(r'[A-Za-z0-9_./:-]{1,253}', args.host) or '..' in args.host:
        raise ValueError('Host must be a literal DNS/IP or Unix socket directory')
    return ['--host=' + args.host, '--port=' + str(args.port or 5432),
            '--dbname=' + args.database, '--username=' + args.user]


def prepare(args):
    sql = select_sql(args.sql)
    target = connection(args)
    binary = shutil.which('psql')
    if not binary:
        raise ValueError('psql is unavailable; install PostgreSQL client separately')
    env = dict(os.environ)
    # Keep libpq's existing authentication/SSL mechanisms, never source env files
    # or accept a password/URI/psql variable/psqlrc/SQL file on this interface.
    for key in list(env):
        if key in {'BASH_ENV', 'ENV', 'PYTHONPATH', 'PYTHONSTARTUP', 'PSQLRC',
                   'PSQL_EDITOR', 'PSQL_PAGER', 'PAGER'}:
            env.pop(key, None)
        elif key.startswith('PG') and not (key in {'PGPASSWORD', 'PGPASSFILE', 'PGSERVICEFILE',
                'PGCHANNELBINDING', 'PGGSSENCMODE', 'PGKRBSRVNAME'} or key.startswith('PGSSL')):
            env.pop(key, None)
    env.update(PGCONNECT_TIMEOUT='5', PGAPPNAME='opencode-planner-readonly',
               PGCLIENTENCODING='UTF8', PGOPTIONS='-c default_transaction_read_only=on -c standard_conforming_strings=on')
    statement = (f'BEGIN READ ONLY; SET LOCAL statement_timeout = {args.timeout * 1000}; '
                 'SET LOCAL lock_timeout = 2000; SET LOCAL search_path = pg_catalog, public; '
                 f'SELECT * FROM (\n{sql}\n) AS planner_result LIMIT {args.rows}; ROLLBACK;')
    command = [binary, '-X', '--no-password', '--quiet', '--csv', '--pset=pager=off',
               '--set=ON_ERROR_STOP=1', '--set=VERBOSITY=terse', *target, '--command=' + statement]
    return command, env


def execute(command, env, timeout, limit=MAX_BYTES):
    data, reason = bytearray(), None
    deadline = time.monotonic() + timeout
    with subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                          stderr=subprocess.STDOUT, env=env, start_new_session=True) as process:
        try:
            with selectors.DefaultSelector() as selector:
                selector.register(process.stdout, selectors.EVENT_READ)
                while True:
                    remaining = deadline - time.monotonic()
                    if remaining <= 0:
                        reason = 'client timeout; evidence incomplete'
                        break
                    if not selector.select(remaining):
                        continue
                    chunk = os.read(process.stdout.fileno(), min(4096, limit + 1 - len(data)))
                    if not chunk:
                        break
                    data.extend(chunk)
                    if len(data) > limit:
                        del data[limit:]
                        reason = 'output byte limit; evidence incomplete'
                        break
            if not reason:
                try:
                    process.wait(timeout=max(0.001, deadline - time.monotonic()))
                except subprocess.TimeoutExpired:
                    reason = 'client timeout; evidence incomplete'
        finally:
            if process.poll() is None:
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                process.wait()
    # Escape terminal controls. This does NOT sanitize secrets/PII in query data.
    output = ''.join(char if char >= ' ' or char in '\n\t' else f'\\x{ord(char):02x}'
                     for char in data.decode('utf-8', errors='replace'))
    if len(output.encode()) > limit:
        output = output.encode()[:limit].decode('utf-8', errors='ignore')
        reason = reason or 'escaped output byte limit; evidence incomplete'
    return output, 3 if reason else process.returncode, reason


def main(argv):
    cli = parser()
    args = cli.parse_args(argv)
    if args.operation == 'help':
        cli.print_help()
        print('query: --service NAME OR --host HOST [--port 5432] --database DB --user USER; --sql SQL')
        print('SELECT/WITH/VALUES only; --rows 1..1000 (100), --timeout 1..30 seconds (10); output <=256 KiB.')
        print('Existing libpq authentication only. No interactive psql, metacommands, passwords, URIs or SQL files.')
        return 0
    try:
        command, env = prepare(args)
        output, code, reason = execute(command, env, args.timeout + 8)
        if output:
            print(output, end='' if output.endswith('\n') else '\n')
        print(f'PostgreSQL inspection: at most {args.rows} rows; a full limit is potentially incomplete.', file=sys.stderr)
        if reason:
            print(reason, file=sys.stderr)
        return code
    except (ValueError, OSError) as error:
        print('PostgreSQL inspection blocked: ' + str(error), file=sys.stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
