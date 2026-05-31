# Review Output Format

Use this structure for approved Safety OS reviews.

```text
Critical
- <must-fix issue with file/path evidence>

Major
- <should fix in this PR if in scope>

Minor
- <cleanup or polish>

Safe fixes
- <low-risk changes that can be applied without changing behavior>

Needs human decision
- <product/security/design/DB choice 승욱 must decide>

Design Pattern Issues
- Navigation / IA: <finding or none>
- List-detail flow: <finding or none>
- Table / filter / search: <finding or none>
- Drawer / modal usage: <finding or none>
- Form / save behavior: <finding or none>
- Status / permission pattern: <finding or none>
- Responsive / accessibility: <finding or none>

Recommended validation commands
- <command and reason>

Non-developer summary
<brief Korean explanation of what matters and current risk level>
```

## Evidence Rules

- Ground findings in inspected code, docs, test output, or explicit repo rules.
- Do not invent missing behavior.
- Mark assumptions clearly.
- If no issue is found in a category, say so briefly.
- Do not turn review into implementation unless 승욱 approved fixes.
