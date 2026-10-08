export function getChartOrderDraftInFlightSave(
  orderDraftSavePromiseRef: { current: Promise<boolean> | null },
  orderDraftSaveInFlightRef: { current: boolean },
): Promise<boolean> | null {
  const inFlightSave = orderDraftSavePromiseRef.current;
  if (inFlightSave) return inFlightSave;
  if (orderDraftSaveInFlightRef.current) return Promise.resolve(false);
  return null;
}

export function registerChartOrderDraftSaveOperation(
  operation: Promise<boolean>,
  orderDraftSavePromiseRef: { current: Promise<boolean> | null },
  orderDraftSaveInFlightRef: { current: boolean },
): Promise<boolean> {
  orderDraftSavePromiseRef.current = operation;
  const clearInFlightSave = () => {
    if (orderDraftSavePromiseRef.current === operation) {
      orderDraftSavePromiseRef.current = null;
    }
    orderDraftSaveInFlightRef.current = false;
  };
  void operation.then(clearInFlightSave, clearInFlightSave);
  return operation;
}
