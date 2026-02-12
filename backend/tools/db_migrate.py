import argparse
import json
import os
import sys

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from database.database import DATABASE_PATH, engine
from database.migrations import run_migrations


def main():
    parser = argparse.ArgumentParser(description="Run LyricVault database migrations.")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true", help="Show pending migrations without applying.")
    mode.add_argument("--apply", action="store_true", help="Apply pending migrations.")
    args = parser.parse_args()

    result = run_migrations(engine, DATABASE_PATH, dry_run=bool(args.dry_run))
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
