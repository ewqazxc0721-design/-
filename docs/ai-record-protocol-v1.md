# AI Record Protocol v1

AI Record Protocol v1 lets chat identify possible training records without giving the model authority to mutate final app state.

## Envelope

The model output is an envelope with visible reply text and hidden candidates:

```json
{
  "reply": "Recorded: squat completed 1 set.",
  "record_candidates": [
    {
      "candidateType": "plan_progress",
      "confidence": 0.94,
      "evidenceText": "today I completed 1 set of squats",
      "targetDateText": "today",
      "dateSource": "explicit",
      "exerciseRef": {
        "type": "mentioned",
        "displayName": "squat"
      },
      "amount": 1,
      "unit": "set",
      "writeIntent": "auto"
    }
  ]
}
```

AI output is not a daily log. It is only candidate evidence.

## Supported Candidates

v1 supports exactly these candidate types:

- `plan_progress`
- `correction`
- `extra_training`
- `feedback`
- `body_state`
- `note`
- `consultation_request`

Unknown candidate types are ignored rather than written.

## Public Interface

```ts
type RecordProtocolEngineInput = {
  protocolOutput: RecordProtocolOutput;
  context: RecordResolutionContext;
  currentState: {
    dailyLogs: DailyLogs;
    visibleWeekDates: VisibleWeekDate[];
    activeTrainingPlanSnapshot?: TrainingPlanSnapshot;
    captureAttempts?: CaptureAttempt[];
  };
  confirmedCandidateIds?: string[];
};

type RecordProtocolEngineResult = {
  nextState: {
    dailyLogs: DailyLogs;
    captureAttempts: CaptureAttempt[];
  };
  decisions: Array<{
    candidateId: string;
    decision: "written" | "pending" | "ignored";
    reason: string;
    writtenRecordId?: string;
    targetDateIso?: string;
  }>;
  assistantFollowUp?: string;
};

function applyRecordProtocol(input: RecordProtocolEngineInput): RecordProtocolEngineResult;
```

## Date Authority

`targetDateIso` from AI is advisory only. The app resolves dates from `targetDateText`, `todayIso`, timezone context, and `visibleWeekDates`.

For example, if AI returns `targetDateText: "周六"` and `targetDateIso: "2026-05-10"`, but the visible week maps `周六` to `2026-05-16`, the engine must use `2026-05-16`.

## Write Policy

The engine applies the v1 policy before writing:

- missing evidenceText: ignored, never auto-written
- `consultation_request`: ignored
- `correction`: pending by default
- confidence below the write threshold: pending
- `writeIntent: "ignore"`: ignored
- `needsConfirmation: true`: pending
- otherwise, high-confidence evidenced candidates may be written

Written records keep a stable `recordId` and an `aiCapture` reference. `aiCapture` stores only lightweight audit fields such as attempt id, candidate id, evidence text, and confidence. Full raw chat text is not copied into written records.

## Correction

All `correction` candidates enter pending first. A confirmed `move_record_to_date` can move a referenced record from its previous date to the newly resolved date while preserving auditability through the original record id or move metadata.

## Final Regression Checklist

The final public-interface tests must cover:

- high-confidence plan_progress writes to the resolved date
- missing evidenceText does not auto-write
- `visibleWeekDates` overrides a wrong AI `targetDateIso`
- all correction candidates enter pending
- confirmed move_record_to_date migrates the referenced record
- CaptureAttempt is appended
- written records contain aiCapture references

These tests should call `applyRecordProtocol(input)` and assert `decisions`, `nextState.dailyLogs`, and `nextState.captureAttempts`, rather than asserting internal helper calls.
