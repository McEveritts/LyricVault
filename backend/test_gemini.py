"""Test Gemini integration for lyrics"""
import os
from dotenv import load_dotenv
load_dotenv()

from services.gemini_service import gemini_service

print(f"API Key configured: {gemini_service.is_available()}")

if gemini_service.is_available():
    # Test 1: Research known song
    print("\n=== Test 1: Research Known Song ===")
    lyrics = gemini_service.research_lyrics("Never Gonna Give You Up", "Rick Astley")
    if lyrics:
        print(f"Found lyrics! First 200 chars:\n{lyrics[:200]}...")
    else:
        print("No lyrics found")
    
    # Test 2: Research obscure song
    print("\n=== Test 2: Research Obscure Song ===")
    lyrics = gemini_service.research_lyrics("Melt", "Perkulat0r")
    if lyrics:
        print(f"Found lyrics! First 200 chars:\n{lyrics[:200]}...")
    else:
        print("No lyrics found (expected for obscure song)")
else:
    print("Gemini service not available - check API key")
