#!/usr/bin/env python3
"""
Render local Marrow HTML files to PDFs with full styling using Playwright (Chromium).
- Removes site header/footer UI.
- Cuts content at the first occurrence of "MCQ ID:" while preserving original page styles.

Usage:
  .venv/bin/python convert_with_playwright.py \
    --input-dir "/Volumes/MainSSD/Indra_Developement/Desktop" \
    --pattern "*.html" \
    --out-dir "/Volumes/MainSSD/Indra_Developement/Desktop/pdfs_styled"

Prereqs:
  .venv/bin/python -m pip install playwright
  .venv/bin/python -m playwright install chromium
"""
from __future__ import annotations

import argparse
import fnmatch
from pathlib import Path
from typing import List

from playwright.sync_api import sync_playwright
from pypdf import PdfWriter, PdfReader


JS_REMOVE_AND_CUT = r"""
((qNumber) => {
  // Find the first element that visually contains text starting with "MCQ ID:"
  const matchRegex = /\bMCQ\s*ID\s*:\s*/i;

  function findFirstMatchingElement(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        if (!node.nodeValue) return NodeFilter.FILTER_SKIP;
        return matchRegex.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    const textNode = walker.nextNode();
    if (textNode && textNode.parentElement) return textNode.parentElement;
    return null;
  }

  const mcqEl = findFirstMatchingElement(document.body);
  if (!mcqEl) return false;

  // Choose a meaningful container around mcqEl
  const containerSelectors = [
    'main', 'section', 'article',
    '.content', '.container', '.question', '.page', '.wrapper', '.root', '.app', '#content', '#main'
  ];
  function closestContainer(el) {
    for (const sel of containerSelectors) {
      const c = el.closest(sel);
      if (c) return c;
    }
    return document.body;
  }
  let container = closestContainer(mcqEl);

  // Try to locate the question start using qNumber if provided
  let questionEl = null;
  if (qNumber) {
    const qPattern = new RegExp('^\\s*(?:Q\\.?\\s*)?' + qNumber + '(?:[).:,-])?\\s*', 'i');
    const qWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        if (!node.nodeValue) return NodeFilter.FILTER_SKIP;
        return qPattern.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    const qText = qWalker.nextNode();
    if (qText && qText.parentElement) questionEl = qText.parentElement;
  }

  // Ensure container encompasses questionEl; if not, widen to body
  if (questionEl && !container.contains(questionEl)) {
    container = document.body;
  }

  // Build a DOM Range from question start (if found) or container start, up to mcqEl
  const range = document.createRange();
  if (questionEl) {
    range.setStartBefore(questionEl);
  } else if (container.firstChild) {
    range.setStartBefore(container.firstChild);
  } else {
    document.body.innerHTML = '';
    return true;
  }
  range.setEndBefore(mcqEl);
  const frag = range.cloneContents();

  // Rebuild body with only the extracted content (styles remain in <head>)
  const wrapper = document.createElement('div');
  wrapper.appendChild(frag);
  const newBody = document.createElement('body');
  newBody.appendChild(wrapper);
  document.documentElement.replaceChild(newBody, document.body);

  return true;
})
"""


def iter_input_files(input_dir: Path, pattern: str) -> List[Path]:
  files: List[Path] = []
  for entry in input_dir.iterdir():
    if entry.is_file() and fnmatch.fnmatch(entry.name, pattern):
      files.append(entry)

  def sort_key(p: Path):
    stem = p.stem
    if stem.isdigit():
      return (0, int(stem))
    else:
      return (1, stem.lower())

  return sorted(files, key=sort_key)


def main() -> int:
  ap = argparse.ArgumentParser(description="Convert local HTML to styled PDFs via Playwright (Chromium)")
  ap.add_argument('--input-dir', type=str, required=True)
  ap.add_argument('--pattern', type=str, default='*.html')
  ap.add_argument('--out-dir', type=str, required=True)
  ap.add_argument('--combined-output', type=str, help='Optional: path to a single merged PDF to create after individual PDFs are generated')
  args = ap.parse_args()

  in_dir = Path(args.input_dir).expanduser().resolve()
  out_dir = Path(args.out_dir).expanduser().resolve()
  out_dir.mkdir(parents=True, exist_ok=True)

  files = iter_input_files(in_dir, args.pattern)
  if not files:
    print(f"No files matched in {in_dir} with pattern {args.pattern}")
    return 0

  print(f"Found {len(files)} files. Printing to {out_dir} ...")

  with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context()

    ok = 0
    fail = 0
    generated_pdfs: List[Path] = []
    for html_path in files:
      try:
        page = context.new_page()
        url = html_path.resolve().as_uri()
        page.goto(url, wait_until='load')
        # Ensure all subresources finish and JS (if any) runs
        page.wait_for_load_state('networkidle')
        # Use screen media to avoid sites' @media print rules that hide content
        page.emulate_media(media='screen')
        # Small delay to allow late layout/animations to settle
        page.wait_for_timeout(200)

        # Remove top UI and keep only [Question..before MCQ ID]. Use file stem as question number if numeric.
        stem = html_path.stem
        qnum = stem if stem.isdigit() else None
        _result = page.evaluate(JS_REMOVE_AND_CUT, qnum)

        # Print to PDF (backgrounds on, prefer CSS-defined page size)
        out_pdf = out_dir / f"{html_path.stem}.pdf"
        page.pdf(path=str(out_pdf), print_background=True, prefer_css_page_size=True)
        print(f"[OK]   {html_path.name} -> {out_pdf.name}")
        ok += 1
        generated_pdfs.append(out_pdf)
      except Exception as e:
        print(f"[FAIL] {html_path.name} : {e}")
        fail += 1
      finally:
        try:
          page.close()
        except Exception:
          pass

    context.close()
    browser.close()

  # Merge into a single PDF if requested
  if args.combined_output and ok > 0:
    combined_path = Path(args.combined_output).expanduser().resolve()
    writer = PdfWriter()
    print(f"Merging {len(generated_pdfs)} PDFs into {combined_path}")
    for pdf_path in generated_pdfs:
      try:
        reader = PdfReader(str(pdf_path))
        for page in reader.pages:
          writer.add_page(page)
      except Exception as e:
        print(f"[SKIP] {pdf_path.name}: {e}")
    combined_path.parent.mkdir(parents=True, exist_ok=True)
    with combined_path.open('wb') as f:
      writer.write(f)
    print("Merged PDF created.")

  print(f"Done. Success: {ok}, Failed: {fail}")
  return 0 if fail == 0 else 1


if __name__ == '__main__':
  raise SystemExit(main())
