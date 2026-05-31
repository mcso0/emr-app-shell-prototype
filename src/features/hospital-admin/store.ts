"use client";

import { create } from "zustand";
import {
  createEmptyHospitalOrderDraft,
  getDefaultSubcategoryId,
  hospitalOrderCategories,
  hospitalOrderSeedItems,
  type HospitalOrderBillingFilter,
  type HospitalOrderCatalogItem,
  type HospitalOrderCategoryId,
  type HospitalOrderDraft,
  type HospitalOrderStatusFilter,
  type HospitalOrderSubcategoryId,
  type HospitalOrderWorkTypeFilter,
} from "@/features/hospital-admin/data";

type HospitalAdminStore = {
  activeSection: "orders" | "members" | "audit";
  billingFilter: HospitalOrderBillingFilter;
  focusedOrderId: string | null;
  orders: HospitalOrderCatalogItem[];
  searchQuery: string;
  selectedCategoryId: HospitalOrderCategoryId;
  selectedOrderIds: string[];
  selectedSubcategoryId: HospitalOrderSubcategoryId;
  statusFilter: HospitalOrderStatusFilter;
  workTypeFilter: HospitalOrderWorkTypeFilter;
  clearSelectedOrders: () => void;
  createOrder: (draft?: Partial<HospitalOrderDraft>) => HospitalOrderCatalogItem;
  deleteOrder: (orderId: string) => void;
  duplicateOrder: (orderId: string) => HospitalOrderCatalogItem | null;
  setActiveSection: (section: "orders" | "members" | "audit") => void;
  setBillingFilter: (filter: HospitalOrderBillingFilter) => void;
  setFocusedOrderId: (orderId: string | null) => void;
  setOrders: (orders: HospitalOrderCatalogItem[]) => void;
  setSearchQuery: (query: string) => void;
  setSelectedCategoryId: (categoryId: HospitalOrderCategoryId) => void;
  setSelectedSubcategoryId: (subcategoryId: HospitalOrderSubcategoryId) => void;
  selectOrder: (orderId: string) => void;
  setStatusFilter: (filter: HospitalOrderStatusFilter) => void;
  setWorkTypeFilter: (filter: HospitalOrderWorkTypeFilter) => void;
  toggleOrderSelection: (orderId: string, selected: boolean) => void;
  toggleVisibleOrderSelection: (orderIds: string[], selected: boolean) => void;
  updateOrder: (orderId: string, draft: Partial<HospitalOrderDraft>) => void;
};

const defaultCategoryId: HospitalOrderCategoryId = "lab";
const defaultSubcategoryId = getDefaultSubcategoryId(defaultCategoryId) ?? "clinical-pathology";

const localDraftOrderIdPrefix = "hospital-order-custom-";
const getNextOrderId = () => `${localDraftOrderIdPrefix}${Date.now().toString(36)}`;

export const useHospitalAdminStore = create<HospitalAdminStore>()((set, get) => ({
  activeSection: "orders",
  billingFilter: "all",
  focusedOrderId: null,
  orders: hospitalOrderSeedItems,
  searchQuery: "",
  selectedCategoryId: defaultCategoryId,
  selectedOrderIds: [],
  selectedSubcategoryId: defaultSubcategoryId,
  statusFilter: "all",
  workTypeFilter: "all",
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
  setActiveSection: (activeSection) => set({ activeSection }),
  setBillingFilter: (billingFilter) => set({ billingFilter }),
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
      selectedSubcategoryId: getDefaultSubcategoryId(selectedCategoryId) ?? defaultSubcategoryId,
    }),
  setSelectedSubcategoryId: (selectedSubcategoryId) =>
    set({ focusedOrderId: null, selectedOrderIds: [], selectedSubcategoryId }),
  selectOrder: (orderId) => set({ selectedOrderIds: [orderId] }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  setWorkTypeFilter: (workTypeFilter) => set({ workTypeFilter }),
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
              id: order.id,
              updatedAtLabel: "방금",
              updatedBy: "송민재",
            }
          : order
      ),
    })),
}));
