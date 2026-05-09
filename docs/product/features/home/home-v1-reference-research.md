---
id: "HOME-V1-REFERENCE-RESEARCH"
status: draft
area: product
doc_type: reference-research
related_docs:
  - "docs/product/features/home/home-command-entry-planning.md"
  - "docs/product/features/home/home-work-generation-rules-v0.md"
  - "docs/product/features/home/home-v1-epic-plan.md"
last_updated: "2026-05-09"
---

# Home v1 Reference Research

## Purpose

This document records reference research for the Home v1 work-entry UI before implementation.

Scope:

- Public official docs, help centers, and product pages.
- Task/work entry, personal work lists, role queues, assignment, empty state, flow summary, and notification boundary patterns.
- This is not a pixel-level visual reference. It is an interaction and information-architecture reference.

## Product Question

Home v1 should answer:

> 오늘/지금 내가 뭘 해야 하지?

The reference research focuses on products that separate:

- personal assigned work
- team/role queues
- notification feeds
- operational dashboards

## References Reviewed

### Asana My Tasks

Sources:

- https://asana.com/resources/asana-tips-my-tasks
- https://asana.com/features/project-management/my-tasks

Observed patterns:

- `My Tasks` is positioned as a home base for tasks assigned to the user.
- Assigned tasks can be organized into Today, Upcoming, Later, and custom sections.
- New assigned work is separated from work that is due soon.
- Due dates and action-oriented task titles are emphasized.
- Inbox is treated as a coordination surface separate from My Tasks.

Use for CLAiR Home:

- Treat Home `내 업무` as assigned/requested work, not all visible information.
- Use due/urgent/overdue sorting and compact sections or filters.
- Keep notifications separate from actionable My Work.

Do not copy:

- Do not turn Home into a full personal task manager with arbitrary custom sections in v1.
- Do not add drag/drop task planning to Home v1.

### Todoist Today And Filters

Sources:

- https://get.todoist.help/hc/en-us/articles/360006365600-Default-sorting-order-in-Todoist
- https://www.todoist.com/help/articles/introduction-to-filters-V98wIH

Observed patterns:

- Today/Upcoming views are sorted by date/time, priority, deadline, and creation order.
- Filters can isolate overdue, today, high priority, assigned-to-me, and unassigned work.
- Completed tasks are not part of active filter views.

Use for CLAiR Home:

- Quick Status chips should behave like simple filters: urgent, due today, overdue, unassigned queue.
- Home should show active work, not completed work.
- Sorting should be deterministic and easy to explain.

Do not copy:

- Do not expose complex filter query logic to clinical users.
- Do not make users configure filters to get a usable default Home.

### Jira Service Management Queues

Source:

- https://support.atlassian.com/jira-service-management-cloud/docs/check-out-your-queues/

Observed patterns:

- Customer requests become work items organized into queues.
- Queues support quick view, triage, and assignment.
- Queue rows expose high-level information such as summary, status, and customer.
- Queues are often sorted by SLA or service goals.

Use for CLAiR Home:

- Keep original module work lists as source-of-truth group queues.
- Use Home as an entry surface into those queues, not a replacement for them.
- Role queue work can be summarized or shown as work, but assignment state belongs to the source workflow.

Do not copy:

- Do not make Home a full queue management screen.
- Do not expose SLA machinery in v1 unless a domain threshold is already defined.

### Intercom Inbox Assignment

Sources:

- https://www.intercom.com/help/en/articles/6561699-assign-conversations-to-teammates-and-teams
- https://www.intercom.com/help/en/articles/6553774-balanced-assignment-deep-dive

Observed patterns:

- Work can be assigned to a team inbox or to a specific teammate.
- Assigning to a team removes teammate assignment so work can be picked up from the team inbox.
- Inbox views expose teammate and team assignment.
- Balanced assignment prioritizes priority, SLA proximity, and longest waiting work, with workload limits.

Use for CLAiR Home:

- Model unassigned role work separately from personal assigned work.
- After claim in source workflow, the task should remain in group list with assignee/status but leave other users' Home My Work.
- Show assignment status in original group work lists.

Do not copy:

- Do not implement automatic workload balancing in Home v1.
- Do not let Home become the place where staff claim work.

### Zendesk Views

Source:

- https://support.zendesk.com/hc/en-us/articles/4408883609370-Lesson-2-Organizing-tickets-and-users

Observed patterns:

- The same ticket can appear in multiple views if it matches multiple criteria.
- Views can be shared, restricted to groups, or personal.

Use for CLAiR Home:

- Separate personal Home My Work from module group work lists.
- Allow the same source work to appear in group views while Home shows only actionably relevant work.

Do not copy:

- Do not make every matching view equal in priority on Home.
- Avoid confusing duplicate action cards after a task is claimed by someone else.

### Microsoft Teams Activity Feed

Sources:

- https://support.microsoft.com/en-gb/office/explore-the-activity-feed-in-microsoft-teams-91c635a1-644a-4c60-9c98-233db3e13a56
- https://learn.microsoft.com/en-us/graph/teams-activity-feed-notifications-best-practices

Observed patterns:

- Activity feed is a separate notification surface.
- Notifications can be filtered and marked read.
- Notification types have symbols that help users prioritize.
- Toasts route users to the notification feed before the associated activity.

Use for CLAiR Home:

- Keep global notification outside Home.
- Allow notifications to link to actionable work without making every notification a Home task.
- Use notification type and read state in the future notification feature, not in Home v1.

Do not copy:

- Do not represent the notification feed as a large Home panel.
- Do not rely on notifications as the primary work queue.

### IDEXX Neo Veterinary Software

Source:

- https://software.idexx.com/products/neo/features

Observed patterns:

- Practice dashboard combines overdue invoices, reminders due, draft invoices, remaining appointments, search, and a task list.
- Task list includes daily callbacks and diagnostic results.
- Patient workflow emphasizes one-click access to patient history and diagnostics.

Use for CLAiR Home:

- Keep power search and task list ideas.
- Diagnostic result follow-up can be a work item when completed or explicitly requested.
- One-click entry to patient/workflow context is important.

Do not copy:

- Do not mix business snapshot, invoices, reminders, and diagnostics into one staff Home by default.
- Do not make Home a practice management KPI dashboard.

### ezyVet / Vet Radar Workflow Tasks

Source:

- https://docs.ezyvet.com/en/browse-documentation/vet-radar/workflow-whiteboard/workflow-tasks/about-workflows

Observed patterns from public search excerpts:

- Workflow tasks are sequenced checks that staff complete before a patient moves through care.
- Workflow tasks are visible in workflow whiteboard and patient sheet.
- Completion records the date and time.

Use for CLAiR Home:

- Keep source workflow screens authoritative for completion.
- Home should route users to the original workflow where the task belongs.
- Patient context should remain attached to work.

Do not copy:

- Do not let Home become the final completion surface for clinical workflow tasks.

## Design Implications For Home v1

### Use

- Default to My Work, not a role dashboard.
- Show active work only.
- Use simple filters: urgent, due today, overdue, unassigned queue, domain.
- Keep original module queues as the source of truth for role/group work.
- Make assignment state visible in module group lists.
- Keep notification as a separate top-right app-level feature.
- Provide compact entry actions in empty state.

### Avoid

- Full operational dashboard on default Home.
- Business snapshot KPIs in staff Home.
- Full queue management inside Home.
- Claim/complete/finalize actions on Home.
- Automatic clinical critical task generation from abnormal values.
- Complex user-configured filter syntax.
- Large notification panel inside Home.

## Reference-Informed UI Checklist

- Can a user understand their next action without reading hospital-wide dashboard data?
- Are personal tasks and role queue tasks visually distinguishable?
- Does unassigned role work have a clear source workflow entry?
- After claim, does the task leave other same-role users' Home but remain in the source group list?
- Is notification visibly treated as a separate app-level channel?
- Does empty state provide entry points without becoming another dashboard?
- Are clinical abnormal values surfaced in source clinical screens rather than auto-escalated on Home?

