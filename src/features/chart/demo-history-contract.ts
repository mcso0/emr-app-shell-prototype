export const cheongdamWorkspaceId = "workspace-clair-cheongdam";
export type DemoHistoryItem = {
  id: string;
  patientId: string;
  patient: string;
  species: string;
  visitAt: string;
  title: string;
  soap: { S: string; O: string; A: string; P: string };
  diagnosis: { name: string; kind: string } | null;
  orders: {
    name: string;
    module: "lab" | "treatment";
    catalogId: string;
    interpretation: string | null;
  }[];
};
