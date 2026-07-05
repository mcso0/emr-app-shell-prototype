import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import {
  createMockReceptionPatientGuardianLookupGateway,
  type ReceptionPatientGuardianLookupGateway,
} from "@/features/reception/server-patient-guardian-lookup-core";
import {
  createMockReceptionQueueReadGateway,
  type ReceptionQueueReadGateway,
} from "@/features/reception/server-reception-queue-read-core";
import {
  createMockWorkspaceStaffReadGateway,
  readWorkspaceStaff,
  type WorkspaceStaffMember,
  type WorkspaceStaffReadGateway,
} from "@/features/staff/server-workspace-staff-core";
import type { ReceptionQueueReadRecord } from "@/features/reception/reception-queue-read";
import type { ReceptionPatientGuardianLookupItem } from "@/features/reception/patient-guardian-lookup";
import type {
  CommandSearchFilter,
  CommandSearchResponse,
  CommandSearchResult,
  CommandSearchSourceState,
} from "@/features/command/command-search";
import {
  normalizeCommandSearchQuery,
  shouldRunCommandSearch,
} from "@/features/command/command-search";
import { getStatusLabel } from "@/lib/emr-domain/status-labels";
import { getWorkspaceOperatingDate } from "@/lib/emr-domain/demo-date";
import type { Guardian, Patient } from "@/types/emr-domain";

export type CommandSearchResultEnvelope =
  | (Extract<CommandSearchResponse, { ok: true }> & { status: 200 })
  | {
      ok: false;
      status: 401 | 403;
      denialReason: WorkspacePermissionDenialReason;
    };

const maxResultsPerKind = 8;
const commandSearchFilters: CommandSearchFilter[] = [
  "all",
  "patient",
  "guardian",
  "phone",
  "chart",
  "vet",
  "technician",
  "desk",
];

export async function searchCommand({
  actorUserId,
  date,
  filter = "all",
  patientGuardianGateway = createMockReceptionPatientGuardianLookupGateway(),
  permissionAdapter = createDemoCommandSearchPermissionAdapter(),
  query,
  receptionQueueGateway = createMockReceptionQueueReadGateway(),
  staffGateway = createMockWorkspaceStaffReadGateway(),
  workspaceId,
}: {
  actorUserId: string | null;
  date?: string;
  filter?: string | null;
  patientGuardianGateway?: ReceptionPatientGuardianLookupGateway;
  permissionAdapter?: WorkspacePermissionAdapter;
  query: string;
  receptionQueueGateway?: ReceptionQueueReadGateway;
  staffGateway?: WorkspaceStaffReadGateway;
  workspaceId: string;
}): Promise<CommandSearchResultEnvelope> {
  const normalizedFilter = normalizeCommandSearchFilter(filter);
  const normalizedQuery = normalizeCommandSearchQuery(query);
  const operatingDate = date ?? getWorkspaceOperatingDate(workspaceId);

  if (!actorUserId) {
    return { ok: false, status: 401, denialReason: "unauthenticated" };
  }

  const membershipPermission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
  });

  if (!membershipPermission.allowed) {
    return {
      ok: false,
      status: membershipPermission.denialReason === "unauthenticated" ? 401 : 403,
      denialReason: membershipPermission.denialReason ?? "permission_missing",
    };
  }

  if (!shouldRunCommandSearch(normalizedQuery)) {
    return {
      ok: true,
      status: 200,
      query: normalizedQuery,
      filter: normalizedFilter,
      results: [],
      sourceState: { patientGuardian: "skipped", reception: "skipped", staff: "skipped" },
      enforcedBy: "command-search",
    };
  }

  const sourceState: CommandSearchSourceState = {
    patientGuardian: "skipped",
    reception: "skipped",
    staff: "skipped",
  };
  const results: CommandSearchResult[] = [];

  if (shouldSearchPeople(normalizedFilter)) {
    const patientPermission = resolveWorkspacePermission(permissionAdapter, {
      sessionUserId: actorUserId,
      workspaceId,
      requiredPermission: "patient:view",
    });

    if (!patientPermission.allowed) {
      sourceState.patientGuardian = "permission_denied";
    } else {
      const patientResult = await patientGuardianGateway.searchPatientGuardianLookup({
        workspaceId,
        query: normalizedQuery,
      });

      if (!patientResult.ok) {
        sourceState.patientGuardian = "error";
      } else {
        sourceState.patientGuardian = "ready";
        results.push(
          ...buildPeopleResults({
            filter: normalizedFilter,
            lookupItems: patientResult.patients,
            query: normalizedQuery,
            workspaceId,
          }),
        );
      }
    }
  }

  if (shouldSearchReception(normalizedFilter)) {
    const receptionPermission = resolveWorkspacePermission(permissionAdapter, {
      sessionUserId: actorUserId,
      workspaceId,
      requiredPermission: "reception:view",
    });

    if (!receptionPermission.allowed) {
      sourceState.reception = "permission_denied";
    } else {
      const queueResult = await receptionQueueGateway.listReceptionQueue({
        date: operatingDate,
        workspaceId,
      });

      if (!queueResult.ok) {
        sourceState.reception = "error";
      } else {
        sourceState.reception = "ready";
        results.push(
          ...buildReceptionResults({
            filter: normalizedFilter,
            query: normalizedQuery,
            records: queueResult.queue,
            workspaceId,
          }),
        );
      }
    }
  }

  if (shouldSearchStaff(normalizedFilter)) {
    const staffResult = await readWorkspaceStaff({
      actorUserId,
      gateway: staffGateway,
      permissionAdapter,
      workspaceId,
    });

    if (!staffResult.ok) {
      sourceState.staff = staffResult.status === 401 || staffResult.status === 403
        ? "permission_denied"
        : "error";
    } else {
      sourceState.staff = "ready";
      results.push(
        ...buildStaffResults({
          filter: normalizedFilter,
          query: normalizedQuery,
          staff: staffResult.staff,
          workspaceId,
        }),
      );
    }
  }

  return {
    ok: true,
    status: 200,
    query: normalizedQuery,
    filter: normalizedFilter,
    results: dedupeResults(results),
    sourceState,
    enforcedBy: "command-search",
  };
}

export function normalizeCommandSearchFilter(filter?: string | null): CommandSearchFilter {
  return commandSearchFilters.includes(filter as CommandSearchFilter)
    ? (filter as CommandSearchFilter)
    : "all";
}

export function createDemoCommandSearchPermissionAdapter() {
  return createMockWorkspacePermissionAdapter({
    users: [
      { id: "user-admin", status: "active" },
      { id: "user-front-desk", status: "active" },
      { id: "user-vet", status: "active" },
      { id: "playwright-default-session", status: "active" },
    ],
    memberships: [
      {
        id: "membership-admin",
        workspaceId: "clair-demo",
        userId: "user-admin",
        roles: ["hospital_admin"],
        status: "active",
      },
      {
        id: "membership-front-desk",
        workspaceId: "clair-demo",
        userId: "user-front-desk",
        roles: ["front_desk"],
        status: "active",
      },
      {
        id: "membership-vet",
        workspaceId: "clair-demo",
        userId: "user-vet",
        roles: ["vet"],
        status: "active",
      },
      {
        id: "membership-playwright-default",
        workspaceId: "clair-demo",
        userId: "playwright-default-session",
        roles: ["hospital_admin"],
        status: "active",
      },
      {
        id: "membership-cheongdam-front-desk",
        workspaceId: "workspace-clair-cheongdam",
        userId: "user-front-desk",
        roles: ["front_desk"],
        status: "active",
      },
      {
        id: "membership-cheongdam-playwright-default",
        workspaceId: "workspace-clair-cheongdam",
        userId: "playwright-default-session",
        roles: ["hospital_admin"],
        status: "active",
      },
    ],
  });
}

function shouldSearchPeople(filter: CommandSearchFilter) {
  return ["all", "patient", "guardian", "phone", "chart"].includes(filter);
}

function shouldSearchReception(filter: CommandSearchFilter) {
  return ["all", "patient", "guardian", "phone", "chart", "vet", "desk"].includes(filter);
}

function shouldSearchStaff(filter: CommandSearchFilter) {
  return ["all", "vet", "technician", "desk"].includes(filter);
}

function buildPeopleResults({
  filter,
  lookupItems,
  query,
  workspaceId,
}: {
  filter: CommandSearchFilter;
  lookupItems: ReceptionPatientGuardianLookupItem[];
  query: string;
  workspaceId: string;
}): CommandSearchResult[] {
  const patientResults = filter === "guardian"
    ? []
    : lookupItems
        .filter((item) => matchesCommandQuery(getPatientSearchText(item.patient, item.primaryGuardian), query))
        .slice(0, maxResultsPerKind)
        .map((item): CommandSearchResult => ({
          id: `patient-${item.patient.id}`,
          kind: "patient",
          title: item.patient.name,
          subtitle: [item.patient.patientNo, item.patient.breed, item.primaryGuardian?.name, item.primaryGuardian?.mobilePhone]
            .filter(Boolean)
            .join(" · "),
          href: createHref(workspaceId, "reception", {
            patientId: item.patient.id,
            drawer: `reception-patient:${item.patient.id}`,
          }),
          badge: "환자",
          lookupItem: item,
        }));
  const guardianMap = new Map<string, CommandSearchResult>();

  if (filter !== "patient" && filter !== "chart") {
    lookupItems.forEach((item) => {
      const guardian = item.primaryGuardian;
      if (!guardian || guardianMap.has(guardian.id)) return;
      if (!matchesCommandQuery(getGuardianSearchText(guardian, item.patient), query)) return;

      guardianMap.set(guardian.id, {
        id: `guardian-${guardian.id}`,
        kind: "guardian",
        title: guardian.name,
        subtitle: [guardian.mobilePhone, item.patient.name, item.patient.patientNo].filter(Boolean).join(" · "),
        href: createHref(workspaceId, "reception", {
          drawer: `reception-guardian:${guardian.id}`,
        }),
        badge: "보호자",
        lookupItem: item,
      });
    });
  }

  return [...patientResults, ...Array.from(guardianMap.values()).slice(0, maxResultsPerKind)];
}

function buildStaffResults({
  filter,
  query,
  staff,
  workspaceId,
}: {
  filter: CommandSearchFilter;
  query: string;
  staff: WorkspaceStaffMember[];
  workspaceId: string;
}): CommandSearchResult[] {
  return staff
    .filter((member) => matchesStaffFilter(member, filter))
    .filter((member) => matchesCommandQuery(getStaffSearchText(member), query))
    .slice(0, maxResultsPerKind)
    .map((member): CommandSearchResult => ({
      id: `staff-${member.id}`,
      kind: "staff",
      title: member.displayName,
      subtitle: [member.title, member.department, getStaffRoleLabels(member).join(", ")]
        .filter(Boolean)
        .join(" · "),
      href: createHref(workspaceId, "hospital-admin", {
        section: "members",
      }),
      badge: "구성원",
    }));
}

function buildReceptionResults({
  filter,
  query,
  records,
  workspaceId,
}: {
  filter: CommandSearchFilter;
  query: string;
  records: ReceptionQueueReadRecord[];
  workspaceId: string;
}): CommandSearchResult[] {
  if (filter === "technician") return [];

  return records
    .filter((record) => matchesCommandQuery(getReceptionRecordSearchText(record), query))
    .slice(0, maxResultsPerKind)
    .map((record): CommandSearchResult => {
      if (record.kind === "appointment") {
        const patient = record.patient;

        return {
          id: `appointment-${record.appointment.id}`,
          kind: "appointment",
          title: `${patient?.name ?? "예약"} · ${record.appointment.visitPurpose ?? "예약"}`,
          subtitle: [formatShortTime(record.appointment.scheduledStartAt), record.primaryGuardian?.name, record.appointment.symptomNote]
            .filter(Boolean)
            .join(" · "),
          href: createHref(workspaceId, "reception", {
            ...(patient ? { patientId: patient.id } : {}),
            drawer: `reception-appointment:${record.appointment.id}`,
          }),
          badge: getStatusLabel("appointment", record.appointment.status),
          ...(patient ? { lookupItem: { patient, ...(record.primaryGuardian ? { primaryGuardian: record.primaryGuardian } : {}) } } : {}),
        };
      }

      const patient = record.patient;

      return {
        id: `encounter-${record.encounter.id}`,
        kind: "encounter",
        title: `${patient?.name ?? "접수"} · ${record.encounter.chiefComplaint ?? record.encounter.visitPurpose ?? "접수"}`,
        subtitle: [
          formatShortTime(record.encounter.checkedInAt ?? record.queueEntry.enteredAt),
          record.primaryGuardian?.name,
          record.encounter.encounterNo,
        ]
          .filter(Boolean)
          .join(" · "),
        href: createHref(workspaceId, "reception", {
          ...(patient ? { patientId: patient.id } : {}),
          encounterId: record.encounter.id,
          drawer: `reception-encounter:${record.encounter.id}`,
        }),
        badge: getStatusLabel("queue", record.queueEntry.status),
        ...(patient ? { lookupItem: { patient, ...(record.primaryGuardian ? { primaryGuardian: record.primaryGuardian } : {}) } } : {}),
      };
    });
}

function matchesStaffFilter(member: WorkspaceStaffMember, filter: CommandSearchFilter) {
  if (filter === "all") return true;
  if (filter === "desk") return member.roles.includes("front_desk");
  if (filter === "vet" || filter === "technician") return member.roles.includes(filter);
  return false;
}

function getStaffRoleLabels(member: WorkspaceStaffMember) {
  const roleLabels: Record<string, string> = {
    front_desk: "데스크",
    hospital_admin: "관리자",
    technician: "테크니션",
    vet: "수의사",
  };

  return member.roles.map((role) => roleLabels[role] ?? role);
}

function getStaffSearchText(member: WorkspaceStaffMember) {
  return [
    member.displayName,
    member.initial,
    member.title,
    member.department,
    ...member.roles,
    ...getStaffRoleLabels(member),
  ].filter(Boolean).join(" ");
}

function getPatientSearchText(patient: Patient, guardian?: Guardian) {
  return [
    patient.name,
    patient.patientNo,
    patient.breed,
    patient.microchipNo,
    patient.patientRegistrationNo,
    guardian?.name,
    guardian?.mobilePhone,
    guardian?.phone,
  ].filter(Boolean).join(" ");
}

function getGuardianSearchText(guardian: Guardian, patient: Patient) {
  return [
    guardian.name,
    guardian.mobilePhone,
    guardian.phone,
    guardian.email,
    patient.name,
    patient.patientNo,
  ].filter(Boolean).join(" ");
}

function getReceptionRecordSearchText(record: ReceptionQueueReadRecord) {
  if (record.kind === "appointment") {
    return [
      record.patient?.name,
      record.patient?.patientNo,
      record.primaryGuardian?.name,
      record.primaryGuardian?.mobilePhone,
      record.appointment.visitPurpose,
      record.appointment.symptomNote,
      record.appointment.status,
    ].filter(Boolean).join(" ");
  }

  return [
    record.patient?.name,
    record.patient?.patientNo,
    record.primaryGuardian?.name,
    record.primaryGuardian?.mobilePhone,
    record.encounter.encounterNo,
    record.encounter.chiefComplaint,
    record.encounter.visitPurpose,
    record.queueEntry.status,
  ].filter(Boolean).join(" ");
}

function matchesCommandQuery(searchText: string, query: string) {
  const normalizedSearchText = normalizeComparableText(searchText);
  return normalizeComparableText(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => normalizedSearchText.includes(token));
}

function normalizeComparableText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ko");
}

function dedupeResults(results: CommandSearchResult[]) {
  const seen = new Set<string>();
  const deduped: CommandSearchResult[] = [];

  results.forEach((result) => {
    if (seen.has(result.id)) return;
    seen.add(result.id);
    deduped.push(result);
  });

  return deduped;
}

function createHref(workspaceId: string, moduleId: string, params?: Record<string, string>) {
  const searchParams = new URLSearchParams({ modulePanel: "open", ...(params ?? {}) });
  return `/w/${workspaceId}/${moduleId}?${searchParams.toString()}`;
}

function formatShortTime(value?: string) {
  return value ? value.slice(11, 16) : "";
}
