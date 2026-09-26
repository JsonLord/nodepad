# Controlled local CLI agents

Local execution is selected only by an `AgentProfile` containing a `commandProfileId`. The referenced command is loaded from the server-side `NODEPAD_CLI_PROFILES_FILE`; browser data can never provide an executable or arguments. Processes are launched with `spawn(executable, fixedArgs, {shell:false})` and receive one structured JSON request on stdin. Status, artifact, input, and result messages use bounded JSONL on stdout; stderr is diagnostic-only.

Command profiles define a working-directory policy (`none`, `project_repository`, `isolated_temp`, or `configured_root`), an explicit environment allowlist, timeout, termination grace, and concurrency. Filesystem-backed directories are canonicalized through `realpath`; configured-root resolution rejects traversal and symlink escapes. Nodepad does not inherit its full environment.

The adapter tracks only child processes it created. Cancellation sends `SIGTERM` and timeout handling may use `SIGKILL` after the configured bounded grace period. It never accepts or kills a browser-supplied PID. Direct children are not durable: after a Nodepad restart, a run without an owned process reconciles as `interrupted` rather than pretending recovery comparable to AGTX or HTTP.
