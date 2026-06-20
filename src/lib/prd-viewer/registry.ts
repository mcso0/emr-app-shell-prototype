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
  | "Study";

export type ClairDocsArea = "planning" | "design" | "development" | "study";

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

export type ClairDocsSourceRoot = "product" | "design" | "engineering" | "study";

export type ClairPlanningCategory =
  | "product"
  | "workflow"
  | "feature"
  | "domain-policy"
  | "current-gap";

export type ClairPlanningItemKind =
  | "overview"
  | "prd"
  | "roadmap"
  | "workflow"
  | "users"
  | "domain"
  | "policy"
  | "feature-spec"
  | "detail-spec"
  | "epic-index"
  | "epic-detail"
  | "story-index"
  | "current-state"
  | "gap"
  | "decision"
  | "glossary";

export interface ClairPlanningMetadata {
  category: ClairPlanningCategory;
  feature?: string;
  featureOrder?: number;
  itemKind: ClairPlanningItemKind;
  itemOrder?: number;
  parentSlug?: string;
  record?: {
    id: string;
    status: "draft" | "review" | "approved" | "deferred";
    priority?: "P0" | "P1" | "P2";
  };
}

export interface PrdDocNavigationGroup {
  group: string;
  docs: PrdDocEntry[];
  children?: PrdDocNavigationGroup[];
}

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
  | "Testing"
  | "Study";

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
  study: "study-home",
} as const satisfies Record<ClairDocsArea, string>;

export const clairDocsAreas = [
  { area: "planning", label: "기획" },
  { area: "design", label: "디자인" },
  { area: "development", label: "개발" },
  { area: "study", label: "스터디" },
] as const satisfies Array<{ area: ClairDocsArea; label: string }>;

export const planningCategoryConfig = [
  { category: "product", label: "제품 전체", order: 10 },
  { category: "workflow", label: "메인 업무 흐름", order: 20 },
  { category: "feature", label: "기능 영역", order: 30 },
  { category: "domain-policy", label: "도메인 / 정책", order: 40 },
  { category: "current-gap", label: "현재 구현 / Gap", order: 50 },
] as const satisfies Array<{ category: ClairPlanningCategory; label: string; order: number }>;

export const planningItemKindLabels = {
  overview: "Overview",
  prd: "PRD",
  roadmap: "Roadmap",
  workflow: "Workflow",
  users: "Users / Roles",
  domain: "Domain",
  policy: "Policy",
  "feature-spec": "Feature Spec",
  "detail-spec": "Detail Spec",
  "epic-index": "Epic Index",
  "epic-detail": "Epic",
  "story-index": "User Story Index",
  "current-state": "Current State",
  gap: "Gap",
  decision: "Decision",
  glossary: "Glossary",
} as const satisfies Record<ClairPlanningItemKind, string>;

const planningMetadataBySlug: Partial<Record<string, ClairPlanningMetadata>> = {
  "product-readme": { category: "product", itemKind: "overview", itemOrder: 10 },
  "product-prd": { category: "product", itemKind: "prd", itemOrder: 20 },
  "product-mvp-scope": { category: "product", itemKind: "roadmap", itemOrder: 30 },
  "saas-operating-map": { category: "product", itemKind: "overview", itemOrder: 40 },
  "glossary-readme": { category: "product", itemKind: "glossary", itemOrder: 50 },

  "outpatient-workflow-state-model": {
    category: "workflow",
    feature: "외래 메인 흐름",
    featureOrder: 10,
    itemKind: "workflow",
    itemOrder: 10,
  },
  "emr-saas-userflow": {
    category: "workflow",
    feature: "외래 메인 흐름",
    featureOrder: 10,
    itemKind: "workflow",
    itemOrder: 20,
  },
  "user-flows-readme": {
    category: "workflow",
    feature: "외래 메인 흐름",
    featureOrder: 10,
    itemKind: "overview",
    itemOrder: 30,
  },

  "features-readme": {
    category: "product",
    itemKind: "overview",
    itemOrder: 60,
  },
  "auth-foundation-planning-index": {
    category: "feature",
    feature: "Auth / 계정 / 권한",
    featureOrder: 10,
    itemKind: "overview",
    itemOrder: 10,
  },
  "login-invite-onboarding-spec": {
    category: "feature",
    feature: "Auth / 계정 / 권한",
    featureOrder: 10,
    itemKind: "feature-spec",
    itemOrder: 20,
  },
  "member-role-management-spec": {
    category: "feature",
    feature: "Auth / 계정 / 권한",
    featureOrder: 10,
    itemKind: "detail-spec",
    itemOrder: 30,
  },
  "session-logout-policy-spec": {
    category: "feature",
    feature: "Auth / 계정 / 권한",
    featureOrder: 10,
    itemKind: "detail-spec",
    itemOrder: 40,
  },
  "invite-email-delivery-recovery-policy-spec": {
    category: "feature",
    feature: "Auth / 계정 / 권한",
    featureOrder: 10,
    itemKind: "detail-spec",
    itemOrder: 50,
  },
  "password-reset-account-recovery-policy-spec": {
    category: "feature",
    feature: "Auth / 계정 / 권한",
    featureOrder: 10,
    itemKind: "detail-spec",
    itemOrder: 60,
  },
  "auth-error-empty-state-ux-spec": {
    category: "feature",
    feature: "Auth / 계정 / 권한",
    featureOrder: 10,
    itemKind: "detail-spec",
    itemOrder: 70,
  },
  "workspace-access-guard-policy-spec": {
    category: "feature",
    feature: "Auth / 계정 / 권한",
    featureOrder: 10,
    itemKind: "policy",
    itemOrder: 80,
  },
  "role-permission-detail-spec": {
    category: "feature",
    feature: "Auth / 계정 / 권한",
    featureOrder: 10,
    itemKind: "policy",
    itemOrder: 90,
  },
  "clair-internal-operator-recovery-audit-policy-spec": {
    category: "feature",
    feature: "Auth / 계정 / 권한",
    featureOrder: 10,
    itemKind: "policy",
    itemOrder: 100,
  },
  "auth-login-onboarding-current-state": {
    category: "feature",
    feature: "Auth / 계정 / 권한",
    featureOrder: 10,
    itemKind: "current-state",
    itemOrder: 110,
  },
  "role-screen-access-current-state": {
    category: "feature",
    feature: "Auth / 계정 / 권한",
    featureOrder: 10,
    itemKind: "current-state",
    itemOrder: 120,
  },
  "auth-current-implementation-gap-review": {
    category: "feature",
    feature: "Auth / 계정 / 권한",
    featureOrder: 10,
    itemKind: "gap",
    itemOrder: 130,
  },
  "reception-appointment-overview": {
    category: "feature",
    feature: "접수 / 예약",
    featureOrder: 20,
    itemKind: "overview",
    itemOrder: 10,
  },
  "reception-appointment-users-roles": {
    category: "feature",
    feature: "접수 / 예약",
    featureOrder: 20,
    itemKind: "users",
    itemOrder: 20,
  },
  "reception-appointment-spec": {
    category: "feature",
    feature: "접수 / 예약",
    featureOrder: 20,
    itemKind: "feature-spec",
    itemOrder: 30,
  },
  "reception-appointment-epics": {
    category: "feature",
    feature: "접수 / 예약",
    featureOrder: 20,
    itemKind: "epic-index",
    itemOrder: 40,
  },
  "reception-appointment-epic-appointment-check-in": {
    category: "feature",
    feature: "접수 / 예약",
    featureOrder: 20,
    itemKind: "epic-detail",
    itemOrder: 41,
    parentSlug: "reception-appointment-epics",
    record: {
      id: "RA-EPIC-001",
      status: "draft",
      priority: "P0",
    },
  },
  "reception-appointment-current-state": {
    category: "feature",
    feature: "접수 / 예약",
    featureOrder: 20,
    itemKind: "current-state",
    itemOrder: 50,
  },
  "hospital-profile-onboarding-spec": {
    category: "feature",
    feature: "병원 관리",
    featureOrder: 70,
    itemKind: "feature-spec",
    itemOrder: 10,
  },
  "hospital-admin-member-management-ux-spec": {
    category: "feature",
    feature: "병원 관리",
    featureOrder: 70,
    itemKind: "detail-spec",
    itemOrder: 20,
  },
  "order-fulfillment-handoff": {
    category: "feature",
    feature: "오더 / 수행",
    featureOrder: 40,
    itemKind: "feature-spec",
    itemOrder: 10,
  },
  "workspace-order-catalog-platform": {
    category: "feature",
    feature: "오더 / 수행",
    featureOrder: 40,
    itemKind: "feature-spec",
    itemOrder: 20,
  },
  "legacy-mvp-feature-spec": {
    category: "feature",
    feature: "전체 MVP 기능",
    featureOrder: 90,
    itemKind: "feature-spec",
    itemOrder: 10,
  },
  "epics-readme": { category: "product", itemKind: "epic-index", itemOrder: 70 },
  "user-stories-readme": { category: "product", itemKind: "story-index", itemOrder: 80 },

  "emr-domain-entity-map": { category: "domain-policy", itemKind: "domain", itemOrder: 10 },
  "role-permission-source-map": { category: "domain-policy", itemKind: "policy", itemOrder: 20 },
  "workspace-auth-permissions": { category: "domain-policy", itemKind: "policy", itemOrder: 30 },
  "workspace-hospital-profile": { category: "domain-policy", itemKind: "domain", itemOrder: 40 },
  "decision-log-index": { category: "domain-policy", itemKind: "decision", itemOrder: 50 },
};

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
    slug: "reception-appointment-overview",
    title: "Overview",
    area: "planning",
    group: "Features",
    section: "기능명세",
    order: 135,
    docType: "Feature",
    sourcePath: "docs/product/features/reception-appointment/README.md",
    description: "Reception and appointment package overview, purpose, scope, and document map.",
    tags: ["reception", "appointments", "overview"],
  }),
  defineDoc({
    slug: "reception-appointment-users-roles",
    title: "Users / Roles",
    area: "planning",
    group: "Features",
    section: "기능명세",
    order: 136,
    docType: "Feature",
    sourcePath: "docs/product/features/reception-appointment/users-roles.md",
    description: "Primary users, role boundaries, and permission expectations for reception and appointment work.",
    tags: ["reception", "appointments", "roles"],
  }),
  defineDoc({
    slug: "reception-appointment-spec",
    title: "Feature Spec",
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
    slug: "reception-appointment-epics",
    title: "Epic Index",
    area: "planning",
    group: "Epics",
    section: "에픽",
    order: 141,
    docType: "Epic",
    sourcePath: "docs/product/features/reception-appointment/epics/README.md",
    description: "Reception and appointment epic index.",
    tags: ["reception", "appointments", "epics"],
  }),
  defineDoc({
    slug: "reception-appointment-epic-appointment-check-in",
    title: "예약 환자 접수 처리",
    area: "planning",
    group: "Epics",
    section: "에픽",
    order: 142,
    docType: "Epic",
    sourcePath: "docs/product/features/reception-appointment/epics/appointment-check-in.md",
    exposure: "index_only",
    description: "Epic detail for converting an arrived appointment into today's encounter and queue flow.",
    tags: ["reception", "appointments", "check-in"],
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
    slug: "system-architecture-overview",
    title: "System Architecture Overview",
    area: "development",
    group: "Domain",
    section: "아키텍처",
    order: 5,
    docType: "Architecture",
    sourcePath: "docs/engineering/architecture/system-architecture-overview.md",
    description: "System architecture map and source-of-truth routing overview.",
    tags: ["architecture", "system", "api", "supabase"],
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
  defineDoc({
    slug: "study-home",
    title: "CLAiR Study Center",
    area: "study",
    group: "Study",
    section: "학습 시작",
    order: 10,
    docType: "Study",
    sourcePath: "docs/study/README.md",
    description: "Personal project-study archive entry point.",
    tags: ["study", "owner-learning", "clair-docs"],
  }),
  defineDoc({
    slug: "study-curriculum",
    title: "Study Curriculum",
    area: "study",
    group: "Study",
    section: "학습 시작",
    order: 20,
    docType: "Study",
    sourcePath: "docs/study/curriculum.md",
    description: "Recommended study order for understanding the project.",
    tags: ["study", "curriculum"],
  }),
  defineDoc({
    slug: "study-emr-domain-basics",
    title: "01. EMR Domain Basics",
    area: "study",
    group: "Study",
    section: "수업 기록",
    order: 10,
    docType: "Study",
    sourcePath: "docs/study/sessions/2026-06-17-01-emr-domain-basics.md",
    description: "First study session covering patient, appointment, encounter, and queue entry.",
    tags: ["study", "emr-domain", "encounter", "appointment", "queue"],
  }),
  defineDoc({
    slug: "study-glossary",
    title: "Study Glossary",
    area: "study",
    group: "Study",
    section: "복습 자료",
    order: 10,
    docType: "Study",
    sourcePath: "docs/study/glossary.md",
    description: "Plain-language glossary for project study.",
    tags: ["study", "glossary"],
  }),
  defineDoc({
    slug: "study-diagrams",
    title: "Study Diagrams",
    area: "study",
    group: "Study",
    section: "복습 자료",
    order: 20,
    docType: "Study",
    sourcePath: "docs/study/diagrams.md",
    description: "Visual study diagrams for project concepts.",
    tags: ["study", "diagrams"],
  }),
] as const satisfies readonly PrdDocEntry[];

export type PrdDocSlug = (typeof prdDocRegistry)[number]["slug"];

export function getPrdDocBySlug(slug: string | undefined): PrdDocEntry | undefined {
  return prdDocRegistry.find((doc) => doc.slug === slug);
}

function isDefaultVisibleDoc(doc: PrdDocEntry) {
  return doc.exposure === "default_tab" || doc.exposure === "index_only";
}

function isDefaultNavigationDoc(doc: PrdDocEntry) {
  return doc.exposure === "default_tab";
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

function getPlanningCategoryOrder(category: ClairPlanningCategory) {
  return planningCategoryConfig.find((entry) => entry.category === category)?.order ?? 999;
}

export function getPlanningCategoryLabel(category: ClairPlanningCategory) {
  return planningCategoryConfig.find((entry) => entry.category === category)?.label ?? category;
}

export function getPlanningMetadata(doc: PrdDocEntry): ClairPlanningMetadata | undefined {
  return planningMetadataBySlug[doc.slug];
}

function getPlanningSortOrder(doc: PrdDocEntry) {
  const metadata = getPlanningMetadata(doc);

  return metadata?.itemOrder ?? doc.order;
}

function sortPlanningDocs(docs: PrdDocEntry[]) {
  return docs.sort((a, b) => getPlanningSortOrder(a) - getPlanningSortOrder(b) || a.title.localeCompare(b.title));
}

function getPlanningNavigationGroups(docs: PrdDocEntry[]): PrdDocNavigationGroup[] {
  const categoryGroups = new Map<
    ClairPlanningCategory,
    {
      docs: PrdDocEntry[];
      featureGroups: Map<string, { order: number; docs: PrdDocEntry[] }>;
    }
  >();

  for (const doc of docs) {
    const metadata = getPlanningMetadata(doc);
    const category = metadata?.category ?? "feature";
    const categoryGroup = categoryGroups.get(category) ?? {
      docs: [],
      featureGroups: new Map<string, { order: number; docs: PrdDocEntry[] }>(),
    };

    if (metadata?.feature) {
      const featureGroup = categoryGroup.featureGroups.get(metadata.feature) ?? {
        order: metadata.featureOrder ?? 999,
        docs: [],
      };
      featureGroup.docs.push(doc);
      categoryGroup.featureGroups.set(metadata.feature, featureGroup);
    } else {
      categoryGroup.docs.push(doc);
    }

    categoryGroups.set(category, categoryGroup);
  }

  return Array.from(categoryGroups.entries())
    .sort(([categoryA], [categoryB]) => getPlanningCategoryOrder(categoryA) - getPlanningCategoryOrder(categoryB))
    .map(([category, group]) => ({
      group: getPlanningCategoryLabel(category),
      docs: sortPlanningDocs(group.docs),
      children: Array.from(group.featureGroups.entries())
        .sort(([, featureA], [, featureB]) => featureA.order - featureB.order)
        .map(([feature, featureGroup]) => ({
          group: feature,
          docs: sortPlanningDocs(featureGroup.docs),
        })),
    }));
}

export function getPrdDocNavigationGroupsByArea(area: ClairDocsArea): PrdDocNavigationGroup[] {
  const docs = prdDocRegistry.filter((doc) => isDefaultNavigationDoc(doc) && doc.area === area);

  if (area === "planning") {
    return getPlanningNavigationGroups(docs);
  }

  return getPrdDocGroupsByArea(area);
}

export function getPlanningFeatureDocs(entry: PrdDocEntry): PrdDocEntry[] {
  const metadata = getPlanningMetadata(entry);

  if (entry.area !== "planning" || !metadata?.feature) {
    return [];
  }

  return sortPlanningDocs(
    prdDocRegistry.filter((doc) => {
      const candidateMetadata = getPlanningMetadata(doc);

      return (
        doc.area === "planning" &&
        isDefaultVisibleDoc(doc) &&
        candidateMetadata?.feature === metadata.feature
      );
    })
  );
}

export function getPlanningEpicDocs(entry: PrdDocEntry): PrdDocEntry[] {
  const metadata = getPlanningMetadata(entry);

  if (entry.area !== "planning" || metadata?.itemKind !== "epic-index" || !metadata.feature) {
    return [];
  }

  return sortPlanningDocs(
    prdDocRegistry.filter((doc) => {
      const candidateMetadata = getPlanningMetadata(doc);

      return (
        doc.area === "planning" &&
        isDefaultVisibleDoc(doc) &&
        candidateMetadata?.feature === metadata.feature &&
        candidateMetadata?.itemKind === "epic-detail" &&
        candidateMetadata?.parentSlug === entry.slug
      );
    })
  );
}

export function getPlanningParentDoc(entry: PrdDocEntry): PrdDocEntry | undefined {
  const parentSlug = getPlanningMetadata(entry)?.parentSlug;

  return parentSlug ? getPrdDocBySlug(parentSlug) : undefined;
}

export function normalizeClairDocsArea(area: string | undefined): ClairDocsArea {
  if (area === "design" || area === "development" || area === "planning" || area === "study") return area;
  return "planning";
}

export function getPrdDocAreaBySlug(slug: string | undefined): ClairDocsArea | undefined {
  return getPrdDocBySlug(slug)?.area;
}

export function getDefaultDocSlugForArea(area: ClairDocsArea): string {
  return defaultDocSlugByArea[area];
}
