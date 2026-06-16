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

export interface PrdDocEntry {
  slug: string;
  title: string;
  group: PrdDocGroup;
  sourcePath: `docs/product/${string}.md`;
  description?: string;
}

export const defaultPrdDocSlug = "product-prd";

export const prdDocRegistry = [
  {
    slug: "product-readme",
    title: "Product Docs",
    group: "Start",
    sourcePath: "docs/product/README.md",
    description: "Product docs map and source-of-truth rules.",
  },
  {
    slug: "product-prd",
    title: "Product PRD",
    group: "Start",
    sourcePath: "docs/product/prd/clair-emr-saas-prd.md",
    description: "Core CLAiR EMR product requirements.",
  },
  {
    slug: "auth-login-onboarding-current-state",
    title: "Auth Login Onboarding Current State",
    group: "Current State",
    sourcePath: "docs/product/current-state/auth-login-onboarding-current-state.md",
    description: "Current implemented login, invite, signup, workspace creation, and auth-gate inventory.",
  },
  {
    slug: "role-screen-access-current-state",
    title: "Role Screen Access Current State",
    group: "Current State",
    sourcePath: "docs/product/current-state/role-screen-access-current-state.md",
    description: "Current implemented workspace module list compared against role/permission v1.",
  },
  {
    slug: "saas-operating-map",
    title: "SaaS Operating Map",
    group: "Service",
    sourcePath: "docs/product/service/clair-emr-saas-operating-map.md",
  },
  {
    slug: "product-mvp-scope",
    title: "Product MVP Scope",
    group: "Roadmap",
    sourcePath: "docs/product/roadmap/product-mvp-scope.md",
  },
  {
    slug: "outpatient-workflow-state-model",
    title: "Outpatient Workflow State Model",
    group: "Domain",
    sourcePath: "docs/product/domain/outpatient-workflow-state-model.md",
  },
  {
    slug: "emr-domain-entity-map",
    title: "EMR Domain Entity Map",
    group: "Domain",
    sourcePath: "docs/product/domain/emr-domain-entity-map.md",
  },
  {
    slug: "role-permission-source-map",
    title: "Role Permission Source Map",
    group: "Domain",
    sourcePath: "docs/product/domain/role-permission-source-map.md",
  },
  {
    slug: "workspace-auth-permissions",
    title: "Workspace Auth And Permissions",
    group: "Domain",
    sourcePath: "docs/product/domain/workspace-auth-permissions.md",
  },
  {
    slug: "workspace-hospital-profile",
    title: "Workspace Hospital Profile",
    group: "Domain",
    sourcePath: "docs/product/domain/workspace-hospital-profile.md",
  },
  {
    slug: "order-fulfillment-handoff",
    title: "Order Fulfillment Handoff",
    group: "Domain",
    sourcePath: "docs/product/domain/order-fulfillment-handoff.md",
  },
  {
    slug: "workspace-order-catalog-platform",
    title: "Workspace Order Catalog Platform",
    group: "Domain",
    sourcePath: "docs/product/domain/workspace-order-catalog-platform.md",
  },
  {
    slug: "features-readme",
    title: "Feature Specs",
    group: "Features",
    sourcePath: "docs/product/features/README.md",
  },
  {
    slug: "login-invite-onboarding-spec",
    title: "Login Invite Onboarding Spec",
    group: "Features",
    sourcePath: "docs/product/features/auth/login-invite-onboarding-spec.md",
    description: "Product target for login, first admin onboarding, staff invites, and session policy drafts.",
  },
  {
    slug: "reception-appointment-spec",
    title: "Reception Appointment Spec",
    group: "Features",
    sourcePath: "docs/product/features/reception-appointment-spec.md",
  },
  {
    slug: "legacy-mvp-feature-spec",
    title: "Legacy MVP Feature Spec",
    group: "Features",
    sourcePath: "docs/product/features/legacy-mvp-feature-spec.md",
  },
  {
    slug: "epics-readme",
    title: "Epics",
    group: "Epics",
    sourcePath: "docs/product/epics/README.md",
  },
  {
    slug: "user-stories-readme",
    title: "User Stories",
    group: "User Stories",
    sourcePath: "docs/product/user-stories/README.md",
  },
  {
    slug: "decision-log-index",
    title: "Decision Log Index",
    group: "Decisions",
    sourcePath: "docs/product/decisions/decision-log-index.md",
  },
  {
    slug: "glossary-readme",
    title: "Glossary",
    group: "Glossary",
    sourcePath: "docs/product/glossary/README.md",
  },
  {
    slug: "user-flows-readme",
    title: "User Flows",
    group: "User Flows",
    sourcePath: "docs/product/user-flows/README.md",
  },
  {
    slug: "emr-saas-userflow",
    title: "EMR SaaS User Flow",
    group: "User Flows",
    sourcePath: "docs/product/user-flows/emr-saas-userflow.md",
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
