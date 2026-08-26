# Dispensing Order Master V1 Datasets

Status: `technical validation complete; clinical review pending; inactive`

## Files

| File | Purpose |
| --- | --- |
| `dispensing-order-candidates-140.v1.json` | Initial 140-row candidate set selected from the official VMD product database snapshot. |
| `dispensing-order-candidates-140.enriched.v1.json` | The same 140 candidates enriched from locally downloaded official SPC PDFs. It retains 108 technical passes, 19 manual-review rows, and 13 source-unavailable rejections for an auditable funnel. |
| `dispensing-order-master.v1.json` | Final 108-row technical dataset. Every row remains clinically unreviewed and inactive. |
| `dispensing-order-master.v1.csv` | Flat review/export view of the final technical dataset. It is not an import authorization. |
| `dispensing-order-master.v1.summary.json` | Deterministic counts, coverage, and JSON/CSV SHA-256 fingerprints. |

## Safety Meaning

- `clinicalUseAllowed` is `false` for every final row.
- Dose, frequency, duration, quantity, repeats, instructions, and BUD rules are
  intentionally `null`; no clinical defaults were inferred from product labels.
- The Korean display value is a draft consisting of the source ingredient text
  and a Korean dosage-form label. It is not an approved clinical translation.
- UK authorization does not establish Korean authorization, controlled-substance
  status, or permission for real-patient use.
- Shelf life and storage signals are label-extraction fields for review. They do
  not replace lot, expiry, opening date, or BUD data captured at dispensing time.
- The keyword safety signals route human review only and are not clinical decision
  support.

## Rebuild And Validate

```bash
node scripts/build-dispensing-order-master-v1.mjs
node scripts/validate-dispensing-order-master-v1.mjs
```

The validator requires at least 120 initial candidates, at least 100 final rows,
zero duplicate stable IDs/canonical keys/source product IDs, zero active rows,
official VMD SPC provenance, and null clinical order defaults.
