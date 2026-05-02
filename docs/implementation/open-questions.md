# MVP Open Questions

Updated: 2026-05-02

| ID | Area | Question | Current Assumption |
|---|---|---|---|
| OQ-001 | Memo | Should memo fields use 500 or 1500 characters? | Use 500 until confirmed. |
| OQ-002 | Reception | Should no-show be automatic or manual? | Show no-show for past reservations and allow manual conversion later. |
| OQ-003 | Reception | What are the exact business hours per hospital? | Display `08:00-20:00`, operating `09:00-19:00`. |
| OQ-004 | Reception | What is the source of today's working veterinarians? | Use mock list and multi-select. |
| OQ-005 | Excel | What should Excel download/upload do? | No-op dropdown items in MVP. |
| OQ-006 | KakaoTalk | Should KakaoTalk sending be simulated? | Mock/no-op only. |
| OQ-007 | PACS/device | Should PACS and equipment receipt be simulated? | Mock/no-op only. |
| OQ-008 | Billing | What are the final billing calculation rules? | Use deterministic mock totals. |
| OQ-009 | CS History | What are the exact CS history columns? | Use screenshot-visible columns. |
| OQ-010 | Latest shortcuts | Where should latest-work shortcuts route? | Route to implemented modules only; otherwise no-op. |
| OQ-011 | Patient validation | What duplicate rules apply to microchip and registration number? | Local mock check only. |
| OQ-012 | Hospital admin | Should Order 관리 / Order 세트 be implemented in this wave? | No. Reference only in PR 1-6. |
| OQ-013 | Reference images | Where are binary screenshots stored? | Chat images reviewed; export/copy needed to indexed paths. |
| OQ-014 | Navigation labels | What are final Korean menu labels? | `접수/예약`, `진료`, `임상/계통`, `영상`, `조제/처치`, `수납`, `고객관리`, `병원관리`. |
| OQ-015 | Prototype persistence | Should draft state survive refresh? | No. Session state only. |
| OQ-016 | Reception patient context | Where do removed patient info and right-panel details appear? | Detail drawer or patient/guardian drawer. |
