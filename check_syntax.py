import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

print("Checking models.py...")
try:
    from database import models
    print("models.py OK")
except Exception as e:
    print(f"models.py FAILED: {e}")

print("Checking migrations.py...")
try:
    from database import migrations
    print("migrations.py OK")
except Exception as e:
    print(f"migrations.py FAILED: {e}")

print("Checking ytdlp_manager.py...")
try:
    from services import ytdlp_manager
    print("ytdlp_manager.py OK")
except Exception as e:
    print(f"ytdlp_manager.py FAILED: {e}")

print("Checking settings_service.py...")
try:
    from services import settings_service
    print("settings_service.py OK")
except Exception as e:
    print(f"settings_service.py FAILED: {e}")
