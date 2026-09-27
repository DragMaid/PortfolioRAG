"""Ctrl+C stops `applier serve`, even with a page's event stream open.

Uvicorn waits for open connections before running the app's shutdown, and the event stream
only ends when that shutdown closes it — so without the server closing the streams itself on
the first Ctrl+C, it waits for ever. This runs the real command, as a person would.
"""

from __future__ import annotations

import signal
import socket
import subprocess
import sys
import threading
import time
import urllib.request

from test_controller import write_config


def free_port() -> int:
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return probe.getsockname()[1]


def test_ctrl_c_stops_the_server_with_a_page_listening(tmp_path, monkeypatch):
    monkeypatch.setenv("APPLIER_PORTFOLIO_TOKEN", "pfl_test")
    config = write_config(tmp_path)
    port = free_port()
    base = f"http://127.0.0.1:{port}"

    server = subprocess.Popen(
        [sys.executable, "-m", "applier", "--config", str(config), "serve", "--port", str(port)],
        cwd=tmp_path,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    try:
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            try:
                urllib.request.urlopen(f"{base}/api/status", timeout=1)
                break
            except OSError:
                time.sleep(0.2)
        else:
            raise AssertionError("the server never came up")

        opened = threading.Event()

        def listen() -> None:
            with urllib.request.urlopen(f"{base}/api/events", timeout=60) as stream:
                opened.set()
                while stream.read(64):
                    pass

        threading.Thread(target=listen, daemon=True).start()
        assert opened.wait(10), "the event stream should open"

        server.send_signal(signal.SIGINT)
        server.wait(timeout=15)
    finally:
        if server.poll() is None:
            server.kill()
            raise AssertionError("Ctrl+C did not stop the server within 15 seconds")

    output = server.stdout.read() if server.stdout else ""
    assert "Stopped." in output
