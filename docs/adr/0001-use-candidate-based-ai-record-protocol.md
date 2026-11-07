# ADR 0001: Use Candidate-Based AI Record Protocol

## Status

Accepted.

## Context

Role chat can notice training facts in natural conversation, but the model is not a trusted source for final app state. In particular, weekday text such as "Saturday" or "周六" can be paired with a wrong ISO date by the model. If the app accepts that date directly, records can land on the wrong day and later corrections become hard to audit.

The app also needs a stable way to explain why a candidate was written, ignored, or held for confirmation. That audit trail must be light enough for app state, without storing full raw chat transcripts in daily records.

## Decision

Use a candidate-based AI record protocol.

AI does not write final daily logs. AI returns only a chat `reply` plus `record_candidates`. The web app adapts that envelope into the v1 protocol, then sends it through `RecordProtocolEngine`.

`RecordProtocolEngine` is the authority for:

- validating candidate fields and confidence
- resolving dates from `targetDateText`, `todayIso`, timezone context, and `visibleWeekDates`
- treating AI `targetDateIso` as advisory only
- deciding `written`, `pending`, or `ignored`
- keeping all `correction` candidates pending until confirmation
- applying confirmed `move_record_to_date` corrections
- writing daily log records
- appending `CaptureAttempt` audit entries
- storing lightweight `aiCapture` references on written records

## Consequences

The model can stay flexible in conversation while the app keeps deterministic ownership of storage, dates, confirmation, correction, and audit behavior.

Future changes must preserve this trust boundary. New AI prompts may improve candidate quality, but they must not ask the model to output final daily logs or arbitrary state patches.
