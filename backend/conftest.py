import atexit
import os
import shutil
import tempfile


# Keep tests hermetic: never touch the real user AppData DB/downloads/logs.
_test_appdata = tempfile.mkdtemp(prefix="lyricvault_test_appdata_")

# Ensure env is set before backend modules import and create engines/paths.
os.environ.setdefault("APPDATA", _test_appdata)
os.environ.setdefault("LOCALAPPDATA", _test_appdata)
os.environ.setdefault("LYRICVAULT_TESTING", "1")
os.environ.setdefault("LYRICVAULT_ENV", "development")


@atexit.register
def _cleanup_test_appdata():
    shutil.rmtree(_test_appdata, ignore_errors=True)

