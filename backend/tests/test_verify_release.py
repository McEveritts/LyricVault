import unittest
import os
import sys

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from utils.lrc_validator import validate_lrc
from services.settings_service import (
    set_genius_credentials,
    get_genius_credentials,
    delete_genius_credentials,
    get_strict_lrc_mode,
    set_strict_lrc_mode,
)

class TestReleaseVerification(unittest.TestCase):

    def test_lrc_validation_strictness(self):
        """Verify that LRC validation strictly rejects plain text and accepts valid LRC."""
        
        # Valid LRC (standard)
        valid_lrc = """
        [00:12.00] Line 1
        [00:15.50] Line 2
        [00:18.00] Line 3
        [00:22.00] Line 4
        [00:25.00] Line 5
        """
        self.assertTrue(validate_lrc(valid_lrc), "Should accept valid minimal LRC")

        # Valid LRC (milliseconds)
        valid_lrc_ms = """
        [00:12.000] Line 1
        [00:15.500] Line 2
        [00:18.000] Line 3
        [00:22.000] Line 4
        [00:25.000] Line 5
        """
        self.assertTrue(validate_lrc(valid_lrc_ms), "Should accept valid LRC with milliseconds")

        # Invalid: Plain text
        plain_text = """
        Line 1
        Line 2
        Line 3
        Line 4
        Line 5
        """
        self.assertFalse(validate_lrc(plain_text), "Should reject plain text")

        # Invalid: Not enough lines (default min=5)
        short_lrc = """
        [00:12.00] Line 1
        [00:15.50] Line 2
        """
        self.assertFalse(validate_lrc(short_lrc), "Should reject LRC with too few lines")

        # Invalid: Timestamps not strictly increasing
        scrambled_lrc = """
        [00:12.00] Line 1
        [00:15.50] Line 2
        [00:14.00] Line 3 (Time travel!)
        [00:22.00] Line 4
        [00:25.00] Line 5
        """
        self.assertFalse(validate_lrc(scrambled_lrc), "Should reject out-of-order timestamps")

        # Invalid: Looping timestamps
        loop_lrc = """
        [00:12.00] Line 1
        [00:15.50] Line 2
        [00:12.00] Line 1
        [00:15.50] Line 2
        [00:12.00] Line 1
        """
        self.assertFalse(validate_lrc(loop_lrc), "Should reject looping timestamps")

    def test_genius_key_persistence(self):
        """Verify Genius API key logic and env var export."""
        original_creds = get_genius_credentials()
        test_token = "test_genius_token_12345"
        
        try:
            # 1. Set Token
            set_genius_credentials(access_token=test_token)
            
            # 2. Verify settings retrieval
            retrieved = get_genius_credentials()
            self.assertEqual(retrieved["access_token"], test_token, "Should retrieve saved token")
            
            # 3. Verify Env Var export
            self.assertEqual(os.environ.get("GENIUS_ACCESS_TOKEN"), test_token, "Should export to env var")
            
            # 4. Delete and verify removal behavior
            delete_genius_credentials()
            creds = get_genius_credentials()
            self.assertIsNone(creds["access_token"], "Should be None after delete")
            self.assertIsNone(os.environ.get("GENIUS_ACCESS_TOKEN"), "Should be removed from env var")
        finally:
            if original_creds:
                set_genius_credentials(
                    client_id=original_creds.get("client_id"),
                    client_secret=original_creds.get("client_secret"),
                    access_token=original_creds.get("access_token")
                )
            else:
                delete_genius_credentials()

    def test_lyrics_mode_persistence(self):
        """Verify strict_lrc mode can be persisted and restored."""
        original_mode = get_strict_lrc_mode()
        try:
            set_strict_lrc_mode(False)
            self.assertFalse(get_strict_lrc_mode(), "Should persist unsynced fallback mode")

            set_strict_lrc_mode(True)
            self.assertTrue(get_strict_lrc_mode(), "Should persist strict mode")
        finally:
            set_strict_lrc_mode(original_mode)

if __name__ == '__main__':
    unittest.main()
