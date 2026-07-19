#!/usr/bin/env python3
"""Deprecated: use the root deploy.py (Contabo bundle upload)."""
import runpy
from pathlib import Path

runpy.run_path(str(Path(__file__).resolve().parent.parent / "deploy.py"), run_name="__main__")
