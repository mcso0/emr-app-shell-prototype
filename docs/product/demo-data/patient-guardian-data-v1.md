---
title: "Patient And Guardian Data V1"
status: "draft"
updated: "2026-05-19"
owner: "product"
source_issue: "DEN-99"
---

# Patient And Guardian Data V1

This document defines synthetic guardian and animal-patient data needed by the portfolio demo. It is workflow demo data only and must not use real client, patient, hospital, or medical record data.

## Why This Is Separate

Reception and customer management screens need guardian, patient, relationship, consent, status, and soft-delete data before chart/order/billing can feel connected.

This document keeps data and state rules separate from detailed drawer/modal UX. Screen layout, copy, hover details, and exact component behavior can wait for implementation.

## Data Families

| Family | Purpose |
| --- | --- |
| Guardian master data | Human owner/caregiver identity, contact, messaging consent, and notes |
| Patient master data | Animal identity, species/breed, age, sex, weight, identifiers, status, and notes |
| Patient-guardian relationship data | Primary/additional guardian links, relationship labels, message eligibility, and delete behavior |
| Patient staff assignment data | Attending veterinarian rows and department/specialty labels |
| Patient activity/status data | Appointment, reception, chart, inpatient, surgery/anesthesia, deceased, and deleted state labels |
| Soft-delete and restoration data | Deletion lock, deleted list visibility, restore eligibility, and linked guardian deletion choices |

## Guardian Registration Contract

The 보호자 등록 layer creates a guardian master record. All examples are synthetic demo-data and should never use real owner identifiers.

| Field | Required | Demo Meaning |
| --- | --- | --- |
| `guardianId` | yes | Internal deterministic guardian ID |
| `workspaceId` | yes | Workspace scope |
| `guardianCode` | yes | Staff-facing synthetic guardian code, such as `C01234` |
| `name` | yes | Guardian name; trim whitespace before save |
| `birthDate` | no | Date picker or direct input value |
| `mobilePhoneRaw` | yes | Entered mobile phone digits before normalization |
| `mobilePhoneNormalized` | yes | Hyphen-free phone value used for search and duplicate checks |
| `additionalPhoneNumbers` | no | Up to two extra phone numbers; can include landline-style values |
| `postalCode` | no | Address search result postal code |
| `addressLine1` | no | Base address from address search |
| `addressLine2` | no | Detail address |
| `emailLocalPart` | no | Email ID before `@` |
| `emailDomainMode` | no | `preset` or `direct_input` |
| `emailDomain` | no | Selected or directly entered domain |
| `email` | no | Normalized email when both local part and domain exist |
| `cashReceiptType` | yes | `none`, `personal_income_deduction`, or `business_income_deduction`; default is `none` |
| `cashReceiptNumber` | conditional | Required when `cashReceiptType` is not `none` |
| `residentRegistrationNumberMasked` | no | Display-safe resident-number value for synthetic examples |
| `residentRegistrationNumberToken` | no | Non-real placeholder/token used instead of storing a real identifier |
| `vehicleNumber` | no | Vehicle number text |
| `memo` | no | Internal note; demo limit is 1500 characters |
| `referralSources` | no | List such as homepage, blog/cafe/article, YouTube, Instagram, KakaoTalk channel, offline lecture, nearby, referral, other hospital, other |
| `referralSourceOtherText` | no | Free text when referral source is `other` |
| `createdByStaffId` | yes | Staff who registered the guardian |
| `createdAt` | yes | Registration timestamp |
| `lastUpdatedAt`, `lastUpdatedByStaffId` | no | Last saved edit metadata |

## Guardian Validation And Duplicate Rules

| Situation | Data Rule |
| --- | --- |
| Name length | Store validation metadata for minimum 2 and maximum 40 characters |
| Phone input | Store normalized digits for mobile phone search; hyphen formatting is display-only |
| Cash receipt type is `none` | `cashReceiptNumber` can be empty and registration can proceed |
| Cash receipt type is personal or business deduction | `cashReceiptNumber` becomes required |
| Resident-number display | Editable view can show the entered synthetic value; read-only view should mask back digits |
| Required fields are valid | Registration can create the guardian |
| Same name plus same normalized mobile phone exists | Show duplicate candidate confirmation before creating another guardian |
| Duplicate is intentionally accepted | Store `duplicateOverrideAccepted`, `duplicateCandidateGuardianIds`, and actor/time for audit-style review |
| Kakao ID | Do not model as a V1 field; the referenced UI removed it |

## Guardian Consent And Referral Data

Consent should be stored as rows, not only as a combined checkbox state.

| Field | Demo Meaning |
| --- | --- |
| `guardianConsentId` | Stable consent row ID |
| `guardianId` | Guardian link |
| `consentType` | `personal_data_collection`, `third_party_sharing`, or `marketing_messages` |
| `consentStatus` | `granted`, `refused`, or `unknown` |
| `consentedAt`, `refusedAt` | Timestamp for the latest status |
| `sourceSurface` | `guardian_registration`, `guardian_detail_edit`, or future signing surface |
| `documentVersion` | Synthetic policy/document version for demo traceability |

Data rules:

- `전체동의` is a derived helper action. It should update individual consent rows rather than become the only stored value.
- If one individual consent is changed after `전체동의`, derive the all-consent display state from the individual rows.
- Marketing/message eligibility should check both guardian-level consent and patient/relationship-level message consent.
- Referral sources are multi-select demo tags plus optional free text; they are not clinical data.

## Patient Registration Contract

The 신규 동물 등록 layer creates a patient and links it to a guardian.

| Field | Required | Demo Meaning |
| --- | --- | --- |
| `patientId` | yes | Internal deterministic animal-patient ID |
| `workspaceId` | yes | Workspace scope |
| `guardianId` | yes | Selected or newly created guardian link |
| `name` | yes | Animal name; one-character names are allowed; trim whitespace before save |
| `species` | yes | `dog`, `cat`, `other` |
| `primaryBreedId` | conditional | Main breed selected from species-specific breed list |
| `primaryBreedName` | conditional | Display name copied into patient snapshot |
| `isMixedBreed` | no | Whether mix toggle is on |
| `additionalBreedIds` | no | Up to two additional breed IDs when mix is enabled |
| `sex` | no | Sex/neuter display state, such as intact male/female, neutered male/female, unknown |
| `birthDate` | no | Direct date input or date picker value |
| `estimatedAgeYears`, `estimatedAgeMonths`, `estimatedAgeDays` | no | Age fields used when birth date is not exact |
| `ageIsEstimated` | no | Whether the shown age is estimated |
| `weightKg` | no | Numeric body weight |
| `color` | no | Coat color label |
| `microchipNumber` | no | Numeric microchip value |
| `microchipType` | no | `none`, `internal`, `external` |
| `registrationNumber` | no | Animal registration number |
| `memo` | no | Internal note; demo limit should be stored as validation metadata |
| `primaryAttendingVetId` | no | First or default veterinarian assignment |
| `messageConsentStatus` | no | `granted` by default; `refused` excludes this patient from Kakao/message sending |
| `createdByStaffId` | yes | Staff who registered the patient |
| `createdAt` | yes | Registration timestamp |

## Breed And Species Rules

| Situation | Data Rule |
| --- | --- |
| Species is selected first | Breed search/filter follows the selected species |
| Breed is selected first | Species can be auto-selected from the breed's species |
| Breed has no species | Species field uses `other` fallback |
| Mixed breed is enabled | Show/store `additionalBreedIds`; maximum two additional breeds for registration flow |
| Breed name is long | Store full breed name; UI can truncate later |

## Patient Detail Drawer Contract

The 동물 정보 drawer should read from patient, guardian relationship, consent, staff assignment, and status records.

| Field | Demo Meaning |
| --- | --- |
| `headerDisplayName` | Animal name plus breed display, such as `토이 푸들(Poodle - Toy)` |
| `primaryGuardianDisplayName` | Main guardian shown below the animal name |
| `activeTab` | `animal`, `guardian`, `cs_history`, or `latest` |
| `patientStatus` | Master status: `active`, `deceased`, `soft_deleted` |
| `deceasedAt` | Date/time when deceased status was recorded |
| `deceasedByStaffId` | Staff who marked deceased |
| `deletedAt`, `deletedByStaffId` | Soft-delete audit fields |
| `restoredAt`, `restoredByStaffId` | Restore audit fields |
| `lastUpdatedAt`, `lastUpdatedByStaffId` | Last saved edit metadata |
| `kakaoPatientCode` | Synthetic code shown for message integration examples |
| `hasChart` | Whether chart navigation can target an existing chart |
| `lastChartId` | Latest chart opened when using chart navigation |
| `unsavedChanges` | Dirty-state marker used before navigation or close |

## Guardian Detail Drawer Contract

The 보호자 정보 drawer reads from guardian master data, relationship rows, linked patients, consents, and change history.

| Field | Demo Meaning |
| --- | --- |
| `headerDisplayName` | Guardian name shown in the drawer header |
| `activeTab` | `guardian`, `patient`, `cs_history`, or `latest` |
| `guardianStatus` | `active` or `soft_deleted` |
| `linkedPatientCount` | Number of active patient relationships |
| `needsPatientRegistrationPrompt` | True when a newly registered guardian has no linked patient yet |
| `primaryPatientId` | Optional patient to open first when returning from guardian registration |
| `guardianCode` | Staff-facing synthetic guardian code |
| `createdAt`, `createdByStaffId` | Registration history row |
| `lastUpdatedAt`, `lastUpdatedByStaffId` | Last modification history row |
| `changeHistoryCount` | Enables or disables change-history review |
| `deletedAt`, `deletedByStaffId` | Soft-delete audit fields |
| `restoredAt`, `restoredByStaffId` | Restore audit fields |
| `unsavedChanges` | Dirty-state marker used before navigation or close |

Read/edit rules:

- 보호자 정보 read view should mask sensitive synthetic identifiers.
- Edit mode can expose editable synthetic fields, but the stored dataset must remain fake and resettable.
- Closing, tab navigation, or moving to another page with dirty fields needs an unsaved-change state; exact modal UX is deferred.
- A guardian with no linked animals needs data to drive the "register an animal" prompt until at least one active patient relationship exists.

## Guardian Relationship Contract

| Field | Demo Meaning |
| --- | --- |
| `patientGuardianId` | Stable relationship row ID |
| `patientId` | Animal-patient link |
| `guardianId` | Guardian link |
| `relationshipLabel` | `primary`, `additional`, `family`, or free label |
| `isPrimary` | Main guardian for header and billing defaults |
| `canReceiveMessages` | Whether this guardian can receive patient messages |
| `messageConsentStatus` | `granted`, `refused`, or `unknown` |
| `messageRefusedAt` | Timestamp when refusal was selected |
| `guardianPhoneAvailable` | Whether messaging consent can have actual effect |
| `sortOrder` | Display order in guardian/patient panels |
| `linkedAt`, `linkedByStaffId` | When and by whom the guardian was linked to the patient |
| `unlinkedAt`, `unlinkedByStaffId` | Relationship soft-delete fields; guardian and patient remain intact |
| `primaryChangedAt`, `primaryChangedByStaffId` | Audit fields when the main guardian is changed |

Data rule: if the guardian has no phone number, `messageConsentStatus = granted` should not create a sendable message target.

Additional relationship rules:

- The first guardian linked to a patient should become `isPrimary = true` by default.
- Changing an additional guardian to primary should flip the previous primary to additional and reorder rows.
- Removing an additional guardian from a patient should soft-delete only the relationship row, not the guardian or patient master records.
- Search-adding an existing guardian should create a new relationship only when the guardian is not already linked to that patient.

## Staff Assignment Contract

The 주치의 area can store multiple rows.

| Field | Demo Meaning |
| --- | --- |
| `patientStaffAssignmentId` | Stable assignment row ID |
| `patientId` | Animal-patient link |
| `staffId` | Veterinarian/staff identity |
| `staffDisplayName` | Name copied for demo display |
| `departmentLabel` | Specialty/department text shown below or beside the staff name |
| `assignmentRole` | `primary`, `attending`, or `consulting` |
| `sortOrder` | Display order |
| `isActive` | Whether the row is currently active |

Read view can show the first five active assignments and keep the rest behind `moreCount`. This is display behavior, but it depends on `sortOrder` and `isActive`.

## Patient Activity And Label Data

Patient status labels should be derived from linked operational records, not only stored as free text.

| Label | Data Source | Data Needed |
| --- | --- | --- |
| `예약중` | Appointment | `appointmentId`, scheduled time, department, visit purpose, assigned vet |
| `외래-진료중` | Encounter / chart | `encounterId`, department, current stage, startedAt |
| `입원중` | Inpatient admission | `admissionId`, ward/room, department, admittedAt |
| `마취/수술중` | Surgery/anesthesia task | `taskId`, department, startedAt, expected/endedAt |
| `사망` | Patient master | `deceasedAt`, display enabled until unmarked |
| `삭제` | Patient master | `deletedAt`, display in deleted records only |

Data-affecting label rules:

- If several active statuses exist, store all source links and derive visible labels by priority.
- Suggested priority: surgery/anesthesia, inpatient, outpatient encounter, appointment.
- Show at most two labels in compact patient lists, with `extraLabelCount` for `+n`.
- `deceased` and `soft_deleted` are master patient states; they should not be mixed with active care-stage labels.
- Same status repeated multiple times should collapse into one visible label while keeping source records.

## Existing Guardian Link Rules

The 동물 패널 can add a new guardian or link an existing guardian.

| Situation | Data Rule |
| --- | --- |
| New guardian is registered from a patient panel | Create guardian master row and patient-guardian relationship row |
| Existing guardian is searched and selected | Create only a relationship row |
| Existing guardian is already linked to the same patient | Block duplicate relationship creation |
| Additional guardian relationship is deleted | Set relationship `unlinkedAt`; keep guardian and patient records |
| Main guardian is changed | Update `isPrimary`, `relationshipLabel`, `sortOrder`, and primary-change audit fields |
| Linked guardians are listed in compact patient panel | Store enough label/status data to derive `primary`, `additional`, and action availability |

## Deletion And Restoration Rules

Patient and guardian deletion are soft delete for portfolio data.

| Rule | Data Needed |
| --- | --- |
| Patient has active appointment, reception, encounter, inpatient, surgery, or billing work | Block deletion and show a reason |
| Patient is soft-deleted | Hide from normal/simple search and normal customer lists |
| Deleted patient list | Show soft-deleted patients for hospital-admin/customer management review |
| Restore | Allowed when the workspace still owns the patient and duplicate identifiers do not conflict |
| Permanent identifier | Keep `patientId`, `patientNo`, `microchipNumber`, and `registrationNumber` reserved after soft delete |
| Patient is the only patient for a guardian | Offer a data path to soft-delete patient only or patient plus guardian |
| Patient plus guardian delete | Soft-delete patient, guardian, and active relationship rows together |
| Guardian is primary guardian of an active patient | Block guardian deletion |
| Guardian is only an additional guardian, or linked patients are deceased/inactive/soft-deleted | Guardian can be soft-deleted if financial locks do not apply |
| Guardian has deposit, prepayment, or unpaid balance | Block guardian deletion |
| Guardian is soft-deleted | Hide from simple search and normal lists; keep visible in deleted records review |
| Guardian identifier preservation | Keep `guardianId`, `guardianCode`, normalized phone, and synthetic identifier tokens reserved after soft delete |
| Guardian restore | Restore guardian when workspace ownership and duplicate checks still pass |

Never hard-delete synthetic patient/guardian history in the portfolio demo.

## Navigation And Action Data

Header/footer actions do not need deep UX documentation now, but some actions need data state.

| Action | Data Needed |
| --- | --- |
| 접수 | `patientId`, primary or selected `guardianId`, current unsaved state, target reception route |
| 예약 | `patientId`, primary or selected `guardianId`, current unsaved state, target schedule route |
| 차트 보러가기 | `patientId`, `hasChart`, `lastChartId`; if no chart exists, require a new chart memo draft |
| 카카오톡 발송 | `patientId`, eligible guardian message target, `messageConsentStatus`, `guardianPhoneAvailable` |
| 정보 수정 / 저장 | dirty fields, last updated staff/time |
| 삭제 | deletion lock reasons and soft-delete audit fields |
| 보호자 등록 완료 | `guardianId`, optional `targetPatientId`, `linkedPatientCount`, duplicate override audit, toast action target |
| 기존 보호자 추가 | selected existing `guardianId`, `patientId`, duplicate relationship check, created relationship row |
| 주 보호자로 변경 | `patientGuardianId`, previous primary relationship row, new sort order, actor/time |
| 추가 보호자 연결 삭제 | `patientGuardianId`, relationship soft-delete audit; guardian/patient master records remain |

## Deferred Screen-Implementation Notes

- Exact modal copy for leaving unsaved edits.
- Tooltip wording for long attending-vet rows and long status bars.
- Button placement for 접수, 예약, 차트 보러가기, 카카오톡 발송.
- Drawer tab spacing, read-only frame styling, and collapsed/expanded vet list visuals.
- Snackbar text and animation timing.
- Figma-specific component names such as CDS selection list, infobox, or modal variants.
- Exact protector/guardian registration modal copy and duplicate-confirmation wording.
- Row-size visual changes, button icon choices, and panel layout when there are multiple guardians.

## Out Of Scope For V1

- Real owner or animal data import.
- Production message delivery.
- Real KakaoTalk provider integration.
- Hard deletion of medical history.
- Clinical interpretation of breed, age, sex, weight, or status.
- Remote Supabase, production deploy, or real data access.
