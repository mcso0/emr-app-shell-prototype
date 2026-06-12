export type PrdDocGroup =
  | "Start"
  | "Current State"
  | "Service"
  | "Roadmap"
  | "Domain"
  | "Features"
  | "Epics"
  | "User Stories"
  | "Decisions"
  | "Glossary"
  | "User Flows";

export type ClairDocType =
  | "PRD"
  | "Current State"
  | "Service"
  | "Roadmap"
  | "Domain"
  | "Feature"
  | "Epic"
  | "User Story"
  | "Decision"
  | "Glossary"
  | "User Flow";

export interface PrdDocEntry {
  slug: string;
  title: string;
  group: PrdDocGroup;
  docType: ClairDocType;
  sourcePath: `docs/product/${string}.md`;
  description?: string;
  tags?: readonly string[];
}

export const defaultPrdDocSlug = "product-prd";

export const prdDocRegistry = [
  {
    slug: "product-readme",
    title: "Product Docs",
    group: "Start",
    docType: "PRD",
    sourcePath: "docs/product/README.md",
    description: "Product docs map and source-of-truth rules.",
    tags: ["source of truth", "reader"],
  },
  {
    slug: "product-prd",
    title: "Product PRD",
    group: "Start",
    docType: "PRD",
    sourcePath: "docs/product/prd/clair-emr-saas-prd.md",
    description: "Core CLAiR EMR product requirements.",
    tags: ["mvp", "requirements"],
  },
  {
    slug: "auth-login-onboarding-current-state",
    title: "Auth Login Onboarding Current State",
    group: "Current State",
    docType: "Current State",
    sourcePath: "docs/product/current-state/auth-login-onboarding-current-state.md",
    description: "Current implemented login, invite, signup, workspace creation, and auth-gate inventory.",
    tags: ["auth", "current state"],
  },
  {
    slug: "role-screen-access-current-state",
    title: "Role Screen Access Current State",
    group: "Current State",
    docType: "Current State",
    sourcePath: "docs/product/current-state/role-screen-access-current-state.md",
    description: "Current implemented workspace module list compared against role/permission v1.",
    tags: ["roles", "current state"],
  },
  {
    slug: "auth-current-implementation-gap-review",
    title: "Auth Current Implementation Gap Review",
    group: "Current State",
    docType: "Current State",
    sourcePath: "docs/product/current-state/auth-current-implementation-gap-review.md",
    description: "Current auth, workspace, invite, member, and permission gaps against product planning docs.",
    tags: ["auth", "current state"],
  },
  {
    slug: "saas-operating-map",
    title: "SaaS Operating Map",
    group: "Service",
    docType: "Service",
    sourcePath: "docs/product/service/clair-emr-saas-operating-map.md",
    description: "Service boundaries, operating model, and product shape.",
    tags: ["service", "boundaries"],
  },
  {
    slug: "product-mvp-scope",
    title: "Product MVP Scope",
    group: "Roadmap",
    docType: "Roadmap",
    sourcePath: "docs/product/roadmap/product-mvp-scope.md",
    description: "MVP scope, non-goals, and product sequencing.",
    tags: ["mvp", "scope"],
  },
  {
    slug: "outpatient-workflow-state-model",
    title: "Outpatient Workflow State Model",
    group: "Domain",
    docType: "Domain",
    sourcePath: "docs/product/domain/outpatient-workflow-state-model.md",
    description: "State model for reception through billing.",
    tags: ["outpatient", "workflow"],
  },
  {
    slug: "emr-domain-entity-map",
    title: "EMR Domain Entity Map",
    group: "Domain",
    docType: "Domain",
    sourcePath: "docs/product/domain/emr-domain-entity-map.md",
    description: "Core EMR domain entities and relationships.",
    tags: ["entities", "domain"],
  },
  {
    slug: "role-permission-source-map",
    title: "Role Permission Source Map",
    group: "Domain",
    docType: "Domain",
    sourcePath: "docs/product/domain/role-permission-source-map.md",
    description: "Product-facing role and permission source map.",
    tags: ["roles", "permissions"],
  },
  {
    slug: "workspace-auth-permissions",
    title: "Workspace Auth And Permissions",
    group: "Domain",
    docType: "Domain",
    sourcePath: "docs/product/domain/workspace-auth-permissions.md",
    description: "Workspace auth and permission product requirements.",
    tags: ["workspace", "auth"],
  },
  {
    slug: "workspace-hospital-profile",
    title: "Workspace Hospital Profile",
    group: "Domain",
    docType: "Domain",
    sourcePath: "docs/product/domain/workspace-hospital-profile.md",
    description: "Workspace-owned hospital profile and basic settings requirements.",
    tags: ["hospital", "workspace"],
  },
  {
    slug: "order-fulfillment-handoff",
    title: "Order Fulfillment Handoff",
    group: "Domain",
    docType: "Domain",
    sourcePath: "docs/product/domain/order-fulfillment-handoff.md",
    description: "Product handoff from chart orders to fulfillment queues.",
    tags: ["orders", "fulfillment"],
  },
  {
    slug: "workspace-order-catalog-platform",
    title: "Workspace Order Catalog Platform",
    group: "Domain",
    docType: "Domain",
    sourcePath: "docs/product/domain/workspace-order-catalog-platform.md",
    description: "Workspace order catalog platform requirements.",
    tags: ["catalog", "workspace"],
  },
  {
    slug: "features-readme",
    title: "Feature Specs",
    group: "Features",
    docType: "Feature",
    sourcePath: "docs/product/features/README.md",
    description: "Feature spec index and writing rules.",
    tags: ["features", "template"],
  },
  {
    slug: "invite-email-delivery-recovery-policy-spec",
    title: "Invite Email Delivery Recovery Policy Spec",
    group: "Features",
    docType: "Feature",
    sourcePath: "docs/product/features/auth/invite-email-delivery-recovery-policy-spec.md",
    description:
      "Product target for invite email delivery expectations, link lifecycle, resend, cancellation, and recovery states.",
    tags: ["auth", "invites"],
  },
  {
    slug: "clair-internal-operator-recovery-audit-policy-spec",
    title: "CLAiR Internal Operator Recovery Audit Policy Spec",
    group: "Features",
    docType: "Feature",
    sourcePath: "docs/product/features/auth/clair-internal-operator-recovery-audit-policy-spec.md",
    description: "Product policy for CLAiR-side support recovery actions, operator boundaries, and audit trail.",
    tags: ["auth", "operator"],
  },
  {
    slug: "password-reset-account-recovery-policy-spec",
    title: "Password Reset Account Recovery Policy Spec",
    group: "Features",
    docType: "Feature",
    sourcePath: "docs/product/features/auth/password-reset-account-recovery-policy-spec.md",
    description: "Product policy for password reset, account recovery, and workspace access checks after recovery.",
    tags: ["auth", "recovery"],
  },
  {
    slug: "auth-error-empty-state-ux-spec",
    title: "Auth Error Empty State UX Spec",
    group: "Features",
    docType: "Feature",
    sourcePath: "docs/product/features/auth/auth-error-empty-state-ux-spec.md",
    description: "UX policy for login, invite, session, membership, permission, and auth empty states.",
    tags: ["auth", "ux"],
  },
  {
    slug: "workspace-access-guard-policy-spec",
    title: "Workspace Access Guard Policy Spec",
    group: "Features",
    docType: "Feature",
    sourcePath: "docs/product/features/auth/workspace-access-guard-policy-spec.md",
    description: "Product policy for workspace route entry checks, membership gates, permissions, and safe redirects.",
    tags: ["auth", "workspace"],
  },
  {
    slug: "role-permission-detail-spec",
    title: "Role Permission Detail Spec",
    group: "Features",
    docType: "Feature",
    sourcePath: "docs/product/features/auth/role-permission-detail-spec.md",
    description: "Action-level product permission groups for canonical CLAiR EMR MVP roles.",
    tags: ["roles", "permissions"],
  },
  {
    slug: "hospital-admin-member-management-ux-spec",
    title: "Hospital Admin Member Management UX Spec",
    group: "Features",
    docType: "Feature",
    sourcePath: "docs/product/features/auth/hospital-admin-member-management-ux-spec.md",
    description: "UX target for hospital-admin member list, invites, role editing, deactivation, and last-admin safety.",
    tags: ["hospital admin", "members"],
  },
  {
    slug: "login-invite-onboarding-spec",
    title: "Login Invite Onboarding Spec",
    group: "Features",
    docType: "Feature",
    sourcePath: "docs/product/features/auth/login-invite-onboarding-spec.md",
    description: "Product target for login, first admin onboarding, staff invites, and session policy drafts.",
    tags: ["auth", "onboarding"],
  },
  {
    slug: "member-role-management-spec",
    title: "Member Role Management Spec",
    group: "Features",
    docType: "Feature",
    sourcePath: "docs/product/features/auth/member-role-management-spec.md",
    description:
      "Product target for staff invitations, role changes, membership status, and last-admin protection.",
    tags: ["auth", "roles"],
  },
  {
    slug: "session-logout-policy-spec",
    title: "Session Logout Policy Spec",
    group: "Features",
    docType: "Feature",
    sourcePath: "docs/product/features/auth/session-logout-policy-spec.md",
    description:
      "Product target for session persistence, logout, expiry, shared-device risk, and recent-auth requirements.",
    tags: ["auth", "session"],
  },
  {
    slug: "hospital-profile-onboarding-spec",
    title: "Hospital Profile Onboarding Spec",
    group: "Features",
    docType: "Feature",
    sourcePath: "docs/product/features/hospital-admin/hospital-profile-onboarding-spec.md",
    description: "Product target for first hospital admin profile confirmation and hospital basic settings.",
    tags: ["hospital admin", "onboarding"],
  },
  {
    slug: "reception-appointment-spec",
    title: "Reception Appointment Spec",
    group: "Features",
    docType: "Feature",
    sourcePath: "docs/product/features/reception-appointment-spec.md",
    description: "Reception and appointment product behavior.",
    tags: ["reception", "appointments"],
  },
  {
    slug: "legacy-mvp-feature-spec",
    title: "Legacy MVP Feature Spec",
    group: "Features",
    docType: "Feature",
    sourcePath: "docs/product/features/legacy-mvp-feature-spec.md",
    description: "Legacy all-in-one MVP feature reference.",
    tags: ["legacy", "mvp"],
  },
  {
    slug: "epics-readme",
    title: "Epics",
    group: "Epics",
    docType: "Epic",
    sourcePath: "docs/product/epics/README.md",
    description: "Epic index and planning rules.",
    tags: ["epics", "template"],
  },
  {
    slug: "user-stories-readme",
    title: "User Stories",
    group: "User Stories",
    docType: "User Story",
    sourcePath: "docs/product/user-stories/README.md",
    description: "User story index and acceptance criteria rules.",
    tags: ["stories", "template"],
  },
  {
    slug: "decision-log-index",
    title: "Decision Log Index",
    group: "Decisions",
    docType: "Decision",
    sourcePath: "docs/product/decisions/decision-log-index.md",
    description: "Current product decision index.",
    tags: ["decisions", "history"],
  },
  {
    slug: "glossary-readme",
    title: "Glossary",
    group: "Glossary",
    docType: "Glossary",
    sourcePath: "docs/product/glossary/README.md",
    description: "Shared product and domain terms.",
    tags: ["terms", "language"],
  },
  {
    slug: "user-flows-readme",
    title: "User Flows",
    group: "User Flows",
    docType: "User Flow",
    sourcePath: "docs/product/user-flows/README.md",
    description: "User flow index and artifacts.",
    tags: ["flows", "ux"],
  },
  {
    slug: "emr-saas-userflow",
    title: "EMR SaaS User Flow",
    group: "User Flows",
    docType: "User Flow",
    sourcePath: "docs/product/user-flows/emr-saas-userflow.md",
    description: "Product-level EMR SaaS workflow diagram.",
    tags: ["flows", "saas"],
  },
] as const satisfies readonly PrdDocEntry[];

export type PrdDocSlug = (typeof prdDocRegistry)[number]["slug"];

export function getPrdDocBySlug(slug: string | undefined): PrdDocEntry | undefined {
  return prdDocRegistry.find((doc) => doc.slug === slug);
}

export function getDefaultPrdDoc(): PrdDocEntry {
  const defaultDoc = getPrdDocBySlug(defaultPrdDocSlug);

  if (!defaultDoc) {
    throw new Error(`Default PRD doc is missing from registry: ${defaultPrdDocSlug}`);
  }

  return defaultDoc;
}

export function getPrdDocGroups() {
  const groups = new Map<PrdDocGroup, PrdDocEntry[]>();

  for (const doc of prdDocRegistry) {
    const entries = groups.get(doc.group) ?? [];
    entries.push(doc);
    groups.set(doc.group, entries);
  }

  return Array.from(groups.entries()).map(([group, docs]) => ({ group, docs }));
}
