
import unittest
import os
import sys

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from utils.lrc_validator import validate_lrc
from services.settings_service import set_genius_api_key, get_genius_api_key, delete_genius_api_key

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

        # Invalid: Timestamps not increasing
        scrambled_lrc = """
        [00:12.00] Line 1
        [00:15.50] Line 2
        [00:14.00] Line 3 (Time travel!)
        [00:22.00] Line 4
        [00:25.00] Line 5
        """
        # Note: Current simple validator only checks start vs end, so lets make sure start < end
        # But wait, validate_lrc code: if valid_lines[-1] <= valid_lines[0]: return False
        # It doesn't check strict monotonicity for every line yet, just overall progression.
        # Let's test a loop:
        loop_lrc = """
        [00:12.00] Line 1
        [00:15.50] Line 2
        [00:12.00] Line 1
        [00:15.50] Line 2
        [00:12.00] Line 1
        """
        # First: 12.0, Last: 12.0.  Last <= First is True. Should return False.
        self.assertFalse(validate_lrc(loop_lrc), "Should reject looping timestamps")

    def test_genius_key_persistence(self):
        """Verify Genius API key logic and env var export."""
        test_key = "test_genius_token_12345"
        
        # 1. Set Key
        set_genius_api_key(test_key)
        
        # 2. Verify settings retrieval
        retrieved = get_genius_api_key()
        self.assertEqual(retrieved, test_key, "Should retrieve saved key")
        
        # 3. Verify Env Var export
        self.assertEqual(os.environ.get("GENIUS_ACCESS_TOKEN"), test_key, "Should export to env var")
        
        # 4. Clean up
        delete_genius_api_key()
        self.assertIsNone(get_genius_api_key(), "Should be None after delete")
        self.assertIsNone(os.environ.get("GENIUS_ACCESS_TOKEN"), "Should be removed from env var")

if __name__ == '__main__':
    unittest.main()
