"""
End-to-End Gemini Integration Test
===================================
Tests the full Gemini integration in the LyricVault backend:
1. Service initialization
2. Lyric research capability  
3. Audio transcription capability (if audio file exists)
"""

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from services.gemini_service import gemini_service

def test_initialization():
    """Test 1: Verify GeminiService initializes correctly"""
    print("\n" + "="*50)
    print("TEST 1: Service Initialization")
    print("="*50)
    
    if gemini_service.is_available():
        print("✅ GeminiService initialized successfully")
        print(f"   Model: {gemini_service.model}")
        print(f"   API Key: {'*' * 20}...")
        return True
    else:
        print("❌ GeminiService not available")
        print("   Check GEMINI_API_KEY in .env file")
        return False

def test_lyric_research():
    """Test 2: Test lyric research function"""
    print("\n" + "="*50)
    print("TEST 2: Lyric Research")
    print("="*50)
    
    if not gemini_service.is_available():
        print("⏭️ Skipped - Service not available")
        return None
    
    # Test with well-known song
    print("Testing with: 'Bohemian Rhapsody' by 'Queen'")
    
    try:
        lyrics = gemini_service.research_lyrics("Bohemian Rhapsody", "Queen")
        
        if lyrics:
            print("✅ Successfully retrieved lyrics!")
            print(f"   Length: {len(lyrics)} characters")
            print(f"   Preview: {lyrics[:100]}...")
            return True
        else:
            print("⚠️ No lyrics returned")
            print("   This could be due to rate limiting or the song not being found")
            return False
    except Exception as e:
        print(f"❌ Error during research: {e}")
        return False

def test_audio_transcription():
    """Test 3: Test audio transcription function"""
    print("\n" + "="*50)
    print("TEST 3: Audio Transcription")
    print("="*50)
    
    if not gemini_service.is_available():
        print("⏭️ Skipped - Service not available")
        return None
    
    # Check if we have any audio files
    downloads_dir = os.path.join(os.path.dirname(__file__), "downloads")
    if not os.path.exists(downloads_dir):
        print("⚠️ No downloads directory found")
        return None
    
    audio_files = [f for f in os.listdir(downloads_dir) if f.endswith('.mp3')]
    
    if not audio_files:
        print("⚠️ No audio files found to test transcription")
        return None
    
    test_file = os.path.join(downloads_dir, audio_files[0])
    print(f"Testing with: {audio_files[0]}")
    
    try:
        lyrics = gemini_service.transcribe_audio(test_file, "Test Song", "Test Artist")
        
        if lyrics:
            print("✅ Successfully transcribed audio!")
            print(f"   Length: {len(lyrics)} characters")
            print(f"   Preview: {lyrics[:100]}...")
            return True
        else:
            print("⚠️ Transcription returned no results")
            print("   This could be due to rate limiting or audio quality")
            return False
    except Exception as e:
        print(f"❌ Error during transcription: {e}")
        return False

def run_all_tests():
    """Run all tests and summarize"""
    print("\n")
    print("╔" + "═"*48 + "╗")
    print("║" + " GEMINI INTEGRATION TEST SUITE ".center(48) + "║")
    print("╚" + "═"*48 + "╝")
    
    results = {}
    
    results['initialization'] = test_initialization()
    results['lyric_research'] = test_lyric_research()
    results['audio_transcription'] = test_audio_transcription()
    
    print("\n" + "="*50)
    print("SUMMARY")
    print("="*50)
    
    for test, result in results.items():
        if result is True:
            status = "✅ PASS"
        elif result is False:
            status = "❌ FAIL"
        else:
            status = "⏭️ SKIP"
        print(f"  {test.replace('_', ' ').title()}: {status}")
    
    passed = sum(1 for r in results.values() if r is True)
    total = len(results)
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    return all(r is not False for r in results.values())

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
