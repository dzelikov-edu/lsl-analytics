import os
import psutil

def log_memory(label: str) -> None:
    """
    Prints current process RSS (resident set size) in MB with a label.
    Example: [MEM] startup-complete: 243.7 MB
    """
    process = psutil.Process(os.getpid())
    rss_mb = process.memory_info().rss / (1024 * 1024)
    print(f"[MEM] {label}: {rss_mb:.1f} MB")
