"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarIcon,
  ClockIcon,
  CommandIcon,
  CreditCardIcon,
  SearchIcon,
  StethoscopeIcon,
  UserIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  mockAppointments,
  mockEncounters,
  mockGuardians,
  mockPatientGuardians,
  mockPatients,
  mockStaffUsers,
  mockWaitingQueueEntries,
} from "@/mocks/emr-domain";
import { getStatusLabel } from "@/lib/emr-domain/status-labels";
import { cn } from "@/lib/utils";
import type { AppIcon } from "@/components/icons";
import type { Appointment, Encounter, EmrId, Guardian, Patient } from "@/types/emr-domain";

type CommandItemKind = "action" | "patient" | "guardian" | "appointment" | "encounter";

type CommandItem = {
  id: string;
  kind: CommandItemKind;
  title: string;
  subtitle: string;
  href: string;
  badge?: string;
  icon: AppIcon;
  keywords: string[];
};

type CommandSection = {
  id: string;
  title: string;
  items: CommandItem[];
};

const MAX_ITEMS_PER_SECTION = 6;

const quickActionSpecs = [
  {
    id: "new-reception",
    title: "신규 진료 접수",
    subtitle: "접수/예약 화면에서 새 내원 접수를 시작합니다.",
    badge: "Action",
    icon: CalendarIcon,
    moduleId: "reception",
    keywords: ["진료 접수", "신규 접수", "예약", "데스크"],
  },
  {
    id: "register-patient",
    title: "환자/보호자 등록",
    subtitle: "신규 보호자 또는 환자 master data를 등록합니다.",
    badge: "Action",
    icon: UserIcon,
    moduleId: "reception",
    keywords: ["환자 등록", "보호자 등록", "신규 동물", "고객"],
  },
  {
    id: "today-appointments",
    title: "오늘 예약 보기",
    subtitle: "접수/예약 캘린더와 대기 목록을 엽니다.",
    badge: "View",
    icon: ClockIcon,
    moduleId: "reception",
    keywords: ["오늘", "예약", "대기", "스케줄"],
  },
  {
    id: "billing-queue",
    title: "수납 대기 확인",
    subtitle: "미수/수납 대기 업무를 확인합니다.",
    badge: "View",
    icon: CreditCardIcon,
    moduleId: "billing",
    keywords: ["수납", "미수", "결제", "청구"],
  },
  {
    id: "chart-queue",
    title: "진료 대기열 열기",
    subtitle: "수의사 진료/차트 업무 화면으로 이동합니다.",
    badge: "View",
    icon: StethoscopeIcon,
    moduleId: "treatment",
    keywords: ["진료", "차트", "SOAP", "대기열"],
  },
] as const;

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function formatShortTime(value?: string) {
  if (!value) return "";
  return value.slice(11, 16);
}

function getPrimaryGuardian(patientId: EmrId) {
  const guardianId = mockPatientGuardians.find(
    (link) => link.patientId === patientId && link.isPrimary
  )?.guardianId;

  return guardianId ? mockGuardians.find((guardian) => guardian.id === guardianId) : undefined;
}

function getPatientNamesForGuardian(guardianId: EmrId) {
  const patientIds = new Set(
    mockPatientGuardians
      .filter((link) => link.guardianId === guardianId)
      .map((link) => link.patientId)
  );

  return mockPatients
    .filter((patient) => patientIds.has(patient.id))
    .map((patient) => patient.name);
}

function getStaffName(userId?: EmrId) {
  return userId ? mockStaffUsers.find((staff) => staff.id === userId)?.name : undefined;
}

function getPatient(patientId: EmrId) {
  return mockPatients.find((patient) => patient.id === patientId);
}

function getGuardian(guardianId?: EmrId, patientId?: EmrId) {
  if (guardianId) return mockGuardians.find((guardian) => guardian.id === guardianId);
  return patientId ? getPrimaryGuardian(patientId) : undefined;
}

function createHref(workspaceId: string, moduleId: string, params?: Record<string, string>) {
  const searchParams = new URLSearchParams({ modulePanel: "open", ...(params ?? {}) });
  return `/w/${workspaceId}/${moduleId}?${searchParams.toString()}`;
}

function patientKeywords(patient: Patient, guardian?: Guardian) {
  return [
    patient.name,
    patient.patientNo,
    patient.breed,
    patient.microchipNo,
    patient.patientRegistrationNo,
    guardian?.name,
    guardian?.mobilePhone,
    guardian?.phone,
  ].filter(Boolean) as string[];
}

function buildPatientItem(workspaceId: string, patient: Patient): CommandItem {
  const guardian = getPrimaryGuardian(patient.id);
  const summary = [patient.breed, guardian?.name, guardian?.mobilePhone].filter(Boolean).join(" · ");

  return {
    id: `patient-${patient.id}`,
    kind: "patient",
    title: patient.name,
    subtitle: summary || patient.patientNo,
    href: createHref(workspaceId, "reception", {
      patientId: patient.id,
      drawer: `reception-patient:${patient.id}`,
    }),
    badge: "환자",
    icon: UserIcon,
    keywords: patientKeywords(patient, guardian),
  };
}

function buildGuardianItem(workspaceId: string, guardian: Guardian): CommandItem {
  const patientNames = getPatientNamesForGuardian(guardian.id);

  return {
    id: `guardian-${guardian.id}`,
    kind: "guardian",
    title: guardian.name,
    subtitle: [guardian.mobilePhone, patientNames.join(", ")].filter(Boolean).join(" · "),
    href: createHref(workspaceId, "reception", {
      drawer: `reception-guardian:${guardian.id}`,
    }),
    badge: "보호자",
    icon: UserIcon,
    keywords: [guardian.name, guardian.mobilePhone, guardian.phone, guardian.email, ...patientNames].filter(
      Boolean
    ) as string[],
  };
}

function buildAppointmentItem(workspaceId: string, appointment: Appointment): CommandItem | null {
  const patient = getPatient(appointment.patientId);
  const guardian = getGuardian(appointment.guardianId, appointment.patientId);
  if (!patient) return null;

  return {
    id: `appointment-${appointment.id}`,
    kind: "appointment",
    title: `${patient.name} · ${appointment.visitPurpose ?? "예약"}`,
    subtitle: `${formatShortTime(appointment.scheduledStartAt)} · ${guardian?.name ?? "보호자 미지정"} · ${
      getStaffName(appointment.assignedVeterinarianId) ?? "담당 미정"
    }`,
    href: createHref(workspaceId, "reception", {
      patientId: patient.id,
      drawer: `reception-appointment:${appointment.id}`,
    }),
    badge: getStatusLabel("appointment", appointment.status),
    icon: CalendarIcon,
    keywords: [
      patient.name,
      patient.patientNo,
      guardian?.name,
      guardian?.mobilePhone,
      appointment.visitPurpose,
      appointment.symptomNote,
      getStaffName(appointment.assignedVeterinarianId),
    ].filter(Boolean) as string[],
  };
}

function buildEncounterItem(workspaceId: string, encounter: Encounter): CommandItem | null {
  const patient = getPatient(encounter.patientId);
  const guardian = getGuardian(encounter.guardianId, encounter.patientId);
  if (!patient) return null;

  const queueEntry = mockWaitingQueueEntries.find((entry) => entry.encounterId === encounter.id);

  return {
    id: `encounter-${encounter.id}`,
    kind: "encounter",
    title: `${patient.name} · ${encounter.chiefComplaint ?? encounter.visitPurpose ?? "접수"}`,
    subtitle: `${formatShortTime(encounter.checkedInAt ?? encounter.createdAt)} · ${
      guardian?.name ?? "보호자 미지정"
    } · ${encounter.encounterNo}`,
    href: createHref(workspaceId, "reception", {
      patientId: patient.id,
      encounterId: encounter.id,
      drawer: `reception-encounter:${encounter.id}`,
    }),
    badge: queueEntry ? getStatusLabel("queue", queueEntry.status) : getStatusLabel("encounter", encounter.status),
    icon: ClockIcon,
    keywords: [
      patient.name,
      patient.patientNo,
      guardian?.name,
      guardian?.mobilePhone,
      encounter.encounterNo,
      encounter.chiefComplaint,
      encounter.visitPurpose,
      getStaffName(encounter.primaryVeterinarianId),
    ].filter(Boolean) as string[],
  };
}

function buildCommandSections(workspaceId: string, query: string): CommandSection[] {
  const normalizedQuery = normalizeText(query);
  const matchesQuery = (item: CommandItem) => {
    if (!normalizedQuery) return true;
    return normalizeText([item.title, item.subtitle, item.badge, ...item.keywords].join(" ")).includes(
      normalizedQuery
    );
  };
  const limitItems = (items: CommandItem[], defaultLimit = 4) =>
    items.filter(matchesQuery).slice(0, normalizedQuery ? MAX_ITEMS_PER_SECTION : defaultLimit);
  const quickActions: CommandItem[] = quickActionSpecs.map((action) => ({
    id: `action-${action.id}`,
    kind: "action",
    title: action.title,
    subtitle: action.subtitle,
    href: createHref(workspaceId, action.moduleId),
    badge: action.badge,
    icon: action.icon,
    keywords: [...action.keywords, action.title, action.subtitle],
  }));
  const patientItems = mockPatients.map((patient) => buildPatientItem(workspaceId, patient));
  const guardianItems = mockGuardians.map((guardian) => buildGuardianItem(workspaceId, guardian));
  const appointmentItems = mockAppointments
    .filter((appointment) => appointment.scheduledStartAt.startsWith("2026-05-01"))
    .map((appointment) => buildAppointmentItem(workspaceId, appointment))
    .filter((item): item is CommandItem => Boolean(item));
  const activeEncounterItems = mockEncounters
    .filter((encounter) =>
      ["waiting", "in_consultation", "ordered", "ready_for_billing"].includes(encounter.status)
    )
    .map((encounter) => buildEncounterItem(workspaceId, encounter))
    .filter((item): item is CommandItem => Boolean(item));
  const sections: CommandSection[] = [
    { id: "actions", title: "빠른 실행", items: limitItems(quickActions, 5) },
    {
      id: "today",
      title: normalizedQuery ? "예약/접수" : "오늘 업무",
      items: limitItems([...appointmentItems, ...activeEncounterItems], 6),
    },
    {
      id: "people",
      title: "환자/보호자",
      items: limitItems([...patientItems, ...guardianItems], normalizedQuery ? 6 : 4),
    },
  ];

  return sections.filter((section) => section.items.length > 0);
}

function flattenSections(sections: CommandSection[]) {
  return sections.flatMap((section) => section.items);
}

export function GlobalCommandPalette({
  triggerVariant = "wide",
  workspaceId,
}: {
  triggerVariant?: "wide" | "icon";
  workspaceId: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const sections = useMemo(() => buildCommandSections(workspaceId, query), [query, workspaceId]);
  const flattenedItems = useMemo(() => flattenSections(sections), [sections]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    if (!open) return;

    const focusTimer = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(focusTimer);
  }, [open]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setQuery("");
      setActiveIndex(0);
    }
  };

  const handleQueryChange = (nextQuery: string) => {
    setQuery(nextQuery);
    setActiveIndex(0);
  };

  const runCommand = (item: CommandItem) => {
    setOpen(false);
    router.push(item.href, { scroll: false });
  };

  const moveActiveIndex = (direction: 1 | -1) => {
    if (!flattenedItems.length) return;

    setActiveIndex((current) => {
      if (current < 0) return direction === 1 ? 0 : flattenedItems.length - 1;
      return (current + direction + flattenedItems.length) % flattenedItems.length;
    });
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActiveIndex(1);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActiveIndex(-1);
    }
    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      const item = flattenedItems[activeIndex];
      if (item) runCommand(item);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size={triggerVariant === "icon" ? "icon" : "default"}
        className={cn(
          triggerVariant === "icon"
            ? "justify-center rounded-[var(--emr-radius-control)] px-0 text-muted-foreground hover:bg-[var(--emr-state-hover)] hover:text-foreground focus-visible:ring-ring/40"
            : "mx-auto h-8 w-[min(560px,45vw)] min-w-8 rounded-lg border-border bg-card px-3 text-left shadow-sm hover:border-[var(--emr-line-strong)] hover:bg-card focus-visible:ring-ring/40 max-sm:w-8 max-sm:px-2",
        )}
        aria-label="전역 통합 검색 열기"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <SearchIcon
          className={cn("shrink-0 text-muted-foreground", triggerVariant === "icon" ? "size-4" : "size-3.5")}
          aria-hidden="true"
        />
        {triggerVariant === "wide" ? (
          <>
            <span className="min-w-0 flex-1 truncate px-2 text-[12px] text-muted-foreground max-sm:hidden">
              동물명 또는 보호자명으로 검색
            </span>
            <span className="inline-flex items-center gap-1 rounded border border-border bg-card px-1.5 py-0.5 text-[11px] leading-none text-muted-foreground max-sm:hidden">
              <CommandIcon className="size-3" aria-hidden="true" />
              K
            </span>
          </>
        ) : null}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="top-[88px] max-h-[min(720px,calc(100vh-120px))] w-[min(720px,calc(100vw-32px))] translate-y-0 gap-0 overflow-hidden rounded-[12px] border border-[var(--emr-line-subtle)] bg-card p-0 shadow-2xl sm:max-w-[720px]"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">통합 검색과 빠른 실행</DialogTitle>
          <DialogDescription className="sr-only">
            환자, 보호자, 예약, 접수와 주요 업무 화면을 검색하고 실행합니다.
          </DialogDescription>
          <div className="flex h-13 items-center gap-2 border-b px-4">
            <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
              onKeyDown={handleInputKeyDown}
              aria-label="통합 검색"
              placeholder="동물명, 보호자명, 전화번호, 차트번호 검색"
              className="h-12 border-0 bg-transparent px-0 text-[15px] shadow-none focus-visible:ring-0 md:text-[15px]"
            />
            <kbd className="rounded border border-border bg-muted px-1.5 py-1 text-[11px] font-medium leading-none text-muted-foreground">
              Esc
            </kbd>
          </div>
          <div className="max-h-[560px] overflow-y-auto px-2 py-2">
            {sections.length ? (
              sections.map((section, sectionIndex) => (
                <div key={section.id}>
                  <CommandSectionView
                    activeIndex={activeIndex}
                    flattenedItems={flattenedItems}
                    section={section}
                    onRunCommand={runCommand}
                    onSetActiveIndex={setActiveIndex}
                  />
                  {sectionIndex < sections.length - 1 ? <Separator className="my-1" /> : null}
                </div>
              ))
            ) : (
              <div className="flex min-h-40 flex-col items-center justify-center gap-2 px-6 text-center">
                <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <SearchIcon className="size-4" aria-hidden="true" />
                </div>
                <div className="text-sm font-medium text-foreground">
                  검색 결과가 없습니다.
                </div>
                <div className="text-xs text-muted-foreground">
                  동물명, 보호자명, 전화번호 또는 차트번호로 다시 검색해 주세요.
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between border-t bg-muted/50 px-4 py-2 text-[11px] text-muted-foreground">
            <span>Enter 실행</span>
            <span>↑↓ 이동</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CommandSectionView({
  activeIndex,
  flattenedItems,
  section,
  onRunCommand,
  onSetActiveIndex,
}: {
  activeIndex: number;
  flattenedItems: CommandItem[];
  section: CommandSection;
  onRunCommand: (item: CommandItem) => void;
  onSetActiveIndex: (index: number) => void;
}) {
  return (
    <section className="py-1">
      <div className="px-2 pb-1 pt-2 text-[11px] font-semibold text-muted-foreground">
        {section.title}
      </div>
      <div className="space-y-0.5">
        {section.items.map((item) => {
          const itemIndex = flattenedItems.findIndex((flattenedItem) => flattenedItem.id === item.id);
          const Icon = item.icon;
          const active = itemIndex === activeIndex;

          return (
            <button
              key={item.id}
              type="button"
              className={cn(
                "grid w-full grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 rounded-[8px] px-2.5 py-2 text-left outline-none transition-colors",
                active
                  ? "bg-muted text-foreground"
                  : "text-[var(--emr-text-secondary)] hover:bg-muted/50"
              )}
              data-active={active || undefined}
              onClick={() => onRunCommand(item)}
              onMouseEnter={() => onSetActiveIndex(itemIndex)}
            >
              <span className="flex size-8 items-center justify-center rounded-[8px] border border-border bg-card text-muted-foreground">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium leading-5">{item.title}</span>
                <span className="block truncate text-[12px] leading-4 text-muted-foreground">
                  {item.subtitle}
                </span>
              </span>
              <span className="inline-flex max-w-[120px] items-center rounded-full border border-border bg-card px-2 py-0.5 text-[11px] leading-4 text-muted-foreground">
                <span className="truncate">{item.badge}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
