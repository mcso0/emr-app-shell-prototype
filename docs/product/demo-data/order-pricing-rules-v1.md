---
title: "Order Pricing Rules V1"
status: "draft"
updated: "2026-05-19"
owner: "product"
source_issue: "DEN-99"
---

# Order Pricing Rules V1

This document defines synthetic pricing and billing-display rules for the portfolio demo order catalog and order sets.

It is not a real fee schedule, tax guide, insurance rule, or medical recommendation.

## Pricing Basis Types

| Basis | Demo Meaning | Typical Surface |
| --- | --- | --- |
| `unit_price` | A normal order price multiplied by quantity | Individual order |
| `fixed_order_price` | One order-level amount, independent of child rows | Individual order or simple package |
| `set_fixed_price` | A set-level representative price | Order set |
| `included_order_sum` | Sum of included order prices | Order set |
| `range_price` | Price changes by weight or another bracket | Order or set |

## Core Pricing Fields

| Field | Demo Meaning |
| --- | --- |
| `priceBasis` | One of the pricing basis types above |
| `salesUnit` | Display unit, such as `per_order`, `per_kg`, `per_day`, `per_frequency`, or `per_each` |
| `priceKrw` | Integer KRW amount |
| `taxIncluded` | Whether the displayed price includes VAT |
| `roundingRule` | Billing or quantity rounding marker |
| `billingReflectionEnabled` | Whether the row contributes to owner-facing billing behavior |
| `rangePriceRows` | Ordered bracket rows when `priceBasis` is `range_price` |
| `sourcePresetVersion` | Preset version that created a chart row |
| `appliedSnapshot` | Frozen copy of names, price, unit, tax, and relevant rules used by a chart row |
| `quantitySource` | Explains whether chart quantity came from days, total count, actual dispense quantity, fixed one, or manual edit |
| `billingAmountSource` | Explains whether amount is calculated, set fixed, range-derived, or manually adjusted |

## Sales Unit Migration

The reference screens move away from a narrow `건당/kg당` model.

| As-Is | To-Be |
| --- | --- |
| 건당 | Order당, 개당 |
| kg당 | kg별 |
| none | 하루당, 횟수당 |

When `per_day` or `per_frequency` is selected, the chart order row should be able to adjust days, frequency, and total count for that applied order. Those chart edits should not mutate the admin preset.

## Sales Unit Quantity Rules

| Sales Unit | Quantity Rule |
| --- | --- |
| `per_day` / 하루당 | Billing quantity follows `days` |
| `per_frequency` / 횟수당 | Billing quantity follows `totalCount` |
| `per_each` / 개당 | Billing quantity can follow manual quantity or `actualDispenseQuantity` depending on preset |
| `per_ml` / mL당 | Billing quantity follows `actualDispenseQuantity` in mL |
| `per_order` / Order당 | Billing quantity defaults to `1` |
| `per_kg` / kg별 | Billing amount follows range or weight-based pricing snapshot |

Store `quantitySource` with the calculated value so future billing fixtures can explain why the same visible order may produce different quantities in different encounters.

## Set Fixed Price

Use `set_fixed_price` when the set itself has a representative amount.

Rules:

- The set price is shown as the main set billing amount.
- Included child orders can remain visible for traceability.
- Child order billing reflection starts off unless the product workflow explicitly turns it on.
- If a child order billing toggle is turned on, its additional amount is shown separately and included in the displayed total.
- Changing the preset later does not rewrite already chart-applied set rows.

Recommended fields:

| Field | Why |
| --- | --- |
| `setPriceKrw` | Main set amount |
| `childBillingReflectionPolicy` | Default child billing toggle behavior |
| `extraChildAmountKrw` | Additional amount from child rows with billing reflection on |
| `appliedSetSnapshot` | Frozen set price and child amount state at chart-add time |

## Included Order Sum

Use `included_order_sum` when the set price is the sum of included orders.

Rules:

- Included orders keep their own unit prices and quantities.
- The set amount is calculated from included child rows.
- Nested sets must stay traceable with source set metadata.
- Child order edits after chart insertion apply to that chart row only.

## Range Price

Use `range_price` for bracketed pricing, such as weight-based examples.

Example data shape:

| Field | Demo Meaning |
| --- | --- |
| `rangeBasis` | `kg` for the current reference |
| `baseRangeMax` | Upper value for base price |
| `basePriceKrw` | Price up to the base range |
| `additionalRows` | Ordered bracket rows |
| `upperRangePriceKrw` | Price after the last bracket |
| `rangeUnitMode` | Fixed amount or per-unit amount |

UX rules from the reference:

- Money fields accept integers only.
- kg range values should reject overly precise decimals in the UI.
- Child billing reflection is disabled when the set price is controlled by range brackets.
- Range pricing examples should remain workflow examples, not actual fee recommendations.

## Tax, Discount, And Rounding

| Rule | Demo Meaning |
| --- | --- |
| Tax checked | VAT is included in the displayed price |
| Tax unchecked | VAT is not included in the displayed price |
| Discount fields | Future chart/billing adjustment fields, not preset defaults for V1 |
| Quantity decimals | Medication quantities may show up to three decimal places |
| Weight decimals | Range-price weight inputs should keep a stricter UI precision limit |

## Chart Line Calculation Order

When chart rows are created or edited, fixtures should calculate values in a stable order:

1. Resolve the applied preset snapshot.
2. Determine `quantity` from `quantitySource`.
3. Calculate `lineSubtotalKrw` from price basis and quantity.
4. Apply line-level discount or surcharge as adjustment data.
5. Calculate `billingAmountKrw`.
6. Exclude the row from invoice candidate totals when `billingReflectionEnabled` is false.

| Price Basis | Line Subtotal Rule |
| --- | --- |
| `unit_price` | `priceKrw * quantity` |
| `fixed_order_price` | `priceKrw` regardless of quantity display |
| `set_fixed_price` | `setPriceKrw + extraChildAmountKrw` |
| `included_order_sum` | Sum billing-enabled child `billingAmountKrw` values |
| `range_price` | Match range row by snapshot basis, then calculate bracket amount |

Manual billing amount edits should be stored as adjustment fields, not by mutating the preset price. This keeps the synthetic demo explainable when a chart row, invoice candidate, and original order preset disagree.

## Applied Snapshot Rule

Admin presets are master data. Chart order rows are applied records.

When an order or set is added to a chart, store a snapshot of the names, price, sales unit, tax state, amount basis, target species, and relevant calculation settings. Later admin-preset edits should affect future chart additions only.

Minimum snapshot fields:

| Field | Demo Meaning |
| --- | --- |
| `sourcePresetId` | Order or set preset ID |
| `sourcePresetVersion` | Version at the time of chart insertion |
| `appliedDisplayName` | Name shown on the chart row |
| `appliedBillingName` | Billing-facing name at insertion time |
| `appliedPriceKrw` | Price at insertion time |
| `appliedSalesUnit` | Sales unit at insertion time |
| `appliedTaxIncluded` | Tax state at insertion time |
| `appliedAmountBasis` | Pricing basis at insertion time |

## Out Of Scope For V1

- Real hospital fee import.
- Real tax compliance.
- Insurance billing rules.
- Payment provider behavior.
- Medical dosing or treatment price recommendations.
