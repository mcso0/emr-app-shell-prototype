export type DocsSectionKey = "product" | "design" | "engineering" | "study";

export interface DocsSection {
  key: DocsSectionKey;
  label: string;
  title: string;
  description: string;
  defaultSlug: string;
}

export const docsSections = [
  {
    key: "product",
    label: "기획",
    title: "Product",
    description: "Product direction, PRD, domain maps, and user-flow sources.",
    defaultSlug: "product-prd",
  },
  {
    key: "design",
    label: "디자인",
    title: "Design",
    description: "Design docs, UX flows, screen references, and design-system entry points.",
    defaultSlug: "design-readme",
  },
  {
    key: "engineering",
    label: "개발",
    title: "Engineering",
    description: "Engineering docs, architecture, data model, verification, and operations entry points.",
    defaultSlug: "engineering-readme",
  },
  {
    key: "study",
    label: "스터디",
    title: "Study",
    description: "승욱과 루멘의 project study notes, curriculum, diagrams, and review questions.",
    defaultSlug: "study-home",
  },
] as const satisfies readonly DocsSection[];

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
  | "User Flows"
  | "Study Plan"
  | "Study Archive"
  | "Study Reference"
  | "Design Start"
  | "Engineering Start";

export interface PrdDocEntry {
  slug: string;
  title: string;
  section: DocsSectionKey;
  group: PrdDocGroup;
  sourcePath: `docs/${string}.md`;
  description?: string;
}

export const defaultPrdDocSlug = "product-prd";

export const prdDocRegistry = [
  {
    slug: "product-readme",
    title: "Product Docs",
    section: "product",
    group: "Start",
    sourcePath: "docs/product/README.md",
    description: "Product docs map and source-of-truth rules.",
  },
  {
    slug: "product-prd",
    title: "Product PRD",
    section: "product",
    group: "Start",
    sourcePath: "docs/product/prd/clair-emr-saas-prd.md",
    description: "Core CLAiR EMR product requirements.",
  },
  {
    slug: "auth-login-onboarding-current-state",
    title: "Auth Login Onboarding Current State",
    section: "product",
    group: "Current State",
    sourcePath: "docs/product/current-state/auth-login-onboarding-current-state.md",
    description: "Current implemented login, invite, signup, workspace creation, and auth-gate inventory.",
  },
  {
    slug: "role-screen-access-current-state",
    title: "Role Screen Access Current State",
    section: "product",
    group: "Current State",
    sourcePath: "docs/product/current-state/role-screen-access-current-state.md",
    description: "Current implemented workspace module list compared against role/permission v1.",
  },
  {
    slug: "saas-operating-map",
    title: "SaaS Operating Map",
    section: "product",
    group: "Service",
    sourcePath: "docs/product/service/clair-emr-saas-operating-map.md",
  },
  {
    slug: "product-mvp-scope",
    title: "Product MVP Scope",
    section: "product",
    group: "Roadmap",
    sourcePath: "docs/product/roadmap/product-mvp-scope.md",
  },
  {
    slug: "outpatient-workflow-state-model",
    title: "Outpatient Workflow State Model",
    section: "product",
    group: "Domain",
    sourcePath: "docs/product/domain/outpatient-workflow-state-model.md",
  },
  {
    slug: "emr-domain-entity-map",
    title: "EMR Domain Entity Map",
    section: "product",
    group: "Domain",
    sourcePath: "docs/product/domain/emr-domain-entity-map.md",
  },
  {
    slug: "role-permission-source-map",
    title: "Role Permission Source Map",
    section: "product",
    group: "Domain",
    sourcePath: "docs/product/domain/role-permission-source-map.md",
  },
  {
    slug: "workspace-auth-permissions",
    title: "Workspace Auth And Permissions",
    section: "product",
    group: "Domain",
    sourcePath: "docs/product/domain/workspace-auth-permissions.md",
  },
  {
    slug: "workspace-hospital-profile",
    title: "Workspace Hospital Profile",
    section: "product",
    group: "Domain",
    sourcePath: "docs/product/domain/workspace-hospital-profile.md",
  },
  {
    slug: "order-fulfillment-handoff",
    title: "Order Fulfillment Handoff",
    section: "product",
    group: "Domain",
    sourcePath: "docs/product/domain/order-fulfillment-handoff.md",
  },
  {
    slug: "workspace-order-catalog-platform",
    title: "Workspace Order Catalog Platform",
    section: "product",
    group: "Domain",
    sourcePath: "docs/product/domain/workspace-order-catalog-platform.md",
  },
  {
    slug: "features-readme",
    title: "Feature Specs",
    section: "product",
    group: "Features",
    sourcePath: "docs/product/features/README.md",
  },
  {
    slug: "login-invite-onboarding-spec",
    title: "Login Invite Onboarding Spec",
    section: "product",
    group: "Features",
    sourcePath: "docs/product/features/auth/login-invite-onboarding-spec.md",
    description: "Product target for login, first admin onboarding, staff invites, and session policy drafts.",
  },
  {
    slug: "reception-appointment-spec",
    title: "Reception Appointment Spec",
    section: "product",
    group: "Features",
    sourcePath: "docs/product/features/reception-appointment-spec.md",
  },
  {
    slug: "legacy-mvp-feature-spec",
    title: "Legacy MVP Feature Spec",
    section: "product",
    group: "Features",
    sourcePath: "docs/product/features/legacy-mvp-feature-spec.md",
  },
  {
    slug: "epics-readme",
    title: "Epics",
    section: "product",
    group: "Epics",
    sourcePath: "docs/product/epics/README.md",
  },
  {
    slug: "user-stories-readme",
    title: "User Stories",
    section: "product",
    group: "User Stories",
    sourcePath: "docs/product/user-stories/README.md",
  },
  {
    slug: "decision-log-index",
    title: "Decision Log Index",
    section: "product",
    group: "Decisions",
    sourcePath: "docs/product/decisions/decision-log-index.md",
  },
  {
    slug: "glossary-readme",
    title: "Glossary",
    section: "product",
    group: "Glossary",
    sourcePath: "docs/product/glossary/README.md",
  },
  {
    slug: "user-flows-readme",
    title: "User Flows",
    section: "product",
    group: "User Flows",
    sourcePath: "docs/product/user-flows/README.md",
  },
  {
    slug: "emr-saas-userflow",
    title: "EMR SaaS User Flow",
    section: "product",
    group: "User Flows",
    sourcePath: "docs/product/user-flows/emr-saas-userflow.md",
  },
  {
    slug: "design-readme",
    title: "Design Docs",
    section: "design",
    group: "Design Start",
    sourcePath: "docs/design/README.md",
    description: "Design docs entry point for flows, screens, assets, design system, and UI QA.",
  },
  {
    slug: "engineering-readme",
    title: "Engineering Docs",
    section: "engineering",
    group: "Engineering Start",
    sourcePath: "docs/engineering/README.md",
    description: "Engineering docs entry point for architecture, data model, auth/security, APIs, and testing.",
  },
  {
    slug: "study-home",
    title: "Study Home",
    section: "study",
    group: "Study Plan",
    sourcePath: "docs/study/README.md",
    description: "Study Center entry point and operating rules.",
  },
  {
    slug: "study-curriculum",
    title: "Study Curriculum",
    section: "study",
    group: "Study Plan",
    sourcePath: "docs/study/curriculum.md",
    description: "Recommended learning path for understanding this EMR SaaS project.",
  },
  {
    slug: "study-emr-domain-basics",
    title: "01. EMR Domain Basics",
    section: "study",
    group: "Study Archive",
    sourcePath: "docs/study/sessions/2026-06-17-01-emr-domain-basics.md",
    description: "First lesson archive covering patient, appointment, encounter, queue entry, and order.",
  },
  {
    slug: "study-glossary",
    title: "Study Glossary",
    section: "study",
    group: "Study Reference",
    sourcePath: "docs/study/glossary.md",
    description: "Non-developer glossary for recurring product, backend, and frontend terms.",
  },
  {
    slug: "study-diagrams",
    title: "Study Diagrams",
    section: "study",
    group: "Study Reference",
    sourcePath: "docs/study/diagrams.md",
    description: "Study-oriented diagrams for workflow, entities, tenancy, and app structure.",
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

export function getDocsSection(sectionKey: string | undefined): DocsSection | undefined {
  return docsSections.find((section) => section.key === sectionKey);
}

export function getDefaultDocForSection(sectionKey: string | undefined): PrdDocEntry {
  const section = getDocsSection(sectionKey) ?? docsSections[0];
  const defaultDoc = getPrdDocBySlug(section.defaultSlug);

  if (!defaultDoc) {
    throw new Error(`Default docs entry is missing from registry: ${section.defaultSlug}`);
  }

  return defaultDoc;
}

export function getPrdDocGroups(sectionKey?: DocsSectionKey) {
  const groups = new Map<PrdDocGroup, PrdDocEntry[]>();

  for (const doc of prdDocRegistry.filter((entry) => !sectionKey || entry.section === sectionKey)) {
    const entries = groups.get(doc.group) ?? [];
    entries.push(doc);
    groups.set(doc.group, entries);
  }

  return Array.from(groups.entries()).map(([group, docs]) => ({ group, docs }));
}
