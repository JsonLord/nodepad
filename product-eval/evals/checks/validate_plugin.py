#!/usr/bin/env python3
"""Validate product-eval plugin source, evals, and packaged artifact."""

from __future__ import annotations

import json
import re
import sys
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PACKAGE = ROOT / "product-eval.plugin"
PARENT_PACKAGE = ROOT.parent / "product-eval.plugin"
CLAUDE_MANIFEST = ROOT / ".claude-plugin" / "plugin.json"
CLAUDE_MARKETPLACE = ROOT / ".claude-plugin" / "marketplace.json"
CODEX_MANIFEST = ROOT / ".codex-plugin" / "plugin.json"
EXCLUDED_PATH_PREFIXES = (
    "skills/critique/",
    "evals/trigger/critique.json",
    "evals/checks/validate_plugin.py",
)
IGNORED_SOURCE_NAMES = {".DS_Store", "product-eval.plugin"}
LEGACY_PM_PATHS = (
    ".pm/context",
    ".pm/sources",
    ".pm/evidence",
    ".pm/identities",
    ".pm/themes",
    ".pm/scores",
    ".pm/decisions-log",
    ".pm/snapshots",
)
ALLOWED_FRONTMATTER = {"name", "description", "license", "allowed-tools", "metadata"}


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def load_json(path: Path):
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except Exception as exc:  # noqa: BLE001 - validation script should report exact file.
        fail(f"invalid JSON in {path.relative_to(ROOT)}: {exc}")


def read_archive_json(archive: zipfile.ZipFile, path: str):
    try:
        return json.loads(archive.read(path))
    except Exception as exc:  # noqa: BLE001 - package validator should report exact file.
        fail(f"packaged {path} missing or invalid: {exc}")


def manifest_identity(payload: dict, label: str) -> tuple[str, str]:
    name = payload.get("name")
    version = payload.get("version")
    if not isinstance(name, str) or not name.strip():
        fail(f"{label} missing name")
    if not isinstance(version, str) or not version.strip():
        fail(f"{label} missing version")
    return name, version


def marketplace_entry(payload: dict, label: str, expected_name: str) -> dict:
    plugins = payload.get("plugins")
    if not isinstance(plugins, list) or not plugins:
        fail(f"{label} missing plugins array")
    for entry in plugins:
        if isinstance(entry, dict) and entry.get("name") == expected_name:
            return entry
    if len(plugins) == 1 and isinstance(plugins[0], dict):
        return plugins[0]
    fail(f"{label} missing plugin entry for {expected_name!r}")


def validate_identity(label: str, name: str, version: str, expected_name: str, expected_version: str) -> None:
    if name != expected_name:
        fail(f"{label} name mismatch: {name!r} != {expected_name!r}")
    if version != expected_version:
        fail(f"{label} version mismatch: {version!r} != {expected_version!r}")


def validate_json() -> None:
    for path in sorted((ROOT / "evals").rglob("*.json")):
        load_json(path)


def validate_manifest_identity() -> None:
    if not CODEX_MANIFEST.exists():
        fail("missing .codex-plugin/plugin.json")

    claude_manifest = load_json(CLAUDE_MANIFEST)
    codex_manifest = load_json(CODEX_MANIFEST)
    marketplace = load_json(CLAUDE_MARKETPLACE)

    expected_name, expected_version = manifest_identity(
        claude_manifest, ".claude-plugin/plugin.json"
    )
    if ROOT.name != expected_name:
        fail(f"plugin folder name {ROOT.name!r} does not match manifest name {expected_name!r}")

    codex_name, codex_version = manifest_identity(codex_manifest, ".codex-plugin/plugin.json")
    validate_identity(
        ".codex-plugin/plugin.json",
        codex_name,
        codex_version,
        expected_name,
        expected_version,
    )

    entry = marketplace_entry(
        marketplace, ".claude-plugin/marketplace.json", expected_name
    )
    entry_name = entry.get("name")
    entry_version = entry.get("version")
    validate_identity(
        ".claude-plugin/marketplace.json plugin entry",
        entry_name,
        entry_version,
        expected_name,
        expected_version,
    )


def validate_route_coverage() -> None:
    skills = sorted(path.parent.name for path in (ROOT / "skills").glob("*/SKILL.md"))
    triggering = load_json(ROOT / "evals" / "triggering.json")
    listed = sorted(triggering.get("skills", []))
    if listed != skills:
        fail(f"triggering.json skills do not match source skills: listed={listed}, source={skills}")

    trigger_files = sorted(path.stem for path in (ROOT / "evals" / "trigger").glob("*.json"))
    if trigger_files != skills:
        fail(f"per-skill trigger evals do not match source skills: evals={trigger_files}, source={skills}")

    for skill in skills:
        cases = load_json(ROOT / "evals" / "trigger" / f"{skill}.json")
        if not isinstance(cases, list) or not cases:
            fail(f"missing trigger cases for {skill}")
        positives = [case for case in cases if case.get("should_trigger") is True]
        negatives = [case for case in cases if case.get("should_trigger") is False]
        if not positives or not negatives:
            fail(f"{skill} trigger eval must include positive and negative cases")


def parse_simple_frontmatter(path: Path) -> dict[str, str]:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        fail(f"{path.relative_to(ROOT)} missing YAML frontmatter")
    end = text.find("\n---", 4)
    if end == -1:
        fail(f"{path.relative_to(ROOT)} has unterminated YAML frontmatter")

    data: dict[str, str] = {}
    for raw_line in text[4:end].splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" not in line:
            fail(f"{path.relative_to(ROOT)} has unsupported frontmatter line: {raw_line!r}")
        key, value = line.split(":", 1)
        key = key.strip()
        if key not in ALLOWED_FRONTMATTER:
            fail(f"{path.relative_to(ROOT)} has unexpected frontmatter key {key!r}")
        data[key] = value.strip().strip('"').strip("'")
    return data


def validate_skill_frontmatter() -> None:
    for skill_md in sorted((ROOT / "skills").glob("*/SKILL.md")):
        rel = skill_md.relative_to(ROOT)
        frontmatter = parse_simple_frontmatter(skill_md)
        name = frontmatter.get("name")
        description = frontmatter.get("description")
        if not name:
            fail(f"{rel} missing name")
        if not re.fullmatch(r"[a-z0-9-]{1,64}", name):
            fail(f"{rel} has invalid skill name {name!r}")
        if name != skill_md.parent.name:
            fail(f"{rel} name {name!r} does not match folder {skill_md.parent.name!r}")
        if not description:
            fail(f"{rel} missing description")
        if "<" in description or ">" in description:
            fail(f"{rel} description contains angle brackets")
        if len(description) > 1024:
            fail(f"{rel} description is too long ({len(description)} chars)")
        lower_description = description.lower()
        if "do not trigger" in lower_description or "deprecated" in lower_description:
            fail(f"{rel} is still packaged as a routable skill but its description says not to trigger it")


def validate_pm_paths() -> None:
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(ROOT).as_posix()
        if rel.startswith(EXCLUDED_PATH_PREFIXES):
            continue
        if path.name in IGNORED_SOURCE_NAMES:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for legacy in LEGACY_PM_PATHS:
            if legacy in text:
                fail(f"legacy unscoped path {legacy!r} found in {rel}")


def source_files() -> set[str]:
    files: set[str] = set()
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        if path.name in IGNORED_SOURCE_NAMES:
            continue
        files.add(path.relative_to(ROOT).as_posix())
    return files


def validate_package() -> None:
    if PARENT_PACKAGE.exists():
        fail(f"stale parent-level product-eval.plugin exists at {PARENT_PACKAGE}")
    if not PACKAGE.exists():
        fail("product-eval.plugin is missing")

    source = source_files()
    with zipfile.ZipFile(PACKAGE) as archive:
        packaged_files = {
            name
            for name in archive.namelist()
            if not name.endswith("/")
            and Path(name).name not in IGNORED_SOURCE_NAMES
        }
        missing = sorted(source - packaged_files)
        extra = sorted(packaged_files - source)
        if missing or extra:
            fail(f"package/source file mismatch: missing={missing}, extra={extra}")

        for rel in sorted(source):
            if archive.read(rel) != (ROOT / rel).read_bytes():
                fail(f"package/source content mismatch: {rel}")

        packaged_claude_manifest = read_archive_json(archive, ".claude-plugin/plugin.json")
        packaged_codex_manifest = read_archive_json(archive, ".codex-plugin/plugin.json")
        packaged_marketplace = read_archive_json(archive, ".claude-plugin/marketplace.json")

    source_manifest = load_json(CLAUDE_MANIFEST)
    expected_name, expected_version = manifest_identity(
        source_manifest, ".claude-plugin/plugin.json"
    )
    for label, payload in (
        ("packaged .claude-plugin/plugin.json", packaged_claude_manifest),
        ("packaged .codex-plugin/plugin.json", packaged_codex_manifest),
    ):
        name, version = manifest_identity(payload, label)
        validate_identity(label, name, version, expected_name, expected_version)

    packaged_entry = marketplace_entry(
        packaged_marketplace, "packaged .claude-plugin/marketplace.json", expected_name
    )
    validate_identity(
        "packaged .claude-plugin/marketplace.json plugin entry",
        packaged_entry.get("name"),
        packaged_entry.get("version"),
        expected_name,
        expected_version,
    )


def main() -> None:
    validate_json()
    validate_manifest_identity()
    validate_route_coverage()
    validate_skill_frontmatter()
    validate_pm_paths()
    validate_package()
    print("product-eval validation passed")


if __name__ == "__main__":
    main()
