"""Task classification: rule signals first, embedding prototypes as referee.

Design (RESEARCH.md 1.8 adaptation + standard practice):
- High-precision regex/structure rules vote on task type. A confident rule
  vote decides directly — "Summarize the following" needs no neural network.
- When rules disagree or stay silent, the instruction is embedded and
  compared against prototype sentences per task type (bge-small).
- Separately, the prompt is split into instruction vs. pasted source
  material; source presence turns QA into QA_GROUNDED and unlocks the
  NLI faithfulness parameter.

Every fired signal is recorded and surfaced in the UI, so a misclassification
is diagnosable by the user (and overridable in a later UI iteration).
"""

from __future__ import annotations

import re

from .models import get_embedder
from .schemas import TaskClassification, TaskType
from .textutils import word_count

# ---------------------------------------------------------------- source split

_DELIM_BLOCK = re.compile(
    r"(?s)(?:\"{3}|'{3}|`{3}|<{2,}|={3,}|-{3,}|###)\s*\n?(.+?)(?:\"{3}|'{3}|`{3}|>{2,}|={3,}|-{3,}|###|\Z)"
)
_SOURCE_INTRO = re.compile(
    r"(?i)(?:following (?:text|article|document|passage|email|report|code|excerpt|transcript|paragraph)s?|"
    r"text below|below is|here is the (?:text|article|document|passage|code)|this (?:text|article|document))"
    r"[^\n]*\n"
)


def split_instruction_and_source(prompt: str) -> tuple[str, str | None]:
    """Separate the user's instruction from pasted source material.

    Order of attempts: explicit delimiter blocks, then "the following text:"
    intros, then a length heuristic (one short leading/trailing instruction
    line attached to a long body). Conservative: when unsure, the whole
    prompt is instruction and no faithfulness checking happens — a false
    source is worse than a missed one because it would generate false
    unfaithfulness findings.
    """
    m = _DELIM_BLOCK.search(prompt)
    if m and word_count(m.group(1)) >= 40:
        source = m.group(1).strip()
        instruction = (prompt[:m.start()] + " " + prompt[m.end():]).strip()
        if instruction:
            return instruction, source

    m = _SOURCE_INTRO.search(prompt)
    if m:
        source = prompt[m.end():].strip()
        instruction = prompt[:m.end()].strip()
        if word_count(source) >= 30:
            return instruction, source

    # Length heuristic: short first paragraph, long remainder.
    parts = prompt.split("\n", 1)
    if len(parts) == 2:
        head, rest = parts[0].strip(), parts[1].strip()
        if head and word_count(head) <= 60 and word_count(rest) >= 60 and _looks_instructional(head):
            return head, rest

    return prompt.strip(), None


def _looks_instructional(line: str) -> bool:
    return bool(re.search(
        r"(?i)\b(summari[sz]e|rewrite|translate|extract|answer|explain|list|analy[sz]e|"
        r"convert|classify|describe|edit|fix|review|compare|based on|according to)\b",
        line,
    )) or line.rstrip().endswith("?")


# ---------------------------------------------------------------- rule signals

_RULES: list[tuple[TaskType, str, re.Pattern]] = [
    (TaskType.SUMMARIZATION, "prompt asks to summarize",
     re.compile(r"(?i)\b(summari[sz]e|summary|tl;?dr|condense|key points? of|main points? of|abstract of)\b")),
    (TaskType.CODE_GENERATION, "prompt asks for code",
     re.compile(r"(?i)\b(write|create|implement|generate|fix|debug|refactor)\b.{0,60}\b(function|class|script|code|program|method|module|regex|query|endpoint|component)\b")),
    (TaskType.CODE_GENERATION, "prompt names a programming language",
     re.compile(r"(?i)\bin (python|javascript|typescript|java|c\+\+|c#|go|rust|sql|html|css|bash|powershell)\b")),
    (TaskType.CREATIVE_WRITING, "prompt asks for creative writing",
     re.compile(r"(?i)\b(write|compose|craft)\b.{0,50}\b(story|poem|song|haiku|novel|fiction|tale|screenplay|lyrics|limerick)\b")),
    (TaskType.EXTRACTION, "prompt asks to extract structured data",
     re.compile(r"(?i)\b(extract|pull out|identify all|list (?:all|every))\b.{0,80}\b(names?|dates?|entities|emails?|numbers?|fields?|values?|keywords?|items)\b")),
    (TaskType.EXTRACTION, "prompt requests JSON/CSV/table output from text",
     re.compile(r"(?i)\b(as|in|into|to) (?:a |valid )?(json|csv|yaml|xml|table)\b")),
    (TaskType.REASONING, "prompt poses a math/logic problem",
     re.compile(r"(?i)\b(calculate|compute|solve|prove|how many|what is the (?:probability|total|sum|difference|product)|step[- ]by[- ]step|logic puzzle|riddle)\b")),
    (TaskType.REWRITING, "prompt asks to rewrite/edit existing text",
     re.compile(r"(?i)\b(rewrite|rephrase|paraphrase|edit|proofread|improve|polish|make (?:this|it) (?:more|less|sound)|change the tone|translate)\b")),
    (TaskType.QA_OPEN, "prompt asks a direct question",
     re.compile(r"(?i)^(?:please\s+)?(what|who|when|where|why|how|which|is|are|does|do|can|could|should|explain)\b")),
    (TaskType.QA_OPEN, "prompt asks to answer questions",
     re.compile(r"(?i)\banswer (?:the |these |the following |my )?questions?\b")),
    (TaskType.QA_OPEN, "prompt contains interrogative sentences",
     re.compile(r"(?:^|[.!?]\s+)(?:What|Who|When|Where|Why|How|Which)\b[^.\n?]*\?")),
]

_CODE_FENCE = re.compile(r"```")


def _rule_votes(instruction: str, output: str) -> list[tuple[TaskType, str]]:
    votes: list[tuple[TaskType, str]] = []
    for task, why, pat in _RULES:
        if pat.search(instruction):
            votes.append((task, why))
    if _CODE_FENCE.search(output) and word_count(re.sub(r"```.*?```", "", output, flags=re.S)) < word_count(output) * 0.5:
        votes.append((TaskType.CODE_GENERATION, "output is mostly code blocks"))
    return votes


# ------------------------------------------------------------ prototype backup

_PROTOTYPES: dict[TaskType, list[str]] = {
    TaskType.SUMMARIZATION: [
        "Summarize this article in a few sentences.",
        "Give me the key points of the following document.",
    ],
    TaskType.CODE_GENERATION: [
        "Write a Python function that parses a CSV file.",
        "Implement a REST endpoint that returns user data.",
    ],
    TaskType.CREATIVE_WRITING: [
        "Write a short story about a lighthouse keeper.",
        "Compose a poem about autumn in free verse.",
    ],
    TaskType.EXTRACTION: [
        "Extract all person names and dates from this text as JSON.",
        "List every product mentioned in the reviews below.",
    ],
    TaskType.REASONING: [
        "If a train leaves at 3pm traveling 60 mph, when does it arrive?",
        "Solve this logic puzzle and show your reasoning.",
    ],
    TaskType.REWRITING: [
        "Rewrite this paragraph in a more formal tone.",
        "Paraphrase the following text for a younger audience.",
    ],
    TaskType.QA_OPEN: [
        "What are the main causes of inflation?",
        "Explain how photosynthesis works.",
    ],
    TaskType.GENERAL: [
        "Help me draft an email to my landlord.",
        "Give me advice on preparing for a job interview.",
    ],
}

_proto_cache: dict | None = None


def _prototype_scores(instruction: str) -> dict[TaskType, float] | None:
    global _proto_cache
    embedder = get_embedder()
    if embedder is None:
        return None
    import numpy as np
    if _proto_cache is None:
        flat, owners = [], []
        for task, examples in _PROTOTYPES.items():
            flat.extend(examples)
            owners.extend([task] * len(examples))
        vecs = embedder.encode(flat, normalize_embeddings=True)
        _proto_cache = (np.asarray(vecs), owners)
    vecs, owners = _proto_cache
    q = embedder.encode([instruction], normalize_embeddings=True)[0]
    sims = vecs @ q
    best: dict[TaskType, float] = {}
    for owner, sim in zip(owners, sims):
        best[owner] = max(best.get(owner, -1.0), float(sim))
    return best


# ------------------------------------------------------------------- classifier

def classify(prompt: str, output: str) -> TaskClassification:
    instruction, source = split_instruction_and_source(prompt)
    votes = _rule_votes(instruction, output)
    signals = [why for _, why in votes]

    vote_counts: dict[TaskType, int] = {}
    for task, _ in votes:
        vote_counts[task] = vote_counts.get(task, 0) + 1

    task: TaskType
    confidence: float

    if vote_counts:
        ranked = sorted(vote_counts.items(), key=lambda kv: -kv[1])
        if len(ranked) == 1 or ranked[0][1] > ranked[1][1]:
            task, confidence = ranked[0][0], min(0.95, 0.7 + 0.1 * ranked[0][1])
        else:
            # Tie -> embeddings referee among tied candidates.
            tied = {t for t, c in ranked if c == ranked[0][1]}
            proto = _prototype_scores(instruction)
            if proto:
                task = max(tied, key=lambda t: proto.get(t, -1.0))
                confidence = 0.6
                signals.append("embedding similarity broke a rule tie")
            else:
                task, confidence = ranked[0][0], 0.5
                signals.append("rule tie, embeddings unavailable; first match kept")
    else:
        proto = _prototype_scores(instruction)
        if proto:
            task = max(proto, key=proto.get)  # type: ignore[arg-type]
            top = proto[task]
            task = task if top >= 0.45 else TaskType.GENERAL
            confidence = round(min(0.85, max(0.35, top)), 2)
            signals.append(f"embedding prototype match ({task.value}, sim={top:.2f})")
        else:
            task, confidence = TaskType.GENERAL, 0.3
            signals.append("no rule matched, embeddings unavailable")

    # Source text upgrades/refines the task.
    if source is not None:
        signals.append("prompt contains pasted source text")
        if task == TaskType.QA_OPEN:
            task = TaskType.QA_GROUNDED
            signals.append("question + source text -> grounded Q&A")

    return TaskClassification(
        task_type=task,
        confidence=confidence,
        signals=signals,
        has_source_text=source is not None,
        instruction=instruction,
        source_text=source,
    )
