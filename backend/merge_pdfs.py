#!/usr/bin/env python3
"""
Merge all PDFs in a directory into a single PDF.

Usage:
  .venv/bin/python merge_pdfs.py \
    --input-dir "/path/to/pdfs" \
    --pattern "*.pdf" \
    --output "/path/to/output/All_Questions.pdf"

Sorting:
- Attempts natural numeric ordering by filename stem if possible (e.g., 1, 2, 10, 11, ...)
- Falls back to lexicographic order if not purely numeric
"""
from __future__ import annotations

import argparse
import fnmatch
from pathlib import Path
from typing import List

from pypdf import PdfWriter, PdfReader


def iter_pdf_files(input_dir: Path, pattern: str) -> List[Path]:
  files = [p for p in input_dir.iterdir() if p.is_file() and fnmatch.fnmatch(p.name, pattern)]
  # natural-ish sort: try numeric stem first
  def sort_key(p: Path):
    stem = p.stem
    num = None
    # extract leading integer if present
    i = 0
    while i < len(stem) and stem[i].isdigit():
      i += 1
    if i > 0:
      try:
        num = int(stem[:i])
      except Exception:
        num = None
    return (0, num) if num is not None else (1, stem.lower())
  return sorted(files, key=sort_key)


def merge_pdfs(input_dir: Path, pattern: str, output_file: Path) -> None:
  writer = PdfWriter()
  files = iter_pdf_files(input_dir, pattern)
  if not files:
    print(f"No PDFs found in {input_dir} matching {pattern}")
    return
  print(f"Merging {len(files)} PDFs into {output_file}")
  for pdf_path in files:
    try:
      reader = PdfReader(str(pdf_path))
      for page in reader.pages:
        writer.add_page(page)
      print(f"[OK]   {pdf_path.name}")
    except Exception as e:
      print(f"[SKIP] {pdf_path.name}: {e}")
  output_file.parent.mkdir(parents=True, exist_ok=True)
  with output_file.open('wb') as f:
    writer.write(f)
  print("Done.")


def main() -> int:
  ap = argparse.ArgumentParser(description="Merge all PDFs in a directory into one PDF")
  ap.add_argument('--input-dir', type=str, required=True)
  ap.add_argument('--pattern', type=str, default='*.pdf')
  ap.add_argument('--output', type=str, required=True)
  args = ap.parse_args()

  in_dir = Path(args.input_dir).expanduser().resolve()
  out_path = Path(args.output).expanduser().resolve()

  if not in_dir.exists() or not in_dir.is_dir():
    print(f"ERROR: input-dir does not exist or is not a directory: {in_dir}")
    return 2

  merge_pdfs(in_dir, args.pattern, out_path)
  return 0


if __name__ == '__main__':
  raise SystemExit(main())
