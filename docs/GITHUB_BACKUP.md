# GitHub/native Git backup and restore

Nodepad serializes Markdown with YAML frontmatter, JSON manifests/indexes and NDJSON edges/events. Secret-named fields are recursively removed and credential signatures are checked. Runtime repositories are ignored.

The initial `BackupRemote` is a local, non-force-pushing Git adapter suitable for a checked-out GitHub repository. It commits only when dirty and returns the SHA. Point `NODEPAD_BACKUP_REPO` at that clone. Tokens remain process configuration and never enter snapshots/client code.

Restore reads a selected ref, checks schema version, validates the graph, and saves to a new staging workspace by default. Current state is untouched on failure. Schema version 1 provides the migration boundary.
