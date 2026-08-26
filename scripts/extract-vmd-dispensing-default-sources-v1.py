#!/usr/bin/env python3
"""Capture the exact VMD SPC sections used by the PR-019 synthetic presets.

This script does not make clinical decisions. It downloads the already pinned
official SPC URLs from the PR-017 release payload, extracts the administration
and storage sections, and writes a deterministic evidence artifact for the
separate service-review preset generator.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import tempfile
import urllib.request
from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PAYLOAD = ROOT / "docs/work/clinical-master/clinical-master-pr-017/supabase/dispensing-order-release-payload.v1.json"
DEFAULT_OUTPUT = ROOT / "docs/work/clinical-master/clinical-master-pr-019/dispensing-default-source-extracts.v1.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--payload", type=Path, default=DEFAULT_PAYLOAD)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--cache-dir", type=Path)
    return parser.parse_args()


def compact(text: str) -> str:
    text = text.replace("\u00a0", " ").replace("\u2022", "•")
    text = re.sub(r"Revised:\s*[^\n]+\nAN:\s*[^\n]+\nPage\s+\d+\s+of\s+\d+", " ", text, flags=re.I)
    text = re.sub(r"Approved\s+\d+\s+\w+\s+\d{4}", " ", text, flags=re.I)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def section(text: str, headings: list[str], next_heading_numbers: list[str]) -> str | None:
    start = None
    for heading in headings:
        match = re.search(heading, text, flags=re.I)
        if match and (start is None or match.start() < start.start()):
            start = match
    if not start:
        return None

    tail = text[start.end():]
    end_positions: list[int] = []
    for number in next_heading_numbers:
        match = re.search(rf"\n\s*{re.escape(number)}\s+", tail)
        if match:
            end_positions.append(match.start())
    end = min(end_positions) if end_positions else min(len(tail), 7000)
    return compact(tail[:end])[:6500]


def download(url: str, target: Path) -> bytes:
    if target.exists():
        return target.read_bytes()
    request = urllib.request.Request(url, headers={"User-Agent": "CLAiR clinical-master evidence capture/1.0"})
    with urllib.request.urlopen(request, timeout=45) as response:
        content = response.read()
    target.write_bytes(content)
    return content


def main() -> None:
    args = parse_args()
    payload = json.loads(args.payload.read_text())
    documents = {row["id"]: row for row in payload["evidenceDocuments"]}
    document_by_product: dict[str, dict] = {}
    for assertion in payload["evidenceAssertions"]:
        product_id = assertion.get("productId")
        document_id = assertion.get("evidenceDocumentId")
        if product_id and document_id and product_id not in document_by_product:
            document_by_product[product_id] = documents[document_id]

    cache_dir = args.cache_dir or Path(tempfile.gettempdir()) / "clair-vmd-spc-pr019"
    cache_dir.mkdir(parents=True, exist_ok=True)
    entries: list[dict] = []

    for product in sorted(payload["products"], key=lambda row: row["sourceProductId"]):
        document = document_by_product[product["id"]]
        target = cache_dir / f'{product["sourceProductId"]}.pdf'
        content = download(document["sourceUri"], target)
        observed_sha = hashlib.sha256(content).hexdigest()
        reader = PdfReader(target)
        raw_text = "\n".join(page.extract_text() or "" for page in reader.pages)
        posology = section(
            raw_text,
            [
                r"(?:3\.9|4\.9)\s+Administration routes and dosage",
                r"(?:3\.9|4\.9)\s+Administration route and dosage",
                r"(?:3\.9|4\.9)\s+Amounts to be administered and administration route",
                r"(?:3\.9|4\.9)\s+Amount\(s\) to be administered and administration route",
                r"Administration routes and dosage",
                r"Administration route and dosage",
                r"Amounts to be administered and administration route",
                r"Amount\(s\) to be administered and administration route",
            ],
            ["3.10", "4.10"],
        )
        storage = section(
            raw_text,
            [
                r"(?:5\.3|6\.4)\s+Special precautions for storage",
                r"(?:5\.3|6\.4)\s+Special storage precautions",
                r"Special precautions for storage",
                r"Special storage precautions",
            ],
            ["5.4", "6.5"],
        )
        entries.append(
            {
                "orderMasterKey": next(
                    profile["orderMasterKey"]
                    for profile in payload["dispensingProfiles"]
                    if profile["productId"] == product["id"]
                ),
                "productId": product["id"],
                "sourceProductId": product["sourceProductId"],
                "productName": product["englishProductName"],
                "sourceUri": document["sourceUri"],
                "pinnedEvidenceContentSha256": document["contentSha256"],
                "observedPdfSha256": observed_sha,
                "pageCount": len(reader.pages),
                "posologyExtract": posology,
                "storageExtract": storage,
                "posologyExtractionStatus": "captured" if posology else "not_found",
                "storageExtractionStatus": "captured" if storage else "not_found",
            }
        )

    canonical_entries = json.dumps(entries, ensure_ascii=False, separators=(",", ":"))
    output = {
        "schemaVersion": 1,
        "datasetRevision": "dispensing-default-source-extracts-v1-2026-08-26",
        "sourceReleaseId": "78a57bf0-10a8-47db-9ae1-8a8cff79b2c4",
        "sourcePayloadSha256": payload["payloadSha256"],
        "recordCount": len(entries),
        "captureAuthority": "Veterinary Medicines Directorate",
        "clinicalUseAllowed": False,
        "entriesSha256": hashlib.sha256(canonical_entries.encode()).hexdigest(),
        "entries": entries,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({
        "output": str(args.output),
        "recordCount": len(entries),
        "posologyCaptured": sum(1 for row in entries if row["posologyExtract"]),
        "storageCaptured": sum(1 for row in entries if row["storageExtract"]),
        "entriesSha256": output["entriesSha256"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
