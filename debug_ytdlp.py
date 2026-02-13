import sys
import os
import subprocess

print(f"Executable: {sys.executable}")
print(f"CWD: {os.getcwd()}")

try:
    import yt_dlp
    print(f"yt_dlp location: {os.path.dirname(yt_dlp.__file__)}")
    print(f"yt_dlp version: {yt_dlp.version.__version__}")
except Exception as e:
    print(f"Error importing yt_dlp: {e}")

try:
    res = subprocess.run([sys.executable, "-m", "pip", "--version"], capture_output=True, text=True)
    print(f"pip version: {res.stdout.strip()}")
    print(f"pip stderr: {res.stderr.strip()}")
except Exception as e:
    print(f"Error running pip: {e}")
