#!/usr/bin/env python3
"""Read staged public source blobs, never working-tree secret/config/state files.

Bounded publication screen, not a guarantee that arbitrary code contains no secrets.
Diagnostics contain paths/reason codes only, never matched values.
"""
import json
from pathlib import PurePosixPath
import re
import subprocess
import sys


def git(root, *args):
    return subprocess.run(['git','-C',root,*args],capture_output=True,check=True).stdout


def audit(root):
    names=[p for p in git(root,'diff','--cached','--name-only','--diff-filter=ACMR','-z').decode().split('\0') if p]
    findings=[]
    patterns=[('github-token',rb'(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})'),
              ('private-key',rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
              ('aws-key',rb'\bAKIA[0-9A-Z]{16}\b')]
    for name in names:
        parts=PurePosixPath(name).parts
        if any((p.startswith('.env') and p!='.env.example') or p in ['.engram','.ssh','.gnupg','node_modules','auth.json','credentials.json','knowledge-sync.conf'] for p in parts) or name.endswith(('.db','.sqlite','.pem','.key','.p12','.pfx')):
            findings.append({'path':name,'reason':'private-or-runtime-path'});continue
        data=git(root,'show',':'+name)
        for code,pattern in patterns:
            if re.search(pattern,data):findings.append({'path':name,'reason':code})
    whitespace=subprocess.run(['git','-C',root,'diff','--cached','--check'],capture_output=True)
    if whitespace.returncode:findings.append({'path':'(index)','reason':'whitespace-check'})
    return {'repository':root,'stagedFiles':len(names),'findings':findings,'status':'pass' if not findings else 'refused','scope':'staged public source, bounded screen; no working-tree secret read'}


if __name__=='__main__':
    failed=False
    for root in sys.argv[1:]:
        result=audit(root);print(json.dumps(result));failed|=result['status']!='pass'
    raise SystemExit(1 if failed else 0)
