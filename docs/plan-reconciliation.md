# Plan Reconciliation

Plan Reconciliation is the app-side process that compares an AI-captured or locally captured Training Fact with the target day's Plan Item snapshot.

The AI can only propose candidates. The web app remains authoritative for dates, plan matching, dose comparison, write decisions, confirmations, and audit entries.

## Domain Rules

- If the user says `我完成了X` without sets, reps, or duration, do not silently check the item. If `X` uniquely matches a Plan Item for the target day, ask whether it was completed according to the planned dose.
- If the reported amount equals the plan and the per-set dose matches, record Plan Progress and check the Plan Item.
- If the reported amount is lower than the plan and the per-set dose matches, record partial Plan Progress and do not check the Plan Item.
- If the reported amount is higher than the plan and the per-set dose matches, check the planned portion and record the surplus as Extra Training.
- If the reported amount is higher than the plan and the user omits per-set dose, inherit the plan dose for the planned portion and the surplus.
- If the reported per-set reps or duration conflicts with the Plan Item, enter pending confirmation. Do not modify the plan, check the item, or write a final record yet.
- If the user confirms a dose revision, update only the target day's daily-log plan snapshot, then check the revised planned portion and record surplus Extra Training.
- If the user rejects a dose revision, keep the plan snapshot unchanged, do not check the item, and save the user-reported work as actual training only.
- Explicit extra-training language such as `加练`, `额外`, `多做`, or `另外` stays Extra Training and must not steal plan progress.
- Global weekly plan templates are not changed unless the user explicitly asks for future plans to change.

## Decision Interface

The shared decision seam is:

```js
reconcileTrainingFactWithPlan({
  fact,
  dateIso,
  dailyLog,
  activeTrainingReference,
  pendingReconciliation
})
```

It returns one of:

- `ask_planned_dose_confirmation`
- `plan_progress`
- `plan_progress_with_extra`
- `partial_plan_progress`
- `dose_revision_pending`
- `apply_dose_revision`
- `actual_training_only`
- `no_match`
- `ambiguous`

Each decision carries a machine-readable reason and, when user input is required, a user-facing prompt.

## Issue Breakdown

1. **Document Plan Reconciliation Rules**
   - Type: AFK
   - Blocked by: None
   - Acceptance: this document exists, `CONTEXT.md` contains the domain terms, and ADR-0001 trust boundary remains intact.

2. **Pure Reconciliation Decision Layer**
   - Type: AFK
   - Blocked by: Issue 1
   - Acceptance: tests cover no-quantity completion, equal/partial/surplus same-dose completion, and dose mismatch pending without hard-coded action names.

3. **Write Plan Progress And Surplus Extra Training**
   - Type: AFK
   - Blocked by: Issue 2
   - Acceptance: surplus is split from plan progress, under-completion stays partial, and misclassified AI extra-training can still reconcile with plan progress.

4. **Dose Revision Confirmation Flow**
   - Type: AFK
   - Blocked by: Issues 2 and 3
   - Acceptance: mismatch waits for confirmation; confirm updates only the daily snapshot, checks the planned portion, and records surplus; reject saves actual training only.

5. **Unified Entrypoints And Diagnose Matrix**
   - Type: AFK
   - Blocked by: Issues 2, 3, and 4
   - Acceptance: Record Protocol, local fallback, active session, and chat confirmation share the reconciliation result; matrix tests cover wrong AI type/date, missing fields, context confirmation, dose units, and functional-copy parity.

## Diagnostic Matrix

Use fixed samples across:

- Actions: full-body stretch, plank, squat, dumbbell curl, walking, and one non-hard-coded action-library exercise.
- Plan doses: set-only, reps-only, duration-only, sets plus per-set reps, sets plus per-set seconds.
- User facts: no quantity, below plan, equal plan, surplus, per-set mismatch, explicit extra.
- Entrypoints: AI JSON candidate, local fallback, wrong candidate type, active session, and pending chat reply.

For every combination, assert whether the app writes pending state, checks a Plan Item, modifies only the daily snapshot, records Extra Training, and leaves the weekly template untouched.
