import { expect, test } from "@playwright/test";
import { createMockOrderCatalogGateway } from "../src/features/hospital-admin/server-order-catalog-core";
import { mapWorkspaceCatalogItemsToHospitalOrders } from "../src/features/hospital-admin/data";
import { deniedCatalogCapabilities, useHospitalAdminStore } from "../src/features/hospital-admin/store";

const capabilities = { canManageCatalog: true, canAuthorDispensing: true, canApproveDispensing: true };
test.afterEach(() => useHospitalAdminStore.setState(useHospitalAdminStore.getInitialState(), true));
async function fixture() {
  const result = await createMockOrderCatalogGateway().listAdminCatalog({ workspaceId: "clair-demo" });
  if (!result.ok) throw Error(result.error);
  expect(result.items.length).toBeGreaterThan(0);
  return mapWorkspaceCatalogItemsToHospitalOrders(result.items);
}

test("catalog starts empty and late foreign-owner read cannot populate the next workspace", async () => {
  expect(useHospitalAdminStore.getState().orders).toEqual([]);
  const items = await fixture();
  const store = useHospitalAdminStore.getState();
  const first = store.beginCatalogLoad("clair-demo");
  store.finishCatalogLoad("clair-demo", first, { status: "ready", orders: items, capabilities });
  store.createOrder();
  const second = store.beginCatalogLoad("foreign-workspace");
  expect(useHospitalAdminStore.getState()).toMatchObject({ orders: [], catalogWorkspaceId: "foreign-workspace", catalogCapabilities: deniedCatalogCapabilities });
  store.finishCatalogLoad("clair-demo", first, { status: "ready", orders: items, capabilities });
  expect(useHospitalAdminStore.getState().orders).toEqual([]);
  store.finishCatalogLoad("foreign-workspace", second, { status: "ready", orders: [], capabilities });
  expect(useHospitalAdminStore.getState()).toMatchObject({ orders: [], catalogReadStatus: "ready" });
});

test("denial clears rows, drafts and rights; stale same-workspace failures cannot replace a newer read", async () => {
  const items = await fixture();
  const store = useHospitalAdminStore.getState();
  const first = store.beginCatalogLoad("clair-demo");
  store.finishCatalogLoad("clair-demo", first, { status: "ready", orders: items, capabilities });
  store.createOrder();
  const retry = store.beginCatalogLoad("clair-demo");
  store.finishCatalogLoad("clair-demo", retry, { status: "ready", orders: items, capabilities });
  store.finishCatalogLoad("clair-demo", first, { status: "error" });
  expect(useHospitalAdminStore.getState().catalogReadStatus).toBe("ready");
  store.finishCatalogLoad("clair-demo", retry, { status: "denied" });
  expect(useHospitalAdminStore.getState()).toMatchObject({ orders: [], selectedOrderIds: [], focusedOrderId: null, catalogCapabilities: deniedCatalogCapabilities, catalogReadStatus: "denied" });
});

test("foreign rows in a successful payload fail closed without an alternate catalog", async () => {
  const items = await fixture();
  const store = useHospitalAdminStore.getState();
  const generation = store.beginCatalogLoad("foreign-workspace");
  store.finishCatalogLoad("foreign-workspace", generation, { status: "ready", orders: items, capabilities });
  expect(useHospitalAdminStore.getState()).toMatchObject({ orders: [], catalogReadStatus: "error", catalogCapabilities: deniedCatalogCapabilities });
});
