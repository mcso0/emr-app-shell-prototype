---
title: "Reception UI polish and registration dialog alignment"
area: reception
date: 2026-05-04
status: completed
---

# Reception UI Polish And Registration Dialog Alignment

## Summary

접수/예약 화면의 운영 UI를 현장 피드백 기준으로 다듬었다. 수의사 선택, 캘린더 헤더/카드, 접수 대기 카드, 접수 정보 drawer, 검색 입력 초기화, toolbar button, 주/월 캘린더 표시를 보강했고 신규 동물/보호자 등록 dialog를 같은 작은 shadcn 기반 modal 구조로 정리했다.

## Changed

- 네비게이션 rail icon 기본 색상을 `grey/400` 기준으로 맞췄다.
- 수의사 목록을 10명으로 늘리고, 오늘 근무 수의사와 그 외 수의사 그룹, avatar+name 표시, `이수지 +7` 형태의 trigger label을 적용했다.
- 수의사 calendar header를 avatar+name과 수의사별 색상으로 표시했다.
- 접수 side panel card를 조제/처치 side panel card 스타일에 맞게 정돈하고, 접수 정보 drawer로 연결되게 했다.
- 대기 시간 표기를 짧게 만들고 장기 대기는 강조 색상으로 표시했다.
- 검색 입력에 fill-style clear action을 추가했다.
- 상단 toolbar button label/icon/size/radius를 조제/처치 기준에 맞췄다.
- 주/월 calendar의 시간축, current-time marker, full-height layout을 보강했다.
- 신규 동물 등록과 보호자 등록 dialog를 `640px` modal, section divider, shadcn `Field` composition 기반으로 맞췄다.

## Verification

- `npm run lint -- src/features/reception/profile-drawer.tsx src/features/reception/patient-profile-store.ts src/types/emr-domain.ts`
- `npx tsc --noEmit`
- `npx playwright test tests/reception.spec.ts --reporter=line` (`17 passed`)

## Notes

- 변경은 mock/session-only prototype 범위에 머문다.
- 조제/처치 화면은 재사용 기준으로 참조했으며, 기존 동작 자체는 유지했다.
