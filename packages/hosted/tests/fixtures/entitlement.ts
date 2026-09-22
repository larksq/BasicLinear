import type { BillingSeatReconciler, WorkspaceMutationEntitlementPolicy } from '../../src/index.js';

export const proEntitlementPolicyForTests: WorkspaceMutationEntitlementPolicy = {
  async assertMutation() { return 'paid_pro'; },
};

export const noopBillingSeatReconcilerForTests: BillingSeatReconciler = {
  async reconcileWorkspaceSeats() {},
};
