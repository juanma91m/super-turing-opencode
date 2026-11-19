#!/usr/bin/env python3
"""Git-only credential pipe. Token exists only in gh -> helper -> Git memory."""
import os
import re
import subprocess
import sys

account=os.environ.get('OPENCODE_UPDATE_GITHUB_ACCOUNT','')
prompt=sys.argv[1] if len(sys.argv)==2 else ''
if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9-]{0,38}',account) or not re.fullmatch(r"(?:Username|Password) for 'https://(?:[A-Za-z0-9-]+@)?github\.com': ?",prompt,re.I):
    raise SystemExit(1)
if prompt.lower().startswith('username'):
    print(account)
elif prompt.lower().startswith('password'):
    env={key:value for key,value in os.environ.items() if key not in ['GH_TOKEN','GITHUB_TOKEN','GH_ENTERPRISE_TOKEN','GITHUB_ENTERPRISE_TOKEN']}
    result=subprocess.run(['gh','auth','token','--hostname','github.com','--user',account],env=env,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=30)
    if result.returncode or not result.stdout.strip():raise SystemExit(1)
    sys.stdout.buffer.write(result.stdout.strip()+b'\n')
else:
    raise SystemExit(1)
