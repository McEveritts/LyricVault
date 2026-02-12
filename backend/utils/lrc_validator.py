import re


TIMESTAMP_PATTERN = re.compile(r"^\s*\[(\d+):(\d{2})\.(\d{2,3})\]")


def validate_lrc(text: str, min_lines: int = 5) -> bool:
    """
    Validate LRC text using strict timed-line rules:
    1. At least min_lines lines start with [mm:ss.xx] or [mm:ss.xxx].
    2. Every parsed timestamp is strictly increasing in line order.
    """
    if not text or not isinstance(text, str):
        return False

    timed_seconds: list[float] = []
    for raw_line in text.strip().splitlines():
        match = TIMESTAMP_PATTERN.match(raw_line)
        if not match:
            continue

        minutes = int(match.group(1))
        seconds = int(match.group(2))
        fraction_raw = match.group(3)

        if seconds >= 60:
            return False

        # 2-digit fractions are centiseconds; normalize to milliseconds.
        fraction_ms = int(fraction_raw) if len(fraction_raw) == 3 else int(fraction_raw) * 10
        total_seconds = (minutes * 60) + seconds + (fraction_ms / 1000.0)
        timed_seconds.append(total_seconds)

    if len(timed_seconds) < min_lines:
        return False

    for prev, current in zip(timed_seconds, timed_seconds[1:]):
        if current <= prev:
            return False

    return True
