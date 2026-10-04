#!/usr/bin/env python3
"""Validate a product-eval investigation scope against DATA-CONTRACT.md.

This is the optional, deterministic form of the "Validation (preflight conformance
check)" section of DATA-CONTRACT.md. The skills apply the same checks by hand on
every read; this script lets a team run them mechanically (in CI, a pre-commit hook,
or ad hoc) so a malformed write fails loudly instead of degrading downstream.

Usage:
    python scripts/validate_scope.py .product-eval/<scope>/

Exit codes: 0 = conformant, 1 = violations found, 2 = could not run (e.g. PyYAML
missing or path not found). Requires PyYAML (`python3 -m pip install -r scripts/requirements.txt`).
"""
import sys
import os

try:
    import yaml
except ModuleNotFoundError:
    print(
        "ERROR: this validator needs PyYAML. Install it with: "
        "python3 -m pip install -r scripts/requirements.txt",
        file=sys.stderr,
    )
    sys.exit(2)

SOURCE_TYPES = {
    # DATA-CONTRACT taxonomy
    "product_analytics", "support_ticket", "sales_call", "churn_survey",
    "customer_interview", "internal_observation", "feature_request", "app_review",
    "community_post", "competitor_analysis", "market_research",
    # extras defined in evidence-quality.md
    "internal_data", "social_media", "blog_or_article",
}
VERDICTS = {"Decide now", "Run a research sprint", "Do not commit yet", "Deprioritize"}
EVENTS = {"readiness", "override", "critique", "drift", "doc"}


def band(x):
    return "low" if x < 40 else ("moderate" if x <= 69 else "high")


def expected_recommendation(value, confidence):
    if value < 40:
        return "Deprioritize"
    if confidence >= 70:
        return "Decide now"
    if confidence >= 40:
        return "Run a research sprint"
    return "Do not commit yet"


class Report:
    def __init__(self):
        self.errors = []

    def err(self, where, msg):
        self.errors.append((where, msg))

    def ok(self):
        return not self.errors


def load_front_matter(path):
    """Return the YAML front-matter dict of a markdown file (between the first two ---)."""
    text = open(path, encoding="utf-8").read()
    if not text.lstrip().startswith("---"):
        return None
    body = text.split("---", 2)
    if len(body) < 3:
        return None
    return yaml.safe_load(body[1]) or {}


def load_yaml_list(path):
    """Load a markdown file whose body is a YAML list (comments and headings ignored)."""
    data = yaml.safe_load(open(path, encoding="utf-8").read())
    return data if isinstance(data, list) else []


def validate(scope_dir):
    r = Report()
    scope = scope_dir.rstrip("/")
    p = lambda *a: os.path.join(scope, *a)

    # ---- context.md ----
    ctx_path = p("context.md")
    if not os.path.exists(ctx_path):
        r.err("context.md", "missing")
    else:
        fm = load_front_matter(ctx_path)
        if not fm:
            r.err("context.md", "no YAML front-matter")
        else:
            for k in ("scope", "job", "stage"):
                if k not in fm:
                    r.err("context.md", f"missing required key '{k}'")

    # ---- identities.md (optional) ----
    entities = set()
    id_path = p("identities.md")
    if os.path.exists(id_path):
        for e in load_yaml_list(id_path):
            if isinstance(e, dict) and e.get("entity"):
                entities.add(e["entity"])

    # ---- evidence/*.md ----
    ev_dir = p("evidence")
    ev_ids = set()
    ev_weight = {}  # id -> weight
    ev_refs = {}  # id -> set of referenced ids (corroborated_by + contradicts)
    if not os.path.isdir(ev_dir):
        r.err("evidence/", "missing directory")
    else:
        for fn in sorted(os.listdir(ev_dir)):
            if not fn.endswith(".md"):
                continue
            where = f"evidence/{fn}"
            fm = load_front_matter(os.path.join(ev_dir, fn))
            if not fm:
                r.err(where, "no YAML front-matter")
                continue
            for k in ("id", "claim", "source_type", "strength", "weight", "stale"):
                if k not in fm:
                    r.err(where, f"missing required key '{k}'")
            eid = fm.get("id")
            if eid:
                if eid in ev_ids:
                    r.err(where, f"duplicate id '{eid}'")
                ev_ids.add(eid)
                if fn != f"{eid}.md":
                    r.err(where, f"id '{eid}' does not match filename")
            st = fm.get("source_type")
            if st is not None and st not in SOURCE_TYPES:
                r.err(where, f"unknown source_type '{st}'")
            strg = fm.get("strength")
            if not (isinstance(strg, int) and 1 <= strg <= 5):
                r.err(where, f"strength must be an int 1..5, got {strg!r}")
            wt = fm.get("weight")
            if not (isinstance(wt, (int, float)) and wt >= 0):
                r.err(where, f"weight must be a number >= 0, got {wt!r}")
            elif eid:
                ev_weight[eid] = wt
            rd = fm.get("recency_days")
            if rd is not None and not (isinstance(rd, int) and rd >= 0):
                r.err(where, f"recency_days must be a non-negative int, got {rd!r}")
            if not isinstance(fm.get("stale"), bool):
                r.err(where, f"stale must be a boolean, got {fm.get('stale')!r}")
            refs = set()
            for key in ("corroborated_by", "contradicts"):
                for ref in (fm.get(key) or []):
                    refs.add(ref)
            ev_refs[eid] = refs
            for key in ("person_id", "account_id"):
                val = fm.get(key)
                if val not in (None, "null") and entities and val not in entities:
                    r.err(where, f"{key} '{val}' not in identities.md")
        # resolve evidence cross-refs now that all ids are known
        for eid, refs in ev_refs.items():
            for ref in refs:
                if ref not in ev_ids:
                    r.err(f"evidence/{eid}.md", f"references unknown evidence id '{ref}'")

    # ---- themes.md ----
    theme_ids = set()
    theme_conf = {}
    th_path = p("themes.md")
    if not os.path.exists(th_path):
        r.err("themes.md", "missing")
    else:
        for t in load_yaml_list(th_path):
            if not isinstance(t, dict):
                continue
            tid = t.get("id")
            where = f"themes.md[{tid}]"
            if not tid:
                r.err("themes.md", "theme missing 'id'")
                continue
            if tid in theme_ids:
                r.err(where, "duplicate theme id")
            theme_ids.add(tid)
            if not t.get("name"):
                r.err(where, "missing 'name'")
            members = t.get("members") or []
            if not members:
                r.err(where, "empty 'members'")
            for m in members:
                if m not in ev_ids:
                    r.err(where, f"member '{m}' is not a real evidence id")
            tw = t.get("total_weight")
            if isinstance(tw, (int, float)) and members and all(m in ev_weight for m in members):
                member_sum = sum(ev_weight[m] for m in members)
                if abs(member_sum - tw) > 1:
                    r.err(where, f"total_weight {tw} != sum of member weights {member_sum} (tolerance +/-1)")
            conf = t.get("confidence")
            cb = t.get("confidence_band")
            if conf is not None:
                theme_conf[tid] = conf
                if cb and band(conf) != cb:
                    r.err(where, f"confidence_band '{cb}' inconsistent with confidence {conf} (expected {band(conf)})")
            for c in (t.get("contradictions") or []):
                if c not in ev_ids:
                    r.err(where, f"contradiction '{c}' is not a real evidence id")
            for stype in (t.get("source_types") or []):
                if stype not in SOURCE_TYPES:
                    r.err(where, f"unknown source_type '{stype}'")

    # ---- scores.md ----
    sc_path = p("scores.md")
    if os.path.exists(sc_path):
        for s in load_yaml_list(sc_path):
            if not isinstance(s, dict):
                continue
            prob = s.get("problem")
            where = f"scores.md[{prob}]"
            if prob not in theme_ids:
                r.err(where, f"problem '{prob}' has no matching theme")
            value = s.get("value")
            conf = s.get("confidence")
            if not (isinstance(value, (int, float)) and 0 <= value <= 100):
                r.err(where, f"value out of range: {value!r}")
            if not (isinstance(conf, (int, float)) and 0 <= conf <= 100):
                r.err(where, f"confidence out of range: {conf!r}")
            vi = s.get("value_inputs") or {}
            if vi:
                tot = sum(vi.get(k, 0) for k in ("persona", "funnel", "frequency", "competitive"))
                if isinstance(value, (int, float)) and tot != value:
                    r.err(where, f"value_inputs sum to {tot}, but value is {value}")
            vb, cb = s.get("value_band"), s.get("confidence_band")
            if isinstance(value, (int, float)) and vb and band(value) != vb:
                r.err(where, f"value_band '{vb}' inconsistent with value {value} (expected {band(value)})")
            if isinstance(conf, (int, float)) and cb and band(conf) != cb:
                r.err(where, f"confidence_band '{cb}' inconsistent with confidence {conf} (expected {band(conf)})")
            if prob in theme_conf and conf is not None and theme_conf[prob] != conf:
                r.err(where, f"confidence {conf} disagrees with themes.md value {theme_conf[prob]} (one source of truth)")
            rec = s.get("recommendation")
            if rec not in VERDICTS:
                r.err(where, f"recommendation '{rec}' not in the four-verdict vocabulary")
            elif isinstance(value, (int, float)) and isinstance(conf, (int, float)) and not s.get("override"):
                exp = expected_recommendation(value, conf)
                if rec != exp:
                    r.err(where, f"recommendation '{rec}' disagrees with matrix '{exp}' for value={value}, confidence={conf}")
            ov = s.get("override")
            if ov not in (None,) and not (isinstance(ov, dict) and {"field", "to", "reason"} <= set(ov)):
                r.err(where, "override must be null or {field, to, reason}")

    # ---- decisions-log.md ----
    dl_path = p("decisions-log.md")
    if os.path.exists(dl_path):
        for d in load_yaml_list(dl_path):
            if not isinstance(d, dict):
                continue
            where = f"decisions-log.md[{d.get('item')}]"
            for k in ("date", "item", "event", "verdict"):
                if k not in d:
                    r.err(where, f"missing required key '{k}'")
            if d.get("verdict") and d["verdict"] not in VERDICTS:
                r.err(where, f"verdict '{d['verdict']}' not in vocabulary")
            if d.get("event") and d["event"] not in EVENTS:
                r.err(where, f"event '{d['event']}' not in {sorted(EVENTS)}")
            cb = d.get("confidence_band")
            conf = d.get("confidence")
            if isinstance(conf, (int, float)) and cb and band(conf) != cb:
                r.err(where, f"confidence_band '{cb}' inconsistent with confidence {conf}")
            for key in ("evidence", "contested"):
                for ref in (d.get(key) or []):
                    if ref not in ev_ids:
                        r.err(where, f"{key} references unknown evidence id '{ref}'")
            outcome = d.get("outcome")
            if isinstance(outcome, dict):
                pwr = outcome.get("problem_was_real")
                if pwr is not None and pwr not in ("confirmed", "refuted", "partial"):
                    r.err(where, f"outcome.problem_was_real '{pwr}' not in confirmed/refuted/partial")
                so = outcome.get("solution_outcome")
                if so is not None and so not in ("succeeded", "failed", "mixed"):
                    r.err(where, f"outcome.solution_outcome '{so}' not in succeeded/failed/mixed")

    return r


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(2)
    scope_dir = sys.argv[1]
    if not os.path.isdir(scope_dir):
        print(f"ERROR: not a directory: {scope_dir}", file=sys.stderr)
        sys.exit(2)
    r = validate(scope_dir)
    if r.ok():
        print(f"OK: {scope_dir} conforms to DATA-CONTRACT.md")
        sys.exit(0)
    print(f"FAIL: {len(r.errors)} violation(s) in {scope_dir}\n", file=sys.stderr)
    for where, msg in r.errors:
        print(f"  {where}: {msg}", file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    main()
