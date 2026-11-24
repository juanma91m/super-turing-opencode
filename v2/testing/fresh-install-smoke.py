#!/usr/bin/env python3
"""Install from the current clean checkout in a disposable HOME (npm required)."""

import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile


ROOT = Path(__file__).resolve().parents[2]


def main():
    # Native discovery walks every project ancestor. Use a neutral temporary
    # parent, not a descendant of the user's configured project or HOME.
    with tempfile.TemporaryDirectory(prefix='opencode-fresh-') as scratch:
        root = Path(scratch).resolve()
        home, project = root / 'home', root / 'project'
        home.mkdir(mode=0o700)
        project.mkdir(mode=0o700)
        node = shutil.which('node')
        if not node:
            raise SystemExit('Node.js is required')
        env = {'HOME': str(home), 'PATH': os.environ['PATH'], 'TMPDIR': str(root),
               'TERM': 'dumb', 'LANG': 'C.UTF-8', 'GIT_CONFIG_NOSYSTEM': '1',
               'GIT_CONFIG_GLOBAL': '/dev/null'}

        def invoke(*args, budget=45):
            result = subprocess.run(args, cwd=project, env=env, capture_output=True, text=True, timeout=budget)
            if result.returncode != 0:
                raise RuntimeError(f'{Path(args[0]).name} {args[1:]} returned {result.returncode}: {result.stderr.strip()}')
            return result.stdout

        cli = ('bash', ROOT / 'install.sh')
        assert json.loads(invoke(*cli, 'plan-install'))['writesPerformed'] == 0
        assert not list(home.iterdir()), 'Preflight must not change HOME'
        installed = json.loads(invoke(*cli, 'install', budget=450))
        generation = Path(installed['generation'])
        assert generation.is_relative_to(home) and installed['profile'] == 'base'
        entry = home / '.opencode/bin/opencode'
        env['PATH'] = str(entry.parent) + os.pathsep + env['PATH']
        assert shutil.which('opencode', path=env['PATH']) == str(entry)
        assert invoke('opencode', '--version').strip() == 'opencode v2.2.7'
        assert Path(invoke('opencode', 'debug', 'paths', 'db').strip()) == generation / 'production-storage/data/opencode/opencode.db'
        config = generation / 'general/home/.config/opencode'
        sources = json.loads(invoke('opencode', 'debug', 'config'))
        assert any(item['type'] == 'document' and Path(item['path']).parent == config for item in sources)
        assert all(Path(item['path']).is_relative_to(config) for item in sources)
        assert json.loads(invoke('opencode', 'api', 'get', '/api/session'))['data'] == []
        assert json.loads(invoke('opencode', 'session', 'list', '--format', 'json')) == []

        report = json.loads(invoke(node, ROOT / 'v2/testing/fresh-install-smoke.mjs', generation, project, budget=60))
        assert report['startupAudit'] == 'pass' and report['providerConnected'] is False
        assert json.loads(invoke('opencode', 'api', 'get', '/api/session'))['data'] == []
        print(json.dumps({'status': 'pass', 'profile': 'base', 'version': installed['version'],
                          'isolatedStoreEmpty': True, 'configurationConfined': True, **report}))


if __name__ == '__main__':
    main()
