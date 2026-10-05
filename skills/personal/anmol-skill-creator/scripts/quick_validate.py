#!/usr/bin/env python3
"""
Quick validation script for skills - minimal version
"""

import sys
import os
import re
import yaml
from pathlib import Path

RESERVED_NAME_WORDS = ('anthropic', 'claude')

# Anthropic's skill-authoring guidance: keep the SKILL.md body under 500 lines,
# and give any reference file over 100 lines a table of contents so a partial
# read (e.g. `head -100`) still shows the file's full scope.
MAX_BODY_LINES = 500
TOC_THRESHOLD_LINES = 100

MD_REF = re.compile(r'(?<![\w/.-])((?:[\w.-]+/)*[\w.-]+\.md)\b')
BACKSLASH_PATH = re.compile(r'\b[\w-]+(?:\\{1,2}[\w.-]+)+\.(?:py|md|sh|js|ts|json|txt|html)\b')
# Eval workspaces and run outputs live next to (or inside) skills but are not
# instructions Claude reads, so they are excluded from reference checks.
NON_REFERENCE_DIR = re.compile(r'(?i)(-workspace$|iterations?(-\d+)?$|^evals$|^node_modules$|^__pycache__$|^\.)')
TOC_HEADING = re.compile(r'^#{1,3}\s*(table of )?contents\b', re.IGNORECASE | re.MULTILINE)


def lint_skill(skill_path):
    """Structural best-practice checks. Returns a list of warning strings.

    Warnings don't block packaging; they flag rule breaks to fix or justify.
    """
    skill_path = Path(skill_path)
    skill_md = skill_path / 'SKILL.md'
    if not skill_md.exists():
        return []
    warnings = []
    content = skill_md.read_text()
    body = re.sub(r'^---\n.*?\n---\n?', '', content, count=1, flags=re.DOTALL)

    body_lines = body.count('\n') + 1
    if body_lines > MAX_BODY_LINES:
        warnings.append(
            f"SKILL.md body is {body_lines} lines (limit {MAX_BODY_LINES}). "
            "Split detail into reference files linked from SKILL.md."
        )

    md_files = sorted(
        p for p in skill_path.rglob('*.md')
        if p != skill_md
        and not any(NON_REFERENCE_DIR.search(part) for part in p.relative_to(skill_path).parts[:-1])
    )
    rel = {p: p.relative_to(skill_path).as_posix() for p in md_files}
    linked_from_skill = set(MD_REF.findall(body))
    # A bare filename ("see forms.md") still counts as a link from SKILL.md.
    linked_from_skill |= {
        r for r in rel.values() if Path(r).name in {Path(m).name for m in linked_from_skill}
    }

    for path, rel_path in rel.items():
        text = path.read_text(errors='replace')
        if rel_path not in linked_from_skill:
            warnings.append(
                f"{rel_path} is not referenced from SKILL.md. "
                "References must be one level deep: link it directly from SKILL.md (or delete it)."
            )
        nested = sorted({
            m for m in MD_REF.findall(text)
            if m != rel_path
            and m not in linked_from_skill
            and Path(m).name != 'SKILL.md'
            and (skill_path / m).exists()
        })
        if nested:
            warnings.append(
                f"{rel_path} is the only route to {', '.join(nested)}. Nested references get "
                "partially read; link them directly from SKILL.md."
            )
        n_lines = text.count('\n') + 1
        if n_lines > TOC_THRESHOLD_LINES and not TOC_HEADING.search(text[:3000]):
            warnings.append(
                f"{rel_path} is {n_lines} lines with no table of contents. "
                "Add a '## Contents' list near the top."
            )

    for path in [skill_md, *md_files]:
        for m in sorted(set(BACKSLASH_PATH.findall(path.read_text(errors='replace')))):
            warnings.append(
                f"{path.relative_to(skill_path).as_posix()}: Windows-style path '{m}'. Use forward slashes."
            )

    return warnings


def validate_skill(skill_path):
    """Basic validation of a skill"""
    skill_path = Path(skill_path)

    # Check SKILL.md exists
    skill_md = skill_path / 'SKILL.md'
    if not skill_md.exists():
        return False, "SKILL.md not found"

    # Read and validate frontmatter
    content = skill_md.read_text()
    if not content.startswith('---'):
        return False, "No YAML frontmatter found"

    # Extract frontmatter
    match = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
    if not match:
        return False, "Invalid frontmatter format"

    frontmatter_text = match.group(1)

    # Parse YAML frontmatter
    try:
        frontmatter = yaml.safe_load(frontmatter_text)
        if not isinstance(frontmatter, dict):
            return False, "Frontmatter must be a YAML dictionary"
    except yaml.YAMLError as e:
        return False, f"Invalid YAML in frontmatter: {e}"

    # Define allowed properties
    ALLOWED_PROPERTIES = {'name', 'description', 'license', 'allowed-tools', 'metadata', 'compatibility'}

    # Check for unexpected properties (excluding nested keys under metadata)
    unexpected_keys = set(frontmatter.keys()) - ALLOWED_PROPERTIES
    if unexpected_keys:
        return False, (
            f"Unexpected key(s) in SKILL.md frontmatter: {', '.join(sorted(unexpected_keys))}. "
            f"Allowed properties are: {', '.join(sorted(ALLOWED_PROPERTIES))}"
        )

    # Check required fields
    if 'name' not in frontmatter:
        return False, "Missing 'name' in frontmatter"
    if 'description' not in frontmatter:
        return False, "Missing 'description' in frontmatter"

    # Extract name for validation
    name = frontmatter.get('name', '')
    if not isinstance(name, str):
        return False, f"Name must be a string, got {type(name).__name__}"
    name = name.strip()
    if name:
        # Check naming convention (kebab-case: lowercase with hyphens)
        if not re.match(r'^[a-z0-9-]+$', name):
            return False, f"Name '{name}' should be kebab-case (lowercase letters, digits, and hyphens only)"
        if name.startswith('-') or name.endswith('-') or '--' in name:
            return False, f"Name '{name}' cannot start/end with hyphen or contain consecutive hyphens"
        # Check name length (max 64 characters per spec)
        if len(name) > 64:
            return False, f"Name is too long ({len(name)} characters). Maximum is 64 characters."
        for reserved in RESERVED_NAME_WORDS:
            if reserved in name:
                return False, f"Name '{name}' contains reserved word '{reserved}'"

    # Extract and validate description
    description = frontmatter.get('description', '')
    if not isinstance(description, str):
        return False, f"Description must be a string, got {type(description).__name__}"
    description = description.strip()
    if description:
        # Check for angle brackets
        if '<' in description or '>' in description:
            return False, "Description cannot contain angle brackets (< or >)"
        # Check description length (max 1024 characters per spec)
        if len(description) > 1024:
            return False, f"Description is too long ({len(description)} characters). Maximum is 1024 characters."

    # Validate compatibility field if present (optional)
    compatibility = frontmatter.get('compatibility', '')
    if compatibility:
        if not isinstance(compatibility, str):
            return False, f"Compatibility must be a string, got {type(compatibility).__name__}"
        if len(compatibility) > 500:
            return False, f"Compatibility is too long ({len(compatibility)} characters). Maximum is 500 characters."

    return True, "Skill is valid!"

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python quick_validate.py <skill_directory>")
        sys.exit(1)
    
    valid, message = validate_skill(sys.argv[1])
    print(message)
    warnings = lint_skill(sys.argv[1])
    for w in warnings:
        print(f"WARNING: {w}")
    if not warnings and valid:
        print("No structural warnings.")
    sys.exit(0 if valid else 1)
