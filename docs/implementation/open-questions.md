# MVP Open Questions

Updated: 2026-05-02

Start with `docs/implementation/mvp-current-status.md` for current scope and defaults.

| ID | Status | Area | Question | Current Assumption / Next Step |
|---|---|---|---|---|
| OQ-001 | Open | Memo | Should memo fields use 500 or 1500 characters? | Use 500 until confirmed. |
| OQ-002 | Open | Reception | Should no-show be automatic or manual? | Show no-show for past reservations and allow manual conversion later. |
| OQ-003 | Open | Reception | What are the exact business hours per hospital? | Display `08:00-20:00`, operating `09:00-19:00`. |
| OQ-004 | Prototype default | Reception | What is the source of today's working veterinarians? | Use mock list and multi-select. |
| OQ-005 | Prototype default | Excel | What should Excel download/upload do? | No-op dropdown items in MVP. |
| OQ-006 | Prototype default | KakaoTalk | Should KakaoTalk sending be simulated? | Mock/no-op only. |
| OQ-007 | Prototype default | PACS/device | Should PACS and equipment receipt be simulated? | Mock/no-op only. |
| OQ-008 | Open | Billing | What are the final billing calculation rules? | Use deterministic mock totals. |
| OQ-009 | Needs PR7 reference | CS History | What are the exact CS history columns? | Confirm against Figma/reference image in PR7. |
| OQ-010 | Prototype default | Latest shortcuts | Where should latest-work shortcuts route? | Route to implemented modules only; otherwise no-op. |
| OQ-011 | Open | Patient validation | What duplicate rules apply to microchip and registration number? | Local mock check only. |
| OQ-012 | Decided for PR 1-6 | Hospital admin | Should Order 관리 / Order 세트 be implemented in this wave? | No. Reference only in PR 1-6. Revisit in a later admin scope. |
| OQ-013 | PR7 prerequisite | Reference images | Where are binary screenshots stored? | Actual PNG files are missing. Export Figma/reference captures into indexed paths. |
| OQ-014 | Open | Navigation labels | What are final Korean menu labels? | Current labels are prototype labels; final naming needs product approval. |
| OQ-015 | Decided for prototype | Prototype persistence | Should draft state survive refresh? | No. Session state only. |
| OQ-016 | Implemented default | Reception patient context | Where do removed patient info and right-panel details appear? | Detail drawer or patient/guardian drawer. |
