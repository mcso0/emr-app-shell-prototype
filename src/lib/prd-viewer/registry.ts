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

export type ClairDocsArea = "planning" | "design" | "development";

export type ClairDocsAudience = "internal_default" | "internal_review" | "restricted";

export type ClairDocsExposure = "default_tab" | "index_only" | "approval_required" | "excluded";

export type ClairDocsSensitivity =
  | "none"
  | "auth_product"
  | "auth_security"
  | "db_rls"
  | "operations"
  | "launch"
  | "completed_evidence";

export type ClairDocsSourceOfTruth =
  | "canonical"
  | "evidence"
  | "historical"
  | "deprecated"
  | "compatibility_stub";

export type ClairDocsSourceRoot = "product" | "design" | "engineering";

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
  | "User Flow"
  | "Design"
  | "UX Flow"
  | "Screen"
  | "UI QA"
  | "Engineering"
  | "Architecture"
  | "API"
  | "Testing";

export interface PrdDocEntry {
  slug: string;
  title: string;
  area: ClairDocsArea;
  group: PrdDocGroup;
  section: string;
  order: number;
  docType: ClairDocType;
  sourcePath: `docs/${ClairDocsSourceRoot}/${string}.md`;
  audience: ClairDocsAudience;
  exposure: ClairDocsExposure;
  sensitivity: ClairDocsSensitivity;
  sourceOfTruth: ClairDocsSourceOfTruth;
  description?: string;
  tags?: readonly string[];
}

export const defaultPrdDocSlug = "product-prd";

export const defaultDocSlugByArea = {
  planning: "product-prd",
  design: "design-readme",
  development: "engineering-readme",
} as const satisfies Record<ClairDocsArea, string>;

export const clairDocsAreas = [
  { area: "planning", label: "기획" },
  { area: "design", label: "디자인" },
  { area: "development", label: "개발" },
] as const satisfies Array<{ area: ClairDocsArea; label: string }>;

const defaultReaderMetadata = {
  audience: "internal_default",
  exposure: "default_tab",
  sensitivity: "none",
  sourceOfTruth: "canonical",
} as const satisfies Pick<PrdDocEntry, "audience" | "exposure" | "sensitivity" | "sourceOfTruth">;

function defineDoc(
  entry: Omit<PrdDocEntry, "audience" | "exposure" | "sensitivity" | "sourceOfTruth"> &
    Partial<Pick<PrdDocEntry, "audience" | "exposure" | "sensitivity" | "sourceOfTruth">>
): PrdDocEntry {
  return {
    ...defaultReaderMetadata,
    ...entry,
  };
}

export const prdDocRegistry = [
  defineDoc({
    slug: "product-readme",
    title: "Product Docs",
    area: "planning",
    group: "Start",
    section: "시작",
    order: 10,
    docType: "PRD",
    sourcePath: "docs/product/README.md",
    description: "Product docs map and source-of-truth rules.",
    tags: ["source of truth", "reader"],
  }),
  defineDoc({
    slug: "product-prd",
    title: "Product PRD",
    area: "planning",
    group: "Start",
    section: "시작",
    order: 20,
    docType: "PRD",
    sourcePath: "docs/product/prd/clair-emr-saas-prd.md",
    description: "Core CLAiR EMR product requirements.",
    tags: ["mvp", "requirements"],
  }),
  defineDoc({
    slug: "auth-login-onboarding-current-state",
    title: "Auth Login Onboarding Current State",
    area: "planning",
    group: "Current State",
    section: "현재 구현 상태",
    order: 10,
    docType: "Current State",
    sourcePath: "docs/product/current-state/auth-login-onboarding-current-state.md",
    description: "Current implemented login, invite, signup, workspace creation, and auth-gate inventory.",
    tags: ["auth", "current state"],
  }),
  defineDoc({
    slug: "role-screen-access-current-state",
    title: "Role Screen Access Current State",
    area: "planning",
    group: "Current State",
    section: "현재 구현 상태",
    order: 20,
    docType: "Current State",
    sourcePath: "docs/product/current-state/role-screen-access-current-state.md",
    description: "Current implemented workspace module list compared against role/permission v1.",
    tags: ["roles", "current state"],
  }),
  defineDoc({
    slug: "auth-current-implementation-gap-review",
    title: "Auth Current Implementation Gap Review",
    area: "planning",
    group: "Current State",
    section: "현재 구현 상태",
    order: 30,
    docType: "Current State",
    sourcePath: "docs/product/current-state/auth-current-implementation-gap-review.md",
    description: "Current auth, workspace, invite, member, and permission gaps against product planning docs.",
    tags: ["auth", "current state"],
  }),
  defineDoc({
    slug: "reception-appointment-current-state",
    title: "Reception Appointment Current State",
    area: "planning",
    group: "Current State",
    section: "현재 구현 상태",
    order: 40,
    docType: "Current State",
    sourcePath: "docs/product/current-state/reception-appointment-current-state.md",
    description: "Implemented reception and appointment screen, route, and workflow inventory.",
    tags: ["reception", "appointments", "current state"],
  }),
  defineDoc({
    slug: "saas-operating-map",
    title: "SaaS Operating Map",
    area: "planning",
    group: "Service",
    section: "서비스",
    order: 10,
    docType: "Service",
    sourcePath: "docs/product/service/clair-emr-saas-operating-map.md",
    description: "Service boundaries, operating model, and product shape.",
    tags: ["service", "boundaries"],
  }),
  defineDoc({
    slug: "product-mvp-scope",
    title: "Product MVP Scope",
    area: "planning",
    group: "Roadmap",
    section: "로드맵",
    order: 10,
    docType: "Roadmap",
    sourcePath: "docs/product/roadmap/product-mvp-scope.md",
    description: "MVP scope, non-goals, and product sequencing.",
    tags: ["mvp", "scope"],
  }),
  defineDoc({
    slug: "outpatient-workflow-state-model",
    title: "Outpatient Workflow State Model",
    area: "planning",
    group: "Domain",
    section: "도메인",
    order: 10,
    docType: "Domain",
    sourcePath: "docs/product/domain/outpatient-workflow-state-model.md",
    description: "State model for reception through billing.",
    tags: ["outpatient", "workflow"],
  }),
  defineDoc({
    slug: "emr-domain-entity-map",
    title: "EMR Domain Entity Map",
    area: "planning",
    group: "Domain",
    section: "도메인",
    order: 20,
    docType: "Domain",
    sourcePath: "docs/product/domain/emr-domain-entity-map.md",
    description: "Core EMR domain entities and relationships.",
    tags: ["entities", "domain"],
  }),
  defineDoc({
    slug: "role-permission-source-map",
    title: "Role Permission Source Map",
    area: "planning",
    group: "Domain",
    section: "도메인",
    order: 30,
    docType: "Domain",
    sourcePath: "docs/product/domain/role-permission-source-map.md",
    description: "Product-facing role and permission source map.",
    tags: ["roles", "permissions"],
  }),
  defineDoc({
    slug: "workspace-auth-permissions",
    title: "Workspace Auth And Permissions",
    area: "planning",
    group: "Domain",
    section: "도메인",
    order: 40,
    docType: "Domain",
    sourcePath: "docs/product/domain/workspace-auth-permissions.md",
    description: "Workspace auth and permission product requirements.",
    tags: ["workspace", "auth"],
  }),
  defineDoc({
    slug: "workspace-hospital-profile",
    title: "Workspace Hospital Profile",
    area: "planning",
    group: "Domain",
    section: "도메인",
    order: 50,
    docType: "Domain",
    sourcePath: "docs/product/domain/workspace-hospital-profile.md",
    description: "Workspace-owned hospital profile and basic settings requirements.",
    tags: ["hospital", "workspace"],
  }),
  defineDoc({
    slug: "order-fulfillment-handoff",
    title: "Order Fulfillment Handoff",
    area: "planning",
    group: "Domain",
    section: "도메인",
    order: 60,
    docType: "Domain",
    sourcePath: "docs/product/domain/order-fulfillment-handoff.md",
    description: "Product handoff from chart orders to fulfillment queues.",
    tags: ["orders", "fulfillment"],
  }),
  defineDoc({
    slug: "workspace-order-catalog-platform",
    title: "Workspace Order Catalog Platform",
    area: "planning",
    group: "Domain",
    section: "도메인",
    order: 70,
    docType: "Domain",
    sourcePath: "docs/product/domain/workspace-order-catalog-platform.md",
    description: "Workspace order catalog platform requirements.",
    tags: ["catalog", "workspace"],
  }),
  defineDoc({
    slug: "features-readme",
    title: "Feature Specs",
    area: "planning",
    group: "Features",
    section: "기능명세",
    order: 10,
    docType: "Feature",
    sourcePath: "docs/product/features/README.md",
    description: "Feature spec index and writing rules.",
    tags: ["features", "template"],
  }),
  defineDoc({
    slug: "auth-foundation-planning-index",
    title: "Auth Foundation Planning Index",
    area: "planning",
    group: "Features",
    section: "기능명세",
    order: 20,
    docType: "Feature",
    sourcePath: "docs/product/features/auth/README.md",
    description: "Auth planning map for account, workspace entry, access permission, and member-management foundations.",
    tags: ["auth", "planning"],
  }),
  defineDoc({
    slug: "invite-email-delivery-recovery-policy-spec",
    title: "Invite Email Delivery Recovery Policy Spec",
    area: "planning",
    group: "Features",
    section: "기능명세",
    order: 30,
    docType: "Feature",
    sourcePath: "docs/product/features/auth/invite-email-delivery-recovery-policy-spec.md",
    description:
      "Product target for invite email delivery expectations, link lifecycle, resend, cancellation, and recovery states.",
    tags: ["auth", "invites"],
  }),
  defineDoc({
    slug: "clair-internal-operator-recovery-audit-policy-spec",
    title: "CLAiR Internal Operator Recovery Audit Policy Spec",
    area: "planning",
    group: "Features",
    section: "기능명세",
    order: 40,
    docType: "Feature",
    sourcePath: "docs/product/features/auth/clair-internal-operator-recovery-audit-policy-spec.md",
    description: "Product policy for CLAiR-side support recovery actions, operator boundaries, and audit trail.",
    tags: ["auth", "operator"],
  }),
  defineDoc({
    slug: "password-reset-account-recovery-policy-spec",
    title: "Password Reset Account Recovery Policy Spec",
    area: "planning",
    group: "Features",
    section: "기능명세",
    order: 50,
    docType: "Feature",
    sourcePath: "docs/product/features/auth/password-reset-account-recovery-policy-spec.md",
    description: "Product policy for password reset, account recovery, and workspace access checks after recovery.",
    tags: ["auth", "recovery"],
  }),
  defineDoc({
    slug: "auth-error-empty-state-ux-spec",
    title: "Auth Error Empty State UX Spec",
    area: "planning",
    group: "Features",
    section: "기능명세",
    order: 60,
    docType: "Feature",
    sourcePath: "docs/product/features/auth/auth-error-empty-state-ux-spec.md",
    description: "UX policy for login, invite, session, membership, permission, and auth empty states.",
    tags: ["auth", "ux"],
  }),
  defineDoc({
    slug: "workspace-access-guard-policy-spec",
    title: "Workspace Access Guard Policy Spec",
    area: "planning",
    group: "Features",
    section: "기능명세",
    order: 70,
    docType: "Feature",
    sourcePath: "docs/product/features/auth/workspace-access-guard-policy-spec.md",
    description: "Product policy for workspace route entry checks, membership gates, permissions, and safe redirects.",
    tags: ["auth", "workspace"],
  }),
  defineDoc({
    slug: "role-permission-detail-spec",
    title: "Role Permission Detail Spec",
    area: "planning",
    group: "Features",
    section: "기능명세",
    order: 80,
    docType: "Feature",
    sourcePath: "docs/product/features/auth/role-permission-detail-spec.md",
    description: "Action-level product permission groups for canonical CLAiR EMR MVP roles.",
    tags: ["roles", "permissions"],
  }),
  defineDoc({
    slug: "hospital-admin-member-management-ux-spec",
    title: "Hospital Admin Member Management UX Spec",
    area: "planning",
    group: "Features",
    section: "기능명세",
    order: 90,
    docType: "Feature",
    sourcePath: "docs/product/features/auth/hospital-admin-member-management-ux-spec.md",
    description: "UX target for hospital-admin member list, invites, role editing, deactivation, and last-admin safety.",
    tags: ["hospital admin", "members"],
  }),
  defineDoc({
    slug: "login-invite-onboarding-spec",
    title: "Login Invite Onboarding Spec",
    area: "planning",
    group: "Features",
    section: "기능명세",
    order: 100,
    docType: "Feature",
    sourcePath: "docs/product/features/auth/login-invite-onboarding-spec.md",
    description: "Product target for login, first admin onboarding, staff invites, and session policy drafts.",
    tags: ["auth", "onboarding"],
  }),
  defineDoc({
    slug: "member-role-management-spec",
    title: "Member Role Management Spec",
    area: "planning",
    group: "Features",
    section: "기능명세",
    order: 110,
    docType: "Feature",
    sourcePath: "docs/product/features/auth/member-role-management-spec.md",
    description:
      "Product target for staff invitations, role changes, membership status, and last-admin protection.",
    tags: ["auth", "roles"],
  }),
  defineDoc({
    slug: "session-logout-policy-spec",
    title: "Session Logout Policy Spec",
    area: "planning",
    group: "Features",
    section: "기능명세",
    order: 120,
    docType: "Feature",
    sourcePath: "docs/product/features/auth/session-logout-policy-spec.md",
    description:
      "Product target for session persistence, logout, expiry, shared-device risk, and recent-auth requirements.",
    tags: ["auth", "session"],
  }),
  defineDoc({
    slug: "hospital-profile-onboarding-spec",
    title: "Hospital Profile Onboarding Spec",
    area: "planning",
    group: "Features",
    section: "기능명세",
    order: 130,
    docType: "Feature",
    sourcePath: "docs/product/features/hospital-admin/hospital-profile-onboarding-spec.md",
    description: "Product target for first hospital admin profile confirmation and hospital basic settings.",
    tags: ["hospital admin", "onboarding"],
  }),
  defineDoc({
    slug: "reception-appointment-spec",
    title: "Reception Appointment Spec",
    area: "planning",
    group: "Features",
    section: "기능명세",
    order: 140,
    docType: "Feature",
    sourcePath: "docs/product/features/reception-appointment-spec.md",
    description: "Reception and appointment product behavior.",
    tags: ["reception", "appointments"],
  }),
  defineDoc({
    slug: "legacy-mvp-feature-spec",
    title: "Legacy MVP Feature Spec",
    area: "planning",
    group: "Features",
    section: "기능명세",
    order: 150,
    docType: "Feature",
    sourcePath: "docs/product/features/legacy-mvp-feature-spec.md",
    description: "Legacy all-in-one MVP feature reference.",
    tags: ["legacy", "mvp"],
  }),
  defineDoc({
    slug: "epics-readme",
    title: "Epics",
    area: "planning",
    group: "Epics",
    section: "에픽",
    order: 10,
    docType: "Epic",
    sourcePath: "docs/product/epics/README.md",
    description: "Epic index and planning rules.",
    tags: ["epics", "template"],
  }),
  defineDoc({
    slug: "user-stories-readme",
    title: "User Stories",
    area: "planning",
    group: "User Stories",
    section: "유저 스토리",
    order: 10,
    docType: "User Story",
    sourcePath: "docs/product/user-stories/README.md",
    description: "User story index and acceptance criteria rules.",
    tags: ["stories", "template"],
  }),
  defineDoc({
    slug: "decision-log-index",
    title: "Decision Log Index",
    area: "planning",
    group: "Decisions",
    section: "결정",
    order: 10,
    docType: "Decision",
    sourcePath: "docs/product/decisions/decision-log-index.md",
    description: "Current product decision index.",
    tags: ["decisions", "history"],
  }),
  defineDoc({
    slug: "glossary-readme",
    title: "Glossary",
    area: "planning",
    group: "Glossary",
    section: "글로서리",
    order: 10,
    docType: "Glossary",
    sourcePath: "docs/product/glossary/README.md",
    description: "Shared product and domain terms.",
    tags: ["terms", "language"],
  }),
  defineDoc({
    slug: "user-flows-readme",
    title: "User Flows",
    area: "planning",
    group: "User Flows",
    section: "유저 플로우",
    order: 10,
    docType: "User Flow",
    sourcePath: "docs/product/user-flows/README.md",
    description: "User flow index and artifacts.",
    tags: ["flows", "ux"],
  }),
  defineDoc({
    slug: "emr-saas-userflow",
    title: "EMR SaaS User Flow",
    area: "planning",
    group: "User Flows",
    section: "유저 플로우",
    order: 20,
    docType: "User Flow",
    sourcePath: "docs/product/user-flows/emr-saas-userflow.md",
    description: "Product-level EMR SaaS workflow diagram.",
    tags: ["flows", "saas"],
  }),
  defineDoc({
    slug: "design-readme",
    title: "Design Docs",
    area: "design",
    group: "Start",
    section: "시작",
    order: 10,
    docType: "Design",
    sourcePath: "docs/design/README.md",
    description: "Design docs map and boundaries.",
    tags: ["design", "reader"],
  }),
  defineDoc({
    slug: "design-system",
    title: "Design System",
    area: "design",
    group: "Features",
    section: "디자인 시스템",
    order: 10,
    docType: "Design",
    sourcePath: "docs/design/system/DESIGN.md",
    description: "Reusable CLAiR EMR UI foundations, tokens, and component conventions.",
    tags: ["design system", "tokens"],
  }),
  defineDoc({
    slug: "reference-screen-index",
    title: "Reference Screen Index",
    area: "design",
    group: "Features",
    section: "화면 기준",
    order: 10,
    docType: "Screen",
    sourcePath: "docs/design/reference-screen-index.md",
    description: "Checked reference screen inventory.",
    tags: ["screens", "references"],
  }),
  defineDoc({
    slug: "design-flows-readme",
    title: "Design Flows",
    area: "design",
    group: "User Flows",
    section: "UX Flow",
    order: 10,
    docType: "UX Flow",
    sourcePath: "docs/design/flows/README.md",
    description: "Design flow index.",
    tags: ["ux", "flows"],
  }),
  defineDoc({
    slug: "reception-appointment-flow",
    title: "Reception Appointment Flow",
    area: "design",
    group: "User Flows",
    section: "UX Flow",
    order: 20,
    docType: "UX Flow",
    sourcePath: "docs/design/ux-flows/reception-appointment-flow.md",
    description: "Reception and appointment UX flow.",
    tags: ["reception", "appointments", "ux"],
  }),
  defineDoc({
    slug: "design-screens-readme",
    title: "Screen Docs",
    area: "design",
    group: "Features",
    section: "화면 기준",
    order: 20,
    docType: "Screen",
    sourcePath: "docs/design/screens/README.md",
    description: "Screen-level layout and interaction rules.",
    tags: ["screens", "layout"],
  }),
  defineDoc({
    slug: "design-qa-readme",
    title: "UI QA",
    area: "design",
    group: "Features",
    section: "UI QA",
    order: 10,
    docType: "UI QA",
    sourcePath: "docs/design/qa/README.md",
    description: "Design QA index.",
    tags: ["qa", "design"],
  }),
  defineDoc({
    slug: "core-workspace-ui-review-checklist",
    title: "Core Workspace UI Review Checklist",
    area: "design",
    group: "Features",
    section: "UI QA",
    order: 20,
    docType: "UI QA",
    sourcePath: "docs/design/qa/core-workspace-ui-review-checklist.md",
    description: "Core workspace UI review checklist.",
    tags: ["qa", "workspace"],
  }),
  defineDoc({
    slug: "interaction-accessibility-audit",
    title: "Interaction Accessibility Audit",
    area: "design",
    group: "Features",
    section: "UI QA",
    order: 30,
    docType: "UI QA",
    sourcePath: "docs/design/qa/interaction-accessibility-audit.md",
    description: "Interaction accessibility review.",
    tags: ["qa", "accessibility"],
  }),
  defineDoc({
    slug: "responsive-dense-layout-audit",
    title: "Responsive Dense Layout Audit",
    area: "design",
    group: "Features",
    section: "UI QA",
    order: 40,
    docType: "UI QA",
    sourcePath: "docs/design/qa/responsive-dense-layout-audit.md",
    description: "Responsive dense layout review.",
    tags: ["qa", "responsive"],
  }),
  defineDoc({
    slug: "clair-docs-ia-sitemap",
    title: "CLAiR Docs IA And Sitemap",
    area: "design",
    group: "Features",
    section: "와이어프레임",
    order: 10,
    docType: "Design",
    sourcePath: "docs/design/wireframes/clair-docs-ia-sitemap.md",
    description: "CLAiR Docs IA migration map and reader-boundary plan.",
    tags: ["docs", "ia", "sitemap"],
  }),
  defineDoc({
    slug: "engineering-readme",
    title: "Engineering Docs",
    area: "development",
    group: "Start",
    section: "시작",
    order: 10,
    docType: "Engineering",
    sourcePath: "docs/engineering/README.md",
    description: "Engineering docs map and boundaries.",
    tags: ["engineering", "reader"],
  }),
  defineDoc({
    slug: "engineering-current-status",
    title: "MVP Current Status",
    area: "development",
    group: "Current State",
    section: "현재 상태",
    order: 10,
    docType: "Engineering",
    sourcePath: "docs/engineering/current-status.md",
    description: "Current MVP status and guardrails.",
    tags: ["status", "mvp"],
  }),
  defineDoc({
    slug: "app-shell-layout-contract",
    title: "App Shell Layout Contract",
    area: "development",
    group: "Domain",
    section: "아키텍처",
    order: 10,
    docType: "Architecture",
    sourcePath: "docs/engineering/architecture/app-shell-layout-contract.md",
    description: "App shell layout and module contract.",
    tags: ["architecture", "app shell"],
  }),
  defineDoc({
    slug: "mock-live-boundary-map",
    title: "Mock Live Boundary Map",
    area: "development",
    group: "Domain",
    section: "아키텍처",
    order: 20,
    docType: "Architecture",
    sourcePath: "docs/engineering/architecture/mock-live-boundary-map.md",
    description: "Mock/live behavior boundary map.",
    tags: ["architecture", "mock", "live"],
  }),
  defineDoc({
    slug: "api-boundary-integration-guide",
    title: "API Boundary Integration Guide",
    area: "development",
    group: "Domain",
    section: "API 경계",
    order: 10,
    docType: "API",
    sourcePath: "docs/engineering/api-boundaries/api-boundary-integration-guide.md",
    description: "API boundary integration guide.",
    tags: ["api", "boundaries"],
  }),
  defineDoc({
    slug: "api-boundary-selectors",
    title: "API Boundary Selectors",
    area: "development",
    group: "Domain",
    section: "API 경계",
    order: 20,
    docType: "API",
    sourcePath: "docs/engineering/api-boundaries/api-boundary-selectors.md",
    description: "API boundary selector map.",
    tags: ["api", "selectors"],
  }),
  defineDoc({
    slug: "product-mvp-qa-scenario-pack",
    title: "Product MVP QA Scenario Pack",
    area: "development",
    group: "Features",
    section: "테스트",
    order: 10,
    docType: "Testing",
    sourcePath: "docs/engineering/testing/product-mvp-qa-scenario-pack.md",
    description: "Product MVP QA scenarios.",
    tags: ["testing", "qa"],
  }),
  defineDoc({
    slug: "mvp-gap-analysis",
    title: "MVP Gap Analysis",
    area: "development",
    group: "Features",
    section: "테스트",
    order: 20,
    docType: "Testing",
    sourcePath: "docs/engineering/testing/mvp-gap-analysis.md",
    description: "MVP implementation gap analysis.",
    tags: ["testing", "gaps"],
  }),
] as const satisfies readonly PrdDocEntry[];

export type PrdDocSlug = (typeof prdDocRegistry)[number]["slug"];

export function getPrdDocBySlug(slug: string | undefined): PrdDocEntry | undefined {
  return prdDocRegistry.find((doc) => doc.slug === slug);
}

function isDefaultVisibleDoc(doc: PrdDocEntry) {
  return doc.exposure === "default_tab" || doc.exposure === "index_only";
}

export function getDefaultPrdDoc(area: ClairDocsArea = "planning"): PrdDocEntry {
  const defaultDoc = getPrdDocBySlug(defaultDocSlugByArea[area]);

  if (!defaultDoc) {
    throw new Error(`Default PRD doc is missing from registry: ${defaultPrdDocSlug}`);
  }

  return defaultDoc;
}

export function getPrdDocGroups() {
  const groups = new Map<string, PrdDocEntry[]>();

  for (const doc of prdDocRegistry.filter(isDefaultVisibleDoc)) {
    const entries = groups.get(doc.section) ?? [];
    entries.push(doc);
    groups.set(doc.section, entries);
  }

  return Array.from(groups.entries()).map(([group, docs]) => ({
    group,
    docs: docs.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title)),
  }));
}

export function getPrdDocGroupsByArea(area: ClairDocsArea) {
  return getPrdDocGroups()
    .map((group) => ({
      ...group,
      docs: group.docs.filter((doc) => doc.area === area),
    }))
    .filter((group) => group.docs.length > 0);
}

export function normalizeClairDocsArea(area: string | undefined): ClairDocsArea {
  if (area === "design" || area === "development" || area === "planning") return area;
  return "planning";
}

export function getPrdDocAreaBySlug(slug: string | undefined): ClairDocsArea | undefined {
  return getPrdDocBySlug(slug)?.area;
}

export function getDefaultDocSlugForArea(area: ClairDocsArea): string {
  return defaultDocSlugByArea[area];
}
