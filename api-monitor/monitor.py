"""
API Monitor - Standalone Health Check & Uptime Dashboard
=========================================================
Monitors all APIs used by LyricVault:
- LyricVault Backend (FastAPI)
- Google Gemini API
- syncedlyrics (Musixmatch, Netease, etc.)
- iTunes Search API

Run with: python monitor.py
Dashboard: http://localhost:5001
"""

import os
import time
import json
import threading
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from typing import Optional
from flask import Flask, render_template_string, jsonify
from dotenv import load_dotenv
import requests

load_dotenv()

# Configuration
LYRICVAULT_URL = os.getenv("LYRICVAULT_URL", "http://localhost:8000")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
CHECK_INTERVAL = int(os.getenv("CHECK_INTERVAL", "30"))

app = Flask(__name__)

@dataclass
class APIStatus:
    name: str
    status: str  # "online", "offline", "degraded", "unknown"
    latency_ms: Optional[float] = None
    last_check: Optional[str] = None
    error: Optional[str] = None
    details: Optional[str] = None

# Global state
api_statuses: dict[str, APIStatus] = {}
check_history: list[dict] = []

def check_lyricvault() -> APIStatus:
    """Check LyricVault backend health"""
    try:
        start = time.time()
        response = requests.get(f"{LYRICVAULT_URL}/", timeout=5)
        latency = (time.time() - start) * 1000
        
        if response.status_code == 200:
            data = response.json()
            return APIStatus(
                name="LyricVault Backend",
                status="online",
                latency_ms=round(latency, 2),
                last_check=datetime.now().isoformat(),
                details=data.get("message", "Running")
            )
        else:
            return APIStatus(
                name="LyricVault Backend",
                status="degraded",
                latency_ms=round(latency, 2),
                last_check=datetime.now().isoformat(),
                error=f"HTTP {response.status_code}"
            )
    except requests.exceptions.ConnectionError:
        return APIStatus(
            name="LyricVault Backend",
            status="offline",
            last_check=datetime.now().isoformat(),
            error="Connection refused - server not running?"
        )
    except Exception as e:
        return APIStatus(
            name="LyricVault Backend",
            status="offline",
            last_check=datetime.now().isoformat(),
            error=str(e)
        )

def check_gemini() -> APIStatus:
    """Check Google Gemini API connectivity"""
    if not GEMINI_API_KEY:
        return APIStatus(
            name="Google Gemini API",
            status="unknown",
            last_check=datetime.now().isoformat(),
            error="API key not configured"
        )
    
    try:
        from google import genai
        
        start = time.time()
        client = genai.Client(api_key=GEMINI_API_KEY)
        
        # Simple test - list models (lightweight)
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents="Reply with just the word: OK"
        )
        latency = (time.time() - start) * 1000
        
        if response and response.text:
            return APIStatus(
                name="Google Gemini API",
                status="online",
                latency_ms=round(latency, 2),
                last_check=datetime.now().isoformat(),
                details=f"Model: gemini-2.0-flash"
            )
        else:
            return APIStatus(
                name="Google Gemini API",
                status="degraded",
                latency_ms=round(latency, 2),
                last_check=datetime.now().isoformat(),
                error="Empty response"
            )
    except Exception as e:
        error_msg = str(e)
        if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
            return APIStatus(
                name="Google Gemini API",
                status="degraded",
                last_check=datetime.now().isoformat(),
                error="Rate limited (429)",
                details="API is accessible but quota exceeded"
            )
        return APIStatus(
            name="Google Gemini API",
            status="offline",
            last_check=datetime.now().isoformat(),
            error=error_msg[:100]
        )

def check_syncedlyrics() -> APIStatus:
    """Check syncedlyrics library connectivity"""
    try:
        import syncedlyrics
        
        start = time.time()
        # Test with a known song that should have lyrics
        result = syncedlyrics.search("Never Gonna Give You Up Rick Astley")
        latency = (time.time() - start) * 1000
        
        if result:
            return APIStatus(
                name="syncedlyrics (Musixmatch/Netease)",
                status="online",
                latency_ms=round(latency, 2),
                last_check=datetime.now().isoformat(),
                details=f"Test query successful ({len(result)} chars)"
            )
        else:
            return APIStatus(
                name="syncedlyrics (Musixmatch/Netease)",
                status="degraded",
                latency_ms=round(latency, 2),
                last_check=datetime.now().isoformat(),
                error="No results for test query"
            )
    except Exception as e:
        return APIStatus(
            name="syncedlyrics (Musixmatch/Netease)",
            status="offline",
            last_check=datetime.now().isoformat(),
            error=str(e)[:100]
        )

def check_itunes() -> APIStatus:
    """Check iTunes Search API"""
    try:
        start = time.time()
        response = requests.get(
            "https://itunes.apple.com/search",
            params={"term": "test", "media": "music", "limit": 1},
            timeout=10
        )
        latency = (time.time() - start) * 1000
        
        if response.status_code == 200:
            data = response.json()
            return APIStatus(
                name="iTunes Search API",
                status="online",
                latency_ms=round(latency, 2),
                last_check=datetime.now().isoformat(),
                details=f"Result count: {data.get('resultCount', 0)}"
            )
        else:
            return APIStatus(
                name="iTunes Search API",
                status="degraded",
                latency_ms=round(latency, 2),
                last_check=datetime.now().isoformat(),
                error=f"HTTP {response.status_code}"
            )
    except Exception as e:
        return APIStatus(
            name="iTunes Search API",
            status="offline",
            last_check=datetime.now().isoformat(),
            error=str(e)[:100]
        )

def run_all_checks():
    """Run all API health checks"""
    global api_statuses, check_history
    
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Running health checks...")
    
    api_statuses["lyricvault"] = check_lyricvault()
    api_statuses["gemini"] = check_gemini()
    api_statuses["syncedlyrics"] = check_syncedlyrics()
    api_statuses["itunes"] = check_itunes()
    
    # Add to history
    check_history.append({
        "timestamp": datetime.now().isoformat(),
        "statuses": {k: asdict(v) for k, v in api_statuses.items()}
    })
    
    # Keep only last 100 checks
    if len(check_history) > 100:
        check_history = check_history[-100:]
    
    # Print summary
    for key, status in api_statuses.items():
        icon = "✅" if status.status == "online" else "⚠️" if status.status == "degraded" else "❌"
        latency = f"{status.latency_ms}ms" if status.latency_ms else "N/A"
        print(f"  {icon} {status.name}: {status.status} ({latency})")

def background_checker():
    """Background thread for periodic checks"""
    while True:
        run_all_checks()
        time.sleep(CHECK_INTERVAL)

# Dashboard HTML
DASHBOARD_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Monitor - LyricVault</title>
    <meta http-equiv="refresh" content="10">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #0a0f1e 0%, #1a1f3e 100%);
            min-height: 100vh;
            color: #e2e8f0;
            padding: 2rem;
        }
        .header {
            text-align: center;
            margin-bottom: 2rem;
        }
        .header h1 { 
            font-size: 2rem; 
            background: linear-gradient(135deg, #a855f7, #ec4899);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .header p { color: #64748b; margin-top: 0.5rem; }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 1.5rem;
            max-width: 1400px;
            margin: 0 auto;
        }
        .card {
            background: rgba(30, 41, 59, 0.8);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 1rem;
            padding: 1.5rem;
            backdrop-filter: blur(10px);
        }
        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
        }
        .card h3 { font-size: 1.1rem; }
        .status-badge {
            padding: 0.25rem 0.75rem;
            border-radius: 999px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
        }
        .status-online { background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); }
        .status-degraded { background: rgba(234, 179, 8, 0.2); color: #facc15; border: 1px solid rgba(234, 179, 8, 0.3); }
        .status-offline { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
        .status-unknown { background: rgba(100, 116, 139, 0.2); color: #94a3b8; border: 1px solid rgba(100, 116, 139, 0.3); }
        .metric {
            display: flex;
            justify-content: space-between;
            padding: 0.5rem 0;
            border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .metric:last-child { border-bottom: none; }
        .metric-label { color: #64748b; font-size: 0.85rem; }
        .metric-value { font-weight: 500; }
        .error { color: #f87171; font-size: 0.85rem; margin-top: 0.5rem; }
        .footer {
            text-align: center;
            margin-top: 2rem;
            color: #64748b;
            font-size: 0.85rem;
        }
        .recheck-btn {
            background: linear-gradient(135deg, #a855f7, #ec4899);
            border: none;
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 0.5rem;
            cursor: pointer;
            font-size: 0.75rem;
            font-weight: 600;
            margin-top: 0.75rem;
            width: 100%;
            transition: all 0.2s;
        }
        .recheck-btn:hover { opacity: 0.9; transform: translateY(-1px); }
        .recheck-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .recheck-btn.loading { animation: pulse 1s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        .recheck-all {
            background: linear-gradient(135deg, #3b82f6, #06b6d4);
            margin-bottom: 1.5rem;
            max-width: 200px;
            margin-left: auto;
            margin-right: auto;
            display: block;
        }
    </style>
    <script>
        async function recheckService(service) {
            const btn = document.getElementById('btn-' + service);
            btn.disabled = true;
            btn.classList.add('loading');
            btn.textContent = 'Checking...';
            try {
                const resp = await fetch('/api/recheck/' + service, {method: 'POST'});
                const data = await resp.json();
                setTimeout(() => location.reload(), 500);
            } catch(e) {
                btn.textContent = 'Error!';
            }
        }
        async function recheckAll() {
            const btn = document.getElementById('btn-all');
            btn.disabled = true;
            btn.classList.add('loading');
            btn.textContent = 'Checking All...';
            try {
                await fetch('/api/recheck/all', {method: 'POST'});
                setTimeout(() => location.reload(), 1000);
            } catch(e) {
                btn.textContent = 'Error!';
            }
        }
    </script>
</head>
<body>
    <div class="header">
        <h1>🔍 API Monitor</h1>
        <p>LyricVault Service Health Dashboard</p>
        <button id="btn-all" class="recheck-btn recheck-all" onclick="recheckAll()">🔄 Recheck All</button>
    </div>
    
    <div class="grid">
        {% for key, status in statuses.items() %}
        <div class="card">
            <div class="card-header">
                <h3>{{ status.name }}</h3>
                <span class="status-badge status-{{ status.status }}">{{ status.status }}</span>
            </div>
            <div class="metric">
                <span class="metric-label">Latency</span>
                <span class="metric-value">{{ status.latency_ms or 'N/A' }}{% if status.latency_ms %}ms{% endif %}</span>
            </div>
            <div class="metric">
                <span class="metric-label">Last Check</span>
                <span class="metric-value">{{ status.last_check[:19] if status.last_check else 'Never' }}</span>
            </div>
            {% if status.details %}
            <div class="metric">
                <span class="metric-label">Details</span>
                <span class="metric-value">{{ status.details }}</span>
            </div>
            {% endif %}
            {% if status.error %}
            <div class="error">⚠️ {{ status.error }}</div>
            {% endif %}
            <button id="btn-{{ key }}" class="recheck-btn" onclick="recheckService('{{ key }}')">🔄 Recheck</button>
        </div>
        {% endfor %}
    </div>
    
    <div class="footer">
        <p>Auto-refreshes every 10 seconds • Check interval: {{ interval }}s</p>
    </div>
</body>
</html>
"""

@app.route("/")
def dashboard():
    return render_template_string(
        DASHBOARD_HTML,
        statuses={k: asdict(v) for k, v in api_statuses.items()},
        interval=CHECK_INTERVAL
    )

@app.route("/api/status")
def api_status():
    return jsonify({k: asdict(v) for k, v in api_statuses.items()})

@app.route("/api/history")
def api_history():
    return jsonify(check_history)

@app.route("/api/recheck/<service>", methods=["POST"])
def recheck_service(service):
    """Manually trigger a recheck for a specific service"""
    global api_statuses
    
    if service == "all":
        run_all_checks()
        return jsonify({"status": "ok", "message": "All services rechecked"})
    
    checkers = {
        "lyricvault": check_lyricvault,
        "gemini": check_gemini,
        "syncedlyrics": check_syncedlyrics,
        "itunes": check_itunes
    }
    
    if service not in checkers:
        return jsonify({"error": "Unknown service"}), 404
    
    print(f"[Manual Recheck] Checking {service}...")
    api_statuses[service] = checkers[service]()
    return jsonify({"status": "ok", "result": asdict(api_statuses[service])})

if __name__ == "__main__":
    print("=" * 50)
    print("  API Monitor - LyricVault Service Health")
    print("=" * 50)
    print(f"  Dashboard: http://localhost:5001")
    print(f"  Check Interval: {CHECK_INTERVAL}s")
    print(f"  LyricVault URL: {LYRICVAULT_URL}")
    print(f"  Gemini API Key: {'Configured' if GEMINI_API_KEY else 'Not set'}")
    print("=" * 50)
    
    # Run initial check
    run_all_checks()
    
    # Start background checker
    checker_thread = threading.Thread(target=background_checker, daemon=True)
    checker_thread.start()
    
    # Start Flask dashboard
    app.run(host="0.0.0.0", port=5001, debug=False)
