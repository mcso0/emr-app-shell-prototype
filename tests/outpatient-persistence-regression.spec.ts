import { expect, test } from "@playwright/test";

const workspaceId = "clair-demo";
const encounterId = "encounter-dubu-260501";
const invoiceId = "invoice-dubu-260501";
const orderId = "order-dubu-carprofen";

test("outpatient persistence flow survives route-backed reload checkpoints", async ({
  request,
}) => {
  const clientSessionId = `den80-${Date.now()}`;
  const vetHeaders = {
    "x-clair-demo-session-user-id": "user-vet",
  };
  const billingHeaders = {
    "x-clair-demo-client-session-id": clientSessionId,
    "x-clair-demo-session-user-id": "user-tech",
  };

  const soapInput = {
    encounterId,
    subjective: "DEN-80 reload checkpoint subjective",
    objective: "DEN-80 reload checkpoint objective",
    assessment: "DEN-80 workflow assessment",
    plan: "DEN-80 workflow plan",
    mode: "autosave",
  };
  const savedSoap = await request.patch(`/api/workspaces/${workspaceId}/chart/soap-notes`, {
    data: soapInput,
    headers: vetHeaders,
  });
  expect(savedSoap.status(), "SOAP save checkpoint").toBe(200);

  const reloadedSoap = await request.get(
    `/api/workspaces/${workspaceId}/chart/soap-notes?encounterId=${encounterId}`,
    { headers: vetHeaders }
  );
  expect(reloadedSoap.status(), "SOAP reload checkpoint").toBe(200);
  const reloadedSoapBody = await reloadedSoap.json() as {
    ok: true;
    soapNote: { subjective: string };
  };
  expect(reloadedSoapBody.soapNote.subjective).toBe(soapInput.subjective);

  const confirmedOrder = await request.patch(`/api/workspaces/${workspaceId}/chart/order-actions`, {
    data: {
      action: "confirm",
      encounterId,
      orderIds: [orderId],
    },
    headers: vetHeaders,
  });
  expect(confirmedOrder.status(), "order confirmation checkpoint").toBe(200);

  const reloadedOrder = await request.get(
    `/api/workspaces/${workspaceId}/chart/order-actions?encounterId=${encounterId}`,
    { headers: vetHeaders }
  );
  expect(reloadedOrder.status(), "order reload checkpoint").toBe(200);
  const reloadedOrderBody = await reloadedOrder.json() as {
    ok: true;
    orderActions: Array<{ orderConfirmationStatus: string; orderId: string }>;
  };
  expect(reloadedOrderBody.orderActions).toContainEqual(
    expect.objectContaining({
      orderConfirmationStatus: "confirmed",
      orderId,
    })
  );

  const syncedCandidate = await request.patch(
    `/api/workspaces/${workspaceId}/billing/invoice-candidates`,
    {
      data: {
        encounterId,
        orderIds: [orderId],
      },
      headers: billingHeaders,
    }
  );
  expect(syncedCandidate.status(), "invoice candidate checkpoint").toBe(200);

  const reloadedCandidate = await request.get(
    `/api/workspaces/${workspaceId}/billing/invoice-candidates?encounterId=${encounterId}`,
    { headers: billingHeaders }
  );
  expect(reloadedCandidate.status(), "invoice candidate reload checkpoint").toBe(200);
  const reloadedCandidateBody = await reloadedCandidate.json() as {
    ok: true;
    candidates: Array<{ invoiceId: string; lineTotal: number; orderId: string }>;
  };
  expect(reloadedCandidateBody.candidates).toContainEqual(
    expect.objectContaining({
      invoiceId,
      lineTotal: 9000,
      orderId,
    })
  );

  const completedBilling = await request.patch(
    `/api/workspaces/${workspaceId}/billing/payment-status`,
    {
      data: {
        action: "complete_payment",
        invoiceId,
        paymentMethod: "card",
      },
      headers: billingHeaders,
    }
  );
  expect(completedBilling.status(), "billing completion checkpoint").toBe(200);

  const reloadedPayment = await request.get(
    `/api/workspaces/${workspaceId}/billing/payment-status?invoiceId=${invoiceId}`,
    { headers: billingHeaders }
  );
  expect(reloadedPayment.status(), "billing completion reload checkpoint").toBe(200);
  const reloadedPaymentBody = await reloadedPayment.json() as {
    ok: true;
    invoice: { paymentState: string; status: string };
    payments: Array<{ amount: number; paymentMethod: string; status: string }>;
  };
  expect(reloadedPaymentBody.invoice).toMatchObject({
    paymentState: "paid",
    status: "paid",
  });
  expect(reloadedPaymentBody.payments).toContainEqual(
    expect.objectContaining({
      amount: 28000,
      paymentMethod: "card",
      status: "approved",
    })
  );
});
