"use client";

import { create } from "zustand";
import {
  createEmptyHospitalOrderDraft,
  type HospitalOrderCatalogItem,
  type HospitalOrderCategoryId,
  type HospitalOrderDraft,
  type HospitalOrderSubcategoryId,
} from "@/features/hospital-admin/data";
import type { OrderCatalogAdminCapabilities } from "@/features/hospital-admin/server-order-catalog";

export type HospitalAdminSection =
  | "audit"
  | "members"
  | "orders"
  | "order-sets"
  | "roles"
  | "schedule"
  | "settings"
  | "settings-contact"
  | "settings-hours"
  | "space-time"
  | "vitals";

type HospitalAdminStore = {
  catalogWorkspaceId: string | null;
  catalogGeneration: number;
  catalogReadStatus: "idle" | "loading" | "ready" | "error" | "denied";
  beginCatalogLoad: (workspaceId: string) => number;
  finishCatalogLoad: (workspaceId: string, generation: number, result:
    | { status: "ready"; orders: HospitalOrderCatalogItem[]; capabilities: OrderCatalogAdminCapabilities }
    | { status: "error" | "denied" }) => void;
  activeSection: HospitalAdminSection;
  focusedOrderId: string | null;
  orders: HospitalOrderCatalogItem[];
  searchQuery: string;
  selectedCategoryId: HospitalOrderCategoryId;
  selectedOrderIds: string[];
  selectedSubcategoryId: HospitalOrderSubcategoryId;
  settingsDirty: boolean;
  catalogCapabilities: OrderCatalogAdminCapabilities;
  clearSelectedOrders: () => void;
  createOrder: (draft?: Partial<HospitalOrderDraft>) => HospitalOrderCatalogItem;
  deleteOrder: (orderId: string) => void;
  duplicateOrder: (orderId: string) => HospitalOrderCatalogItem | null;
  cancelPendingSectionChange: () => void;
  confirmPendingSectionChange: () => void;
  pendingSection: HospitalAdminSection | null;
  requestSectionChange: (section: HospitalAdminSection) => void;
  setActiveSection: (section: HospitalAdminSection) => void;
  setCatalogCapabilities: (
    capabilities: OrderCatalogAdminCapabilities,
  ) => void;
  setFocusedOrderId: (orderId: string | null) => void;
  setOrders: (orders: HospitalOrderCatalogItem[]) => void;
  setSearchQuery: (query: string) => void;
  setSelectedCategoryId: (categoryId: HospitalOrderCategoryId) => void;
  setSelectedSubcategoryId: (subcategoryId: HospitalOrderSubcategoryId) => void;
  setSettingsDirty: (dirty: boolean) => void;
  selectOrder: (orderId: string) => void;
  toggleOrderSelection: (orderId: string, selected: boolean) => void;
  toggleVisibleOrderSelection: (orderIds: string[], selected: boolean) => void;
  updateOrder: (orderId: string, draft: Partial<HospitalOrderDraft>) => void;
};

const defaultCategoryId: HospitalOrderCategoryId = "lab";
const defaultSubcategoryId: HospitalOrderSubcategoryId = "unclassified";

const localDraftOrderIdPrefix = "hospital-order-custom-";
const getNextOrderId = () => `${localDraftOrderIdPrefix}${Date.now().toString(36)}`;
export const emptyHospitalOrders: HospitalOrderCatalogItem[] = [];
export const deniedCatalogCapabilities: OrderCatalogAdminCapabilities = {
  canManageCatalog: false, canAuthorDispensing: false, canApproveDispensing: false,
};

export const useHospitalAdminStore = create<HospitalAdminStore>()((set, get) => ({
  catalogWorkspaceId: null,
  catalogGeneration: 0,
  catalogReadStatus: "idle",
  beginCatalogLoad: (workspaceId) => {
    const state = get();
    const sameWorkspace = state.catalogWorkspaceId === workspaceId;
    const generation = state.catalogGeneration + 1;
    set({ catalogWorkspaceId: workspaceId, catalogGeneration: generation,
      catalogReadStatus: "loading", catalogCapabilities: deniedCatalogCapabilities,
      orders: sameWorkspace ? state.orders.filter(order => !order.sourceCatalogItem && order.id.startsWith(localDraftOrderIdPrefix)) : [],
      selectedOrderIds: [], focusedOrderId: null,
      ...(!sameWorkspace ? { searchQuery: "", selectedCategoryId: defaultCategoryId, selectedSubcategoryId: defaultSubcategoryId } : {}),
    });
    return generation;
  },
  finishCatalogLoad: (workspaceId, generation, result) => {
    const state = get();
    if (state.catalogWorkspaceId !== workspaceId || state.catalogGeneration !== generation) return;
    if (result.status !== "ready") {
      set({ orders: [], catalogReadStatus: result.status, catalogCapabilities: deniedCatalogCapabilities,
        selectedOrderIds: [], focusedOrderId: null });
      return;
    }
    if (result.orders.some(order => order.sourceCatalogItem?.workspaceId !== workspaceId)) {
      state.finishCatalogLoad(workspaceId, generation, { status: "error" });
      return;
    }
    state.setOrders(result.orders);
    set({ catalogReadStatus: "ready", catalogCapabilities: result.capabilities });
  },
  activeSection: "orders",
  focusedOrderId: null,
  orders: [],
  searchQuery: "",
  selectedCategoryId: defaultCategoryId,
  selectedOrderIds: [],
  selectedSubcategoryId: defaultSubcategoryId,
  settingsDirty: false,
  catalogCapabilities: {
    canManageCatalog: false,
    canAuthorDispensing: false,
    canApproveDispensing: false,
  },
  clearSelectedOrders: () => set({ selectedOrderIds: [] }),
  createOrder: (draft = {}) => {
    const state = get();
    const baseDraft = createEmptyHospitalOrderDraft(
      state.selectedCategoryId,
      state.selectedSubcategoryId
    );
    const order: HospitalOrderCatalogItem = {
      ...baseDraft,
      ...draft,
      id: draft.id ?? getNextOrderId(),
      categoryId: draft.categoryId ?? baseDraft.categoryId,
      subcategoryId: draft.subcategoryId ?? baseDraft.subcategoryId,
      updatedAtLabel: "방금",
      updatedBy: "송민재",
    };

    set((current) => ({
      orders: [order, ...current.orders],
      focusedOrderId: order.id,
      selectedCategoryId: order.categoryId,
      selectedOrderIds: [],
      selectedSubcategoryId: order.subcategoryId,
    }));

    return order;
  },
  deleteOrder: (orderId) =>
    set((state) => ({
      orders: state.orders.filter((order) => order.id !== orderId),
      selectedOrderIds: state.selectedOrderIds.filter((id) => id !== orderId),
    })),
  duplicateOrder: (orderId) => {
    const source = get().orders.find((order) => order.id === orderId);
    if (!source) return null;

    return get().createOrder({
      ...source,
      id: getNextOrderId(),
      billingName: `${source.billingName} 복사본`,
      inHospitalName: `${source.inHospitalName} 복사본`,
      sourceCatalogItem: undefined,
      standardName: `${source.standardName} 복사본`,
    });
  },
  cancelPendingSectionChange: () => set({ pendingSection: null }),
  confirmPendingSectionChange: () => {
    const pendingSection = get().pendingSection;
    if (!pendingSection) return;
    set({ activeSection: pendingSection, pendingSection: null, settingsDirty: false });
  },
  pendingSection: null,
  requestSectionChange: (section) => {
    const state = get();
    const guardsUnsavedSettings =
      (
        state.activeSection === "settings" ||
        state.activeSection === "settings-contact" ||
        state.activeSection === "settings-hours" ||
        state.activeSection === "roles"
      ) &&
      state.settingsDirty &&
      section !== state.activeSection;
    if (guardsUnsavedSettings) {
      set({ pendingSection: section });
      return;
    }
    set({ activeSection: section, pendingSection: null });
  },
  setActiveSection: (activeSection) => set({ activeSection }),
  setCatalogCapabilities: (catalogCapabilities) =>
    set({ catalogCapabilities }),
  setFocusedOrderId: (focusedOrderId) => set({ focusedOrderId }),
  setOrders: (orders) =>
    set((state) => {
      const incomingOrderIds = new Set(orders.map((order) => order.id));
      const localDraftOrders = state.orders.filter(
        (order) =>
          order.id.startsWith(localDraftOrderIdPrefix) &&
          !order.sourceCatalogItem &&
          !incomingOrderIds.has(order.id)
      );
      const mergedOrders = [...localDraftOrders, ...orders];
      const orderIds = new Set(mergedOrders.map((order) => order.id));
      const selectedOrderIds = state.selectedOrderIds.filter((id) => orderIds.has(id));
      const focusedOrderId =
        state.focusedOrderId && orderIds.has(state.focusedOrderId)
          ? state.focusedOrderId
          : null;
      const selectedOrder = selectedOrderIds[0]
        ? mergedOrders.find((order) => order.id === selectedOrderIds[0])
        : undefined;

      return {
        orders: mergedOrders,
        focusedOrderId,
        selectedOrderIds,
        selectedCategoryId: selectedOrder?.categoryId ?? state.selectedCategoryId,
        selectedSubcategoryId: selectedOrder?.subcategoryId ?? state.selectedSubcategoryId,
      };
    }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSelectedCategoryId: (selectedCategoryId) =>
    set({
      focusedOrderId: null,
      selectedCategoryId,
      selectedOrderIds: [],
      selectedSubcategoryId: "unclassified",
    }),
  setSelectedSubcategoryId: (selectedSubcategoryId) =>
    set({ focusedOrderId: null, selectedOrderIds: [], selectedSubcategoryId }),
  setSettingsDirty: (settingsDirty) => set({ settingsDirty }),
  selectOrder: (orderId) => set({ selectedOrderIds: [orderId] }),
  toggleOrderSelection: (orderId, selected) =>
    set((state) => ({
      selectedOrderIds: selected
        ? Array.from(new Set([...state.selectedOrderIds, orderId]))
        : state.selectedOrderIds.filter((id) => id !== orderId),
    })),
  toggleVisibleOrderSelection: (orderIds, selected) =>
    set((state) => {
      const visibleIds = new Set(orderIds);

      if (!selected) {
        return {
          selectedOrderIds: state.selectedOrderIds.filter((id) => !visibleIds.has(id)),
        };
      }

      return {
        selectedOrderIds: Array.from(new Set([...state.selectedOrderIds, ...orderIds])),
      };
    }),
  updateOrder: (orderId, draft) =>
    set((state) => ({
      orders: state.orders.map((order) =>
        order.id === orderId
          ? {
              ...order,
              ...draft,
              id: draft.id ?? order.id,
              updatedAtLabel: draft.sourceCatalogItem ? draft.updatedAtLabel ?? order.updatedAtLabel : "방금",
              updatedBy: draft.sourceCatalogItem ? draft.updatedBy ?? order.updatedBy : "송민재",
            }
          : order
      ),
    })),
}));
