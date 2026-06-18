export const receptionDurationStepMinutes = 15;

export const isReceptionDurationMinutesValid = (durationMinutes?: number) =>
  durationMinutes === undefined ||
  (Number.isInteger(durationMinutes) &&
    durationMinutes > 0 &&
    durationMinutes % receptionDurationStepMinutes === 0);

export const receptionDurationValidationMessage =
  "예상 진료시간은 15분 단위로 설정해 주세요.";
