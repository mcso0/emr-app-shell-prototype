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

Data rule: if the guardian has no phone number, `messageConsentStatus = granted` should not create a sendable message target.

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

## Deletion And Restoration Rules

Patient deletion is soft delete for portfolio data.

| Rule | Data Needed |
| --- | --- |
| Patient has active appointment, reception, encounter, inpatient, surgery, or billing work | Block deletion and show a reason |
| Patient is soft-deleted | Hide from normal/simple search and normal customer lists |
| Deleted patient list | Show soft-deleted patients for hospital-admin/customer management review |
| Restore | Allowed when the workspace still owns the patient and duplicate identifiers do not conflict |
| Permanent identifier | Keep `patientId`, `patientNo`, `microchipNumber`, and `registrationNumber` reserved after soft delete |
| Patient is the only patient for a guardian | Offer a data path to soft-delete patient only or patient plus guardian |
| Patient plus guardian delete | Soft-delete patient, guardian, and active relationship rows together |

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

## Deferred Screen-Implementation Notes

- Exact modal copy for leaving unsaved edits.
- Tooltip wording for long attending-vet rows and long status bars.
- Button placement for 접수, 예약, 차트 보러가기, 카카오톡 발송.
- Drawer tab spacing, read-only frame styling, and collapsed/expanded vet list visuals.
- Snackbar text and animation timing.
- Figma-specific component names such as CDS selection list, infobox, or modal variants.

## Out Of Scope For V1

- Real owner or animal data import.
- Production message delivery.
- Real KakaoTalk provider integration.
- Hard deletion of medical history.
- Clinical interpretation of breed, age, sex, weight, or status.
- Remote Supabase, production deploy, or real data access.
