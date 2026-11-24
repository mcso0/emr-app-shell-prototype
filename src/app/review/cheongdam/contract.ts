export type CheongdamReviewRecord = {
  id: string;
  patientId: string;
  patient: string;
  species: string;
  visitAt: string;
  title: string;
  diagnosis?: { name: string; kind: string } | null;
  soap: { S: string; O: string; A: string; P: string };
  orders: readonly { name: string; module: string; interpretation?: string | null }[];
};
