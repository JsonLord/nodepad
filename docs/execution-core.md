# Provider-neutral execution core

Nodepad keeps execution records in the control plane, separate from the canonical `Workspace` / `Entity` / `Edge` work graph. A delegation is authorized against its persisted routing decision before an executable adapter may create an external run.

`ExecutionAdapter` is the provider boundary. The executable registry recognizes `agtx`, `http`, and `local_cli`; an adapter must also be registered and enabled by server policy. `openai_compatible` remains a Laya decision provider and `hermes` remains a supervisor, so neither can be selected for execution.

The shared lifecycle persists `ExternalRun`, `ExecutionEvent`, and reference-only `ExecutionArtifact` records. Provider-native status remains in `providerStatus` and metadata while the adapter returns a provider-neutral status. Artifacts are never downloaded implicitly. Existing AGTX identities stored on delegations are migrated into `external_runs` and are also recovered lazily for compatibility with partially upgraded databases.

Dispatch is idempotent by delegation: a persisted run is returned rather than submitted again. Reconciliation can resume from SQLite after process restart. A provider outage moves active work to `waiting_for_agent`; it does not falsely mark external work failed. Cancellation is capability-driven and returns `CANCELLATION_NOT_SUPPORTED` when the adapter has no supported cancellation operation.
