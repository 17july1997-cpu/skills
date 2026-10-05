# MCQ & Example Selection Guide

This reference document provides archetype libraries, heuristics, and templates for generating high-quality MCQs and example candidates during skill creation. Read this when you need inspiration for the Clarifying Questions or Example Selection stages.

## Contents
- Part 1: MCQ Generation (scope archetypes, behavioural archetypes, heuristics)
- Part 2: Example Selection (good and bad archetype libraries, task-category defaults, candidate heuristics, what to do with selections)

---

## Part 1: MCQ Generation

### Scope & Breadth Question Archetypes

These question patterns help surface the skill's boundaries — what it covers, what it doesn't, and adjacent use cases the user may not have considered.

**Coverage boundary questions:**
- "Should this skill handle [adjacent variant], or is that a separate skill?"
- "When the user's input is [edge format], should the skill attempt it or decline?"
- "Does this need to work for [domain A] only, or also [domain B] and [domain C]?"

**Input tolerance questions:**
- "How messy can the input be? Strict schema only, or should it handle informal/unstructured inputs?"
- "Should the skill work with [small inputs] and [large inputs] equally, or is it optimised for one?"
- "What happens if a required input is missing — should the skill ask, infer, or error?"

**Output scope questions:**
- "Should the skill produce just [primary deliverable], or also [secondary outputs like logs, summaries, metadata]?"
- "Is the output a final product, or an intermediate step in a larger workflow?"
- "Should the skill handle [uncommon variant of the output] or only the standard case?"

**Competition/overlap questions:**
- "If the user asks for [thing that could be this skill or another skill], should this skill claim it?"
- "Is there overlap with [existing skill/tool]? Where does this skill's territory end?"

### Behavioural Default Question Archetypes

These probe *how* the skill acts — preferences and trade-offs that differ per creator.

**Ambiguity handling:**
- "When input is ambiguous: (a) ask for clarification, (b) make a best guess and label it, (c) produce multiple interpretations, (d) use the most common interpretation silently"

**Verbosity / output style:**
- "Output should be: (a) minimal — only essential information, (b) balanced — key info with brief context, (c) comprehensive — thorough and detailed, (d) adaptive — match the complexity of the input"

**Error philosophy:**
- "When something goes wrong: (a) fail loudly with a clear error, (b) degrade gracefully with partial output, (c) retry silently before failing, (d) ask the user what to do"

**Explanation vs. silence:**
- "Should the skill explain its reasoning as it goes, or just deliver the final result?"

**Tone calibration:**
- "The skill's communication style should be: (a) professional and formal, (b) friendly and conversational, (c) terse and efficient, (d) match the user's tone"

**Speed vs. thoroughness:**
- "When there's a trade-off between speed and quality: (a) always prioritise quality, (b) always prioritise speed, (c) default to quality but let the user ask for fast mode, (d) assess per-task"

### Generating Good MCQs — Heuristics

1. **Start from failure modes.** Think about what would go wrong if the skill were built with the wrong assumption about this dimension. If the wrong answer wouldn't matter, it's not a good question.

2. **Make options genuinely different.** Each option should lead to a meaningfully different skill design. If options A and B would produce the same SKILL.md, merge them.

3. **Include a "it depends" option when honest.** Sometimes the right answer is contextual. Offering "(d) depends on [factor]" respects that — and the follow-up conversation about *what* it depends on is itself valuable.

4. **Don't ask questions the intent capture already answered.** If the user already told you the output format, don't ask about output format again in the MCQs. The MCQs should probe dimensions the intent questions missed.

5. **Front-load the highest-leverage questions.** Put the questions that would most change the skill's design first. If you only get 4 answers before the user says "just go," you want those 4 to be the ones that matter most.

---

## Part 2: Example Selection

### Good Example Archetype Library

Use these as inspiration when generating "good output" candidates. Don't use them literally — tailor to the specific skill.

| Code | Archetype | What it demonstrates |
|------|-----------|---------------------|
| G1 | Structured & constraint-faithful | Follows all rules, correct format, nothing extra |
| G2 | Minimal but complete | Shortest possible output that satisfies all requirements |
| G3 | Tool-ready / executable | Output can be directly used (run, pasted, deployed) without editing |
| G4 | High-clarity for non-experts | A beginner could understand and act on this output |
| G5 | Stakeholder-ready / persuasive | Polished enough to send to a boss, client, or board |
| G6 | Edge-case resilient | Handles a tricky input gracefully — shows the skill doesn't break |

### Bad Example Archetype Library

| Code | Archetype | What it demonstrates | Typical "Why it fails" note |
|------|-----------|---------------------|---------------------------|
| B1 | Vague & underspecified | Missing key details, hand-wavy | "Doesn't give the user enough to act on" |
| B2 | Constraint-violating | Breaks a stated rule | "Ignores the [specific constraint]" |
| B3 | Overlong & bloated | 3x longer than needed, buries the signal | "User has to hunt for what matters" |
| B4 | Wrong format | Content is fine, packaging is wrong | "Right information, wrong structure" |
| B5 | Hallucination-prone | Makes unsupported claims or invents data | "Presents fabricated [data/citations/metrics] as fact" |
| B6 | Untestable / no QA hooks | No way to verify correctness | "You'd never know if this was wrong" |

### Task-Category Defaults

When generating candidates, lean toward these archetype combinations based on the skill type:

| Skill type | Recommended Good archetypes | Recommended Bad archetypes |
|-----------|---------------------------|--------------------------|
| Code generation / technical | G3 + G1 or G6 | B2, B6, B4 |
| Business documents / reports | G5 + G1 | B1, B3, B5 |
| Data transformation / specs | G1 + G3 | B4, B6, B2 |
| Creative / marketing / writing | G4 or G5 + G2 or G1 | B1, B3, B5 |
| Workflow automation / SOPs | G1 + G3 + G6 | B1, B6, B2 |

### Generating Good Candidates — Heuristics

1. **Make candidates genuinely diverse.** If all 4 good candidates have the same structure, tone, and length, you haven't explored the space. Vary along at least 2 dimensions: length, structure, tone, level of detail, format.

2. **Use the user's actual deliverable type.** If the skill produces cover letters, the candidates should be cover letters — not generic text samples. Make them realistic.

3. **Scale candidate depth to complexity:**
   - Simple skills: candidates can be brief (3–5 lines each)
   - Standard skills: moderate detail (5–15 lines each)
   - Complex skills: comprehensive with edge-case coverage (15–30 lines each)

4. **Bad candidates should be *plausibly* bad.** The best bad examples are ones that an LLM might actually produce without good guidance — not absurd strawmen. If a bad example is so obviously terrible that no model would produce it, it doesn't teach anything.

5. **Each candidate should be self-contained.** The user should be able to evaluate each candidate on its own without needing to compare it to the others to understand what it's showing.

### What to Do with Selections

The user's choices tell you several things:

- **Which good examples they picked** → what they value (brevity? structure? polish? executability?)
- **Which good examples they rejected** → what they don't want (even if it's objectively fine)
- **Which bad examples they picked** → what failure modes they're most worried about
- **Which bad examples they rejected** → what failure modes they consider less important

Use all four signals when writing the SKILL.md instructions. The rejections are as informative as the selections.
