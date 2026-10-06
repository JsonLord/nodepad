# GitHub/native Git backup and restore

Nodepad serializes Markdown with YAML frontmatter, JSON manifests/indexes and NDJSON edges/events. Secret-named fields are recursively removed and credential signatures are checked. Runtime repositories are ignored.

Two `BackupRemote` implementations are available. `LocalGitBackup` remains the test/development backend. `GitHubBackupRemote` uses GitHub's REST Git data API with `NODEPAD_GITHUB_TOKEN`, `NODEPAD_GITHUB_REPOSITORY`, `NODEPAD_GITHUB_BRANCH`, and `NODEPAD_GITHUB_PATH`. It creates the configured branch when allowed, writes one tree/commit per dirty snapshot, and never sends the server token in workspace content.

Remote writes use compare-before-update safety: read the branch head, build against that exact parent, read the head again, and update the ref with `force: false` only when it is unchanged. Head movement or a rejected non-fast-forward returns `sync_conflict`; Nodepad does not overwrite, force-push, or destructively retry. Restore and snapshot listing accept commit/ref SHAs through GitHub's API.

Restore reads a selected ref, checks schema version, validates the graph, and saves to a new staging workspace by default. Current state is untouched on failure. Schema version 1 provides the migration boundary.
