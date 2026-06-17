import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

import { createMockLiveAuditAppendGateway } from "../src/features/audit/server-audit-log-persistence-core";
import { saveBillingPaymentStatus } from "../src/features/billing/server-payment-status-persistence-core";
import { completeChart } from "../src/features/chart/server-chart-completion-core";
import { saveChartOrderAction } from "../src/features/chart/server-order-action-persistence-core";
import { saveChartSoapNote } from "../src/features/chart/server-soap-note-persistence-core";
import { createReceptionAppointmentCheckIn } from "../src/features/reception/server-appointment-check-in-core";
import { createReceptionAppointment } from "../src/features/reception/server-appointment-create-core";
import { createReceptionWalkInEncounter } from "../src/features/reception/server-walk-in-encounter-core";

const workspaceId = "clair-demo";
const now = () => "2026-05-20T12:30:00+09:00";

test("critical workspace mutation cores emit safe live audit summaries after successful writes", async () => {
  const auditGateway = createMockLiveAuditAppendGateway();

  const walkIn = await createReceptionWalkInEncounter({
    actorUserId: "user-front-desk",
    workspaceId,
    auditGateway,
    auditNow: now,
    auditRequestId: "req-den-85-walkin",
    input: {
      patientId: "patient-coco",
      guardianId: "guardian-lee-jieun",
      primaryVeterinarianId: "staff-vet-lee",
      department: "내과",
      durationMinutes: 30,
      visitPurpose: "synthetic audit flow",
    },
  });
  expect(walkIn.ok).toBe(true);

  const checkIn = await createReceptionAppointmentCheckIn({
    actorUserId: "user-front-desk",
    workspaceId,
    appointmentId: "appointment-nabi-260501",
    auditGateway,
    auditNow: now,
    auditRequestId: "req-den-85-checkin",
  });
  expect(checkIn.ok).toBe(true);

  const appointment = await createReceptionAppointment({
    actorUserId: "user-front-desk",
    workspaceId,
    auditGateway,
    auditNow: now,
    auditRequestId: "req-den-516-appointment",
    input: {
      assignedVeterinarianId: "user-vet-doyun",
      durationMinutes: 30,
      guardianId: "guardian-oh-sea",
      patientId: "patient-nabi",
      reservationMemo: "safe audit appointment create",
      scheduledStartAt: "2026-05-01T13:30:00+09:00",
    },
  });
  expect(appointment.ok).toBe(true);

  const soap = await saveChartSoapNote({
    actorUserId: "user-vet",
    workspaceId,
    auditGateway,
    auditNow: now,
    auditRequestId: "req-den-85-soap",
    input: {
      encounterId: "encounter-coco-260501",
      subjective: "do not store full note in audit",
      objective: "do not store full note in audit",
      assessment: "workflow-only assessment",
      plan: "workflow-only plan",
      mode: "manual_save",
    },
  });
  expect(soap.ok).toBe(true);

  const completion = await completeChart({
    actorUserId: "user-vet",
    workspaceId,
    auditGateway,
    auditNow: now,
    auditRequestId: "req-den-85-complete",
    input: { encounterId: "encounter-coco-260501" },
  });
  expect(completion.ok).toBe(true);

  const order = await saveChartOrderAction({
    actorUserId: "user-vet",
    workspaceId,
    auditGateway,
    auditNow: now,
    auditRequestId: "req-den-85-order",
    input: {
      action: "confirm",
      encounterId: "encounter-kong-260501",
      orderIds: ["order-kong-maropitant"],
    },
  });
  expect(order.ok).toBe(true);

  const payment = await saveBillingPaymentStatus({
    actorUserId: "user-tech",
    workspaceId,
    auditGateway,
    auditNow: now,
    auditRequestId: "req-den-85-payment",
    input: {
      action: "complete_payment",
      invoiceId: "invoice-kong-260501",
      paymentMethod: "card",
    },
  });
  expect(payment.ok).toBe(true);

  expect(auditGateway.events.map((event) => event.eventType)).toEqual(
    expect.arrayContaining([
      "reception.walk_in_created",
      "reception.appointment_checked_in",
      "reception.appointment_created",
      "chart.soap_saved",
      "chart.completed",
      "order.confirmed",
      "billing.payment_state_changed",
    ])
  );
  expect(auditGateway.events.every((event) => event.workspaceId === workspaceId)).toBe(true);
  expect(auditGateway.events.every((event) => event.actorUserId)).toBe(true);
  expect(auditGateway.events.find((event) => event.eventType === "chart.soap_saved")).toMatchObject({
    targetType: "soap_note",
    encounterId: "encounter-coco-260501",
    metadata: { source: "chart-soap-note-persistence" },
  });
  expect(auditGateway.events.find((event) => event.eventType === "billing.payment_state_changed")).toMatchObject({
    targetType: "invoice",
    targetId: "invoice-kong-260501",
    after: { paymentState: "paid" },
  });

  const serializedEvents = JSON.stringify(auditGateway.events);
  expect(serializedEvents).not.toContain("do not store full note in audit");
  expect(serializedEvents).not.toMatch(/password|secret|token|serviceRole|rawPayload|stackTrace|sqlError|fullSoap|fullChart/i);
});

test("live mutation routes wire Supabase writes to the audit append gateway", () => {
  const routePaths = [
    "src/app/api/workspaces/[workspaceId]/memberships/[membershipId]/roles/route.ts",
    "src/app/api/workspaces/[workspaceId]/memberships/[membershipId]/status/route.ts",
    "src/app/api/workspaces/[workspaceId]/reception/walk-in-encounters/route.ts",
    "src/app/api/workspaces/[workspaceId]/reception/appointments/route.ts",
    "src/app/api/workspaces/[workspaceId]/reception/appointments/[appointmentId]/check-in/route.ts",
    "src/app/api/workspaces/[workspaceId]/chart/soap-notes/route.ts",
    "src/app/api/workspaces/[workspaceId]/chart/completion/route.ts",
    "src/app/api/workspaces/[workspaceId]/chart/order-actions/route.ts",
    "src/app/api/workspaces/[workspaceId]/billing/payment-status/route.ts",
  ];

  for (const routePath of routePaths) {
    const source = readFileSync(routePath, "utf8");
    expect(source).toContain("createSupabaseLiveAuditAppendGateway");
    expect(source).toContain("getAuditRequestId");
  }
});
