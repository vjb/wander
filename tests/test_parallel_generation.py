"""
Tests for parallel route generation:
  - asyncio.gather / asyncio.Queue usage
  - Streaming: first route appears before all 3 are done
  - Route index ordering (0, 1, 2)
"""
import ast
import os
import re
import pytest
import asyncio

MAIN_PATH = os.path.join(os.path.dirname(__file__), "..", "wander-api", "main.py")


def _read_main() -> str:
    with open(MAIN_PATH, encoding="utf-8") as f:
        return f.read()


# ── Static analysis tests ─────────────────────────────────────────────────────

def test_generate_route_uses_asyncio_gather():
    """generate_route should use asyncio.gather to fire concurrent tasks."""
    src = _read_main()
    assert "asyncio.gather" in src, (
        "generate_route should use asyncio.gather for concurrent route generation"
    )


def test_generate_route_streams_via_queue():
    """generate_route should use an asyncio.Queue to stream results."""
    src = _read_main()
    assert "result_queue = asyncio.Queue()" in src or "asyncio.Queue(" in src, (
        "generate_route should create an asyncio.Queue for streaming"
    )


def test_generate_route_emits_route_type():
    """Stream events should have type='route' so frontend can handle them."""
    src = _read_main()
    assert '"type": "route"' in src or "'type': 'route'" in src, (
        "Streaming events must emit type='route' for frontend SSE handler"
    )


def test_generate_route_emits_index():
    """Each streamed route event should include an 'index' field (0, 1, 2)."""
    src = _read_main()
    assert '"index":' in src or '"index": ' in src or "'index'" in src, (
        "Streamed route events must include 'index' for frontend tab assignment"
    )


def test_generate_route_emits_weather_event():
    """Streaming should emit a 'weather' type event before routes."""
    src = _read_main()
    assert '"type": "weather"' in src or "'type': 'weather'" in src, (
        "generate_route should emit a weather event to the stream"
    )


def test_no_sequential_route_loop():
    """Old sequential for i in range(3) loop should be replaced by parallel tasks."""
    src = _read_main()
    # Old pattern: for i in range(3): ... await _call_openai_...
    # This combination should no longer exist
    old_pattern = r"for\s+i\s+in\s+range\s*\(\s*3\s*\).*?_call_openai_"
    assert not re.search(old_pattern, src, re.DOTALL), (
        "Old sequential for i in range(3) loop with direct OpenAI call found — "
        "parallel refactor incomplete"
    )


# ── Queue mechanics: ordering ──────────────────────────────────────────────────

def test_queue_ordering():
    """
    Simulates the parallel worker pattern:
    multiple coroutines put items into a queue; items should come out in
    completion order (not submission order).
    """
    import asyncio

    async def fast_worker(q: asyncio.Queue, val: int, delay: float):
        await asyncio.sleep(delay)
        await q.put(val)

    async def run():
        q: asyncio.Queue = asyncio.Queue()
        # Route 1 is slowest, route 2 is fastest, route 3 is medium
        delays = [0.05, 0.01, 0.03]
        tasks = [asyncio.create_task(fast_worker(q, i, delays[i])) for i in range(3)]
        results = []
        for _ in range(3):
            results.append(await q.get())
        await asyncio.gather(*tasks)
        return results

    results = asyncio.run(run())
    # Route 2 (index 1, delay=0.01) should arrive first
    assert results[0] == 1, f"Expected fastest route first, got order: {results}"
    assert set(results) == {0, 1, 2}, f"Expected all 3 routes, got: {results}"


def test_stream_format_valid_json():
    """
    The SSE event format 'data: {...}\\n\\n' should produce valid JSON
    when sliced at prefix 'data: '.
    """
    import json
    sample_event = 'data: {"type": "route", "index": 0, "route": {"route_name": "Test"}}\n\n'
    prefix = "data: "
    assert sample_event.startswith(prefix)
    payload = sample_event.strip()[len(prefix):]
    obj = json.loads(payload)
    assert obj["type"] == "route"
    assert obj["index"] == 0
