import type { SearchChart } from "./contract";

export function exampleChart(
  id: string,
  values: Partial<SearchChart> = {},
): SearchChart {
  return {
    id,
    encounterId: "synthetic-visit-" + id,
    patientId: "synthetic-patient-" + id,
    patient: "모카",
    guardian: "보호자 가",
    species: "cat",
    breed: "코리안 쇼트헤어",
    age: 6,
    createdAt: "2026-11-17T02:05:00Z",
    visitAt: "2026-11-17T02:00:00Z",
    visitType: "appointment",
    primaryVet: "한서진",
    taskStatuses: ["pending"],
    clinicalAt: "2026-11-17T02:00:00Z",
    authorId: "vet-a",
    author: "한서진",
    doctorId: "vet-b",
    doctor: "이도윤",
    status: "signed",
    purpose: "식후 반복되는 구토",
    complaint: "식사량 감소",
    editable: false,
    version: "1",
    paragraphs: [
      {
        id: "1",
        section: "subjective",
        scope: "기본 SOAP",
        text: "어제 저녁부터 식후 구토가 세 차례 있었음.",
      },
    ],
    diagnoses: [],
    orders: [
      {
        id: "ultrasound",
        kind: "imaging",
        name: "복부 초음파",
        catalogId: "local-ultrasound",
        available: true,
        price: 48000,
        quantity: 1,
        inputs: {},
      },
    ],
    media: [],
    ...values,
  };
}
