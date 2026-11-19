#!/usr/bin/env python3
"""Validate literal shell against the composed role, no helper execution/env load."""
import fnmatch
import importlib.util
import json
from pathlib import Path
import sys
sys.dont_write_bytecode = True

try:
    payload = json.load(sys.stdin)
    broker_path = Path(payload['broker'])
    spec = importlib.util.spec_from_file_location('general_literal_contract', broker_path)
    broker = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(broker)
    command = payload['command']
    argv = broker.literal_argv(command)
    if payload.get('runtimeMatch'):
        matched = len(argv) >= 4 and argv[0] == 'python3' and Path(argv[1]).expanduser() == broker_path and argv[2] == 'helper'
        print(json.dumps(argv[3] if matched else None))
    else:
        effect = 'deny'
        for rule in payload['rules']:
            pattern = rule['resource']
            if fnmatch.fnmatchcase(command, pattern) or pattern.endswith(' *') and command == pattern[:-2]:
                effect = rule['effect']
        if effect == 'deny':
            raise ValueError('Outside read-only shell contract')
except Exception:
    print('Read-only shell must be literal and within the composed contract; values suppressed', file=sys.stderr)
    raise SystemExit(2)
