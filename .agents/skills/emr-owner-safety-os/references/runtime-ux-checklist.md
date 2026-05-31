# Runtime UX Checklist

Use after approval for workflow, screen, form, save, or user-facing state review.

## Core States

Check whether the touched flow handles:

- loading
- empty
- error
- permission denied
- network/server failure
- duplicate submit
- unsaved changes
- stale session or unauthorized route
- success confirmation
- partial failure or retry

## EMR-Specific Risks

- Chart save appears successful but data is not persisted.
- Order confirmation creates duplicate downstream work.
- Billing confirmation updates UI but not candidate/payment state.
- Patient/guardian search loses context after detail view.
- Permission-denied action is hidden when disabled-with-reason would be safer for workflow clarity.

## Review Questions

- Is the save mode clear: manual save, auto-save, draft, confirmed, or completed?
- Is the saving button disabled or guarded during pending mutation?
- Does the user know what failed and how to recover?
- Are destructive actions confirmed with clear object identity?
- Is the prior list/filter/tab context preserved after detail, drawer, modal, or route navigation?
- Does the flow remain usable on a smaller laptop viewport?

## Report Evidence

Classify missing states as:

- Critical: data loss, duplicate clinical/billing mutation, false success.
- Major: unclear recovery, lost work context, permission confusion.
- Minor: copy, polish, or affordance inconsistency.
