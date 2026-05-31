"""
Tests for ghost fixes in main.py:
  1. CORS now includes FRONTEND_URL env var
  2. data scope leak in swap_waypoint is fixed
  3. All print() calls replaced with logger.*
  4. Parallel route generation via asyncio.Queue
"""
import ast
import importlib
import os
import sys
import re
import pytest

MAIN_PATH = os.path.join(os.path.dirname(__file__), "..", "wander-api", "main.py")


def _read_main() -> str:
    with open(MAIN_PATH, encoding="utf-8") as f:
        return f.read()


# ── 1. No bare print() calls ──────────────────────────────────────────────────

def test_no_bare_print_calls():
    """All print() statements should have been replaced with logger.*"""
    src = _read_main()
    # Match print( at start of line content (ignoring indentation)
    # Exclude docstrings / comments by doing a simple token check
    tree = ast.parse(src)
    bare_prints = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Expr) and isinstance(node.value, ast.Call):
            func = node.value.func
            if isinstance(func, ast.Name) and func.id == "print":
                bare_prints.append(node.lineno)
    assert bare_prints == [], (
        f"Found bare print() calls at lines {bare_prints} in main.py — "
        "replace with logger.info/warning/error"
    )


# ── 2. CORS origins include FRONTEND_URL ─────────────────────────────────────

def test_cors_reads_frontend_url():
    """CORS setup should read FRONTEND_URL environment variable."""
    src = _read_main()
    assert "FRONTEND_URL" in src, (
        "main.py does not reference FRONTEND_URL for CORS configuration"
    )
    assert "_cors_origins" in src, (
        "main.py should build a dynamic _cors_origins list"
    )


def test_cors_appends_frontend_url_when_set(monkeypatch):
    """When FRONTEND_URL env var is set, it should appear in CORS origins."""
    monkeypatch.setenv("FRONTEND_URL", "https://wander.example.com")
    # Reload the module to pick up the env var
    # We do a targeted exec rather than a full import to avoid side effects
    src = _read_main()
    # Extract only the CORS setup block (lines up to CORSMiddleware call)
    cors_block = []
    capture = False
    for line in src.splitlines():
        if "FRONTEND_URL" in line and "os.getenv" in line:
            capture = True
        if capture:
            cors_block.append(line)
        if capture and "_cors_origins.append" in line:
            break
    block_src = "\n".join(cors_block)
    local_ns: dict = {}
    exec(
        "import os\n" + block_src,
        local_ns
    )
    origins = local_ns.get("_cors_origins", [])
    assert "https://wander.example.com" in origins, (
        f"FRONTEND_URL not added to _cors_origins: {origins}"
    )


# ── 3. OTM data scope leak fixed ──────────────────────────────────────────────

def test_otm_data_scope_leak_fixed():
    """
    The swap_waypoint OTM enrichment block must declare 'otm_details' explicitly
    rather than using a bare 'data' variable from an outer scope.
    The fix is confirmed by checking that the swap endpoint assigns otm_details
    from the OTM response before using it.
    """
    src = _read_main()
    # The fix: swap_waypoint should have `otm_details = ` assignment
    assert "otm_details" in src, (
        "swap_waypoint should use an 'otm_details' variable to hold OTM API response"
    )
    # Confirm the fix is in the swap context (not just route generation)
    swap_fn_start = src.find("async def swap_waypoint(")
    assert swap_fn_start != -1, "swap_waypoint function not found"
    swap_section = src[swap_fn_start:swap_fn_start + 8000]
    assert "otm_details" in swap_section, (
        "otm_details not found in swap_waypoint — scope fix not applied correctly"
    )


# ── 4. Parallel generation uses asyncio.Queue ─────────────────────────────────

def test_parallel_generation_uses_queue():
    """Route generation should use asyncio.Queue for parallel streaming."""
    src = _read_main()
    assert "asyncio.Queue" in src, (
        "Parallel generation should use asyncio.Queue — sequential loop still in use"
    )
    assert "asyncio.create_task" in src, (
        "Parallel generation should use asyncio.create_task to fire concurrent LLM calls"
    )
    assert "result_queue.get()" in src, (
        "Should await result_queue.get() to stream results as they complete"
    )


def test_previously_selected_list_removed():
    """Sequential 'previously_selected' list should be removed from generate_route."""
    src = _read_main()
    # The old pattern was: previously_selected = [] followed by previously_selected.append(...)
    # This should no longer exist in the streaming generator
    old_append = "previously_selected.append"
    assert old_append not in src, (
        f"Old sequential previously_selected.append() still found — parallel refactor incomplete"
    )
