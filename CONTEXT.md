# Training Record Context

This app tracks daily training conversations, planned training items, and recorded training facts while keeping the web app authoritative for dates, plan completion, and audit decisions.

## Maintenance Map

- Use `docs/webapp-function-map.md` as the feature checklist before changing `index.html`.
- Use `docs/webapp-feature-coverage.json` as the machine-readable map from feature areas to regression tests.
- Run `node .agents/scripts/run-full-regression.js` after any app change that touches training capture, record protocol, plan reconciliation, UI layout, persistence, or the functional copy.

## Language

**Plan Item**:
A single exercise entry in the user's current training plan for a specific day.
_Avoid_: generic task, raw checklist row

**Training Fact**:
A user-stated fact about training actually performed, including exercise, date, amount, reps, duration, or completion status.
_Avoid_: AI write, model result

**Plan Reconciliation**:
The app-side comparison between a **Training Fact** and the day's **Plan Item** by exercise identity and planned dose.
_Avoid_: keyword matching, AI decision

**Explicit Completion Without Quantity**:
A **Training Fact** where the user clearly says a planned exercise is complete but does not state sets, reps, or duration.
_Avoid_: low confidence completion

**Extra Training**:
Performed training volume that does not count toward the remaining planned dose for a matching **Plan Item**.
_Avoid_: failed plan match

**Plan Dose Revision**:
A confirmed change to the planned sets, reps, or duration of a **Plan Item** after the user reports that the actually performed dose differs from the stored plan.
_Avoid_: silent plan correction, AI plan rewrite

**Dose Mismatch**:
A **Training Fact** whose per-set reps or duration differs from the matching **Plan Item**.
_Avoid_: extra training by default

**Pending Reconciliation**:
A stored app-side confirmation state created when a Training Fact needs the user to confirm planned dose or a Plan Dose Revision before the app writes final plan progress.
_Avoid_: hidden AI decision, temporary auto-check

## Relationships

- A **Training Fact** may reconcile with at most one **Plan Item** for its target date.
- **Plan Reconciliation** uses the day's plan snapshot as the source of truth for planned sets, reps, and duration.
- AI may suggest candidates, but **Plan Reconciliation** decides whether a **Training Fact** completes, partially progresses, or exceeds a **Plan Item**.
- If a user reports more volume than the matching **Plan Item** requires, the planned portion completes the **Plan Item** and the surplus becomes **Extra Training**.
- If the user gives no quantity but uses an explicit completion phrase, the app should ask for missing dose detail instead of silently checking the item unless product rules explicitly allow that shortcut.
- A **Dose Mismatch** should ask the user whether to revise the plan before checking the **Plan Item**.
- After a confirmed **Plan Dose Revision**, the app updates the planned dose, checks the planned portion as complete, and records surplus volume as **Extra Training**.
- A **Plan Dose Revision** applies to the target day's plan snapshot by default; the reusable weekly plan template changes only when the user explicitly asks future plans to change.
- User rejection of a **Plan Dose Revision** keeps the **Plan Item** unchecked and stores the reported work as actual training only.
- **Pending Reconciliation** must be cleared after confirmation, rejection, or expiry.

## Example Dialogue

> **User:** "今天计划是全身拉伸 2组 每组60秒，我完成了3组。"
> **Domain expert:** "Count 2 groups toward the Plan Item, mark it complete, and record 1 extra group as Extra Training."

> **User:** "今天计划是全身拉伸 3组 每组60秒，我完成了4组拉伸，每组45秒。"
> **Domain expert:** "Ask whether to revise the Plan Item to 3 groups at 45 seconds. If confirmed, complete the revised Plan Item and record 1 extra 45-second group as Extra Training."

## Flagged Ambiguities

- "完成了 X" without quantity is ambiguous: resolved for now as requiring a follow-up question rather than silently checking the plan item.
- "修改计划 JSON" scope resolved: default to the target day's plan snapshot; change the reusable weekly plan template only on explicit future-template language.
