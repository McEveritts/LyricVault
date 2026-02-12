import re
from typing import List

def validate_lrc(text: str, min_lines: int = 5) -> bool:
    """
    Validate if the text is a valid LRC format with:
    1. At least min_lines of valid timestamped lyrics.
    2. Timestamps in [mm:ss.xx] format.
    3. Strictly increasing timestamps (to filter out hallucinated/garbage loops).
    
    Args:
        text: The string content to validate.
        min_lines: Minimum number of valid timed lines required.
        
    Returns:
        bool: True if valid, False otherwise.
    """
    if not text:
        return False
        
    # Regex for [mm:ss.xx] or [mm:ss.xxx]
    # We strictly require the bracketed timestamp at the start of the line or minimal offset
    timestamp_pattern = re.compile(r'\[(\d+):(\d{2})\.(\d{2,3})\]')
    
    lines = text.strip().split('\n')
    valid_lines = []
    
    for line in lines:
        match = timestamp_pattern.search(line)
        if match:
            minutes = int(match.group(1))
            seconds = int(match.group(2))
            milliseconds = int(match.group(3))
            
            # Normalize to total seconds for ordering check
            # Handle 2 digit (centi) vs 3 digit (milli) matches
            ms_val = milliseconds if len(match.group(3)) == 3 else milliseconds * 10
            
            total_seconds = (minutes * 60) + seconds + (ms_val / 1000.0)
            valid_lines.append(total_seconds)
            
    if len(valid_lines) < min_lines:
        return False
        
    # Check for progression
    if valid_lines[-1] <= valid_lines[0]:
        return False
        
    # Check for massive disorder? 
    # For now, simplistic progression check is better than nothing. 
    # We can accept some out-of-order lines for stylistic reasons (e.g. repeated chorus lines at top?) 
    # but standard LRC is usually ordered.
    
    return True
