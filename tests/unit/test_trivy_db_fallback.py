"""Offline regression checks for the governed Trivy DB download policy."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "scan-owned-images.sh"


class TrivyDatabaseFallbackTest(unittest.TestCase):
    def run_scanner(self, mode):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "scripts").mkdir()
            shutil.copy2(SCRIPT, root / "scripts" / "scan-owned-images.sh")
            bindir = root / "bin"
            bindir.mkdir()
            docker = bindir / "docker"
            docker.write_text("""#!/usr/bin/env python3
import datetime as dt
import json
import os
from pathlib import Path
import sys
args = sys.argv[1:]
with open(os.environ['TRIVY_TEST_CALLS'], 'a') as f:
    f.write(' '.join(args) + '\\n')
if '--download-db-only' in args:
    repo = args[args.index('--db-repository') + 1]
    if os.environ['TRIVY_TEST_MODE'] == 'fail' or repo.startswith('ghcr.io/'):
        sys.exit(1)
    cache = Path(args[args.index('-v') + 1].split(':')[0]) / 'db'
    cache.mkdir(parents=True, exist_ok=True)
    delta = -1 if os.environ['TRIVY_TEST_MODE'] == 'stale' else 1
    next_update = dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=delta)
    (cache / 'metadata.json').write_text(json.dumps({'NextUpdate': next_update.isoformat()}))
""")
            docker.chmod(0o755)
            node = bindir / "node"
            node.write_text("#!/bin/sh\nexit 0\n")
            node.chmod(0o755)
            calls = root / "calls.txt"
            env = os.environ.copy()
            env.update(PATH=f"{bindir}:{env['PATH']}", TRIVY_TEST_CALLS=str(calls), TRIVY_TEST_MODE=mode)
            result = subprocess.run(["bash", str(root / "scripts" / "scan-owned-images.sh"), "test-image:latest"], env=env, capture_output=True, text=True)
            return result, calls.read_text()

    def test_fallback_scans_after_primary_failure(self):
        result, calls = self.run_scanner('success')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(calls.count('ghcr.io/aquasecurity/trivy-db:2'), 2)
        self.assertIn('public.ecr.aws/aquasecurity/trivy-db:2', calls)
        self.assertIn('--network none', calls)

    def test_both_sources_unavailable_fail_closed(self):
        result, calls = self.run_scanner('fail')
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn('--network none', calls)
        self.assertIn('refusing to scan', result.stderr)

    def test_stale_db_fails_before_scanning(self):
        result, calls = self.run_scanner('stale')
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn('--network none', calls)
        self.assertIn('expired', result.stderr)


if __name__ == '__main__':
    unittest.main()
