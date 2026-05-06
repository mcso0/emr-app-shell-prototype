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
  billingFilter: HospitalOrderBillingFilter;
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
  setBillingFilter: (filter: HospitalOrderBillingFilter) => void;
  setSearchQuery: (query: string) => void;
  setSelectedCategoryId: (categoryId: HospitalOrderCategoryId) => void;
  setSelectedSubcategoryId: (subcategoryId: HospitalOrderSubcategoryId) => void;
  setStatusFilter: (filter: HospitalOrderStatusFilter) => void;
  setWorkTypeFilter: (filter: HospitalOrderWorkTypeFilter) => void;
  toggleOrderSelection: (orderId: string, selected: boolean) => void;
  toggleVisibleOrderSelection: (orderIds: string[], selected: boolean) => void;
  updateOrder: (orderId: string, draft: Partial<HospitalOrderDraft>) => void;
};

const defaultCategoryId = hospitalOrderCategories[0].id;
const defaultSubcategoryId = getDefaultSubcategoryId(defaultCategoryId) ?? "clinical-pathology";

const getNextOrderId = () => `hospital-order-${Date.now().toString(36)}`;

export const useHospitalAdminStore = create<HospitalAdminStore>()((set, get) => ({
  billingFilter: "all",
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
      standardName: `${source.standardName} 복사본`,
    });
  },
  setBillingFilter: (billingFilter) => set({ billingFilter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSelectedCategoryId: (selectedCategoryId) =>
    set({
      selectedCategoryId,
      selectedOrderIds: [],
      selectedSubcategoryId: getDefaultSubcategoryId(selectedCategoryId) ?? defaultSubcategoryId,
    }),
  setSelectedSubcategoryId: (selectedSubcategoryId) =>
    set({ selectedOrderIds: [], selectedSubcategoryId }),
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
