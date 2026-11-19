import os
from pathlib import Path
import subprocess
import sys
import unittest

HELPER=Path(__file__).with_name('git-askpass.py')

class AskpassTests(unittest.TestCase):
    def helper(self,prompt,account='fixture-user'):
        return subprocess.run([sys.executable,'-I','-B',HELPER,prompt],env={'OPENCODE_UPDATE_GITHUB_ACCOUNT':account,'PATH':'/nonexistent'},capture_output=True,text=True)

    def test_only_exact_github_prompt_and_valid_account_are_accepted(self):
        result=self.helper("Username for 'https://github.com': ")
        self.assertEqual(result.returncode,0);self.assertEqual(result.stdout,'fixture-user\n')
        for prompt in ["Username for 'https://github.com.evil.invalid': ","Password for 'https://evil.invalid/github.com': ","Password for 'https://github.com@evil.invalid': ",'arbitrary @github.com prompt']:
            with self.subTest(prompt=prompt):
                result=self.helper(prompt);self.assertNotEqual(result.returncode,0);self.assertEqual(result.stdout,'')
        self.assertNotEqual(self.helper("Username for 'https://github.com': ",account='bad/account').returncode,0)

if __name__=='__main__':unittest.main()
