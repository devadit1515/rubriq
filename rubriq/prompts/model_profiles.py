"""Model-family detection and prompting mechanisms (RESEARCH.md 2.1-2.3).

Each family gets the *mechanisms its own provider documents*: XML tags and
prefills for Claude, delimiters and literal phrasing for GPT, few-shot and
positive instructions for Gemini, repetition and explicit format for open
weights. The generic profile is the fallback when no model is named.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from ..schemas import ModelFamily

_FAMILY_PATTERNS = [
    (ModelFamily.CLAUDE, re.compile(r"(?i)claude|anthropic|sonnet|opus|haiku|fable")),
    (ModelFamily.GPT, re.compile(r"(?i)gpt|openai|\bo[134](?:\b|-)|chatgpt|davinci|\bsol\b|\bterra\b|\bluna\b")),
    (ModelFamily.GEMINI, re.compile(r"(?i)gemini|bard|google|palm")),
    (ModelFamily.OPEN_WEIGHTS, re.compile(
        r"(?i)llama|mistral|mixtral|devstral|codestral|qwen|deepseek|phi-|falcon|vicuna|ollama|"
        r"\bglm\b|glm-|minimax|kimi|moonshot")),
]


def detect_family(model_name: str) -> ModelFamily:
    for family, pat in _FAMILY_PATTERNS:
        if pat.search(model_name or ""):
            return family
    return ModelFamily.GENERIC


@dataclass(frozen=True)
class Profile:
    family: ModelFamily
    display: str
    source: str                      # provider guidance citation (RESEARCH.md key)
    # mechanism snippets used by the builders:
    structure_hint: str              # how this family likes prompts organized
    format_mechanism: str            # strongest format-control lever
    grounding_mechanism: str         # strongest faithfulness lever

    def wrap_source(self, placeholder: str = "<paste your source text here>") -> str:
        if self.family == ModelFamily.CLAUDE:
            return f"<source>\n{placeholder}\n</source>"
        if self.family == ModelFamily.GPT:
            return f'"""\n{placeholder}\n"""'
        return f"--- SOURCE TEXT ---\n{placeholder}\n--- END SOURCE ---"


PROFILES: dict[ModelFamily, Profile] = {
    ModelFamily.CLAUDE: Profile(
        family=ModelFamily.CLAUDE, display="Claude",
        source="Anthropic prompt engineering docs (RESEARCH.md 2.1)",
        structure_hint="Claude responds well to XML-tagged sections and an assigned role.",
        format_mechanism="Tell Claude exactly how to open its reply (a prefill-style instruction) and tag the rules in XML.",
        grounding_mechanism="Ask Claude to extract supporting quotes into <quotes> tags before writing, and to use only what it quoted.",
    ),
    ModelFamily.GPT: Profile(
        family=ModelFamily.GPT, display="GPT",
        source="OpenAI prompt engineering guide (RESEARCH.md 2.2)",
        structure_hint="Newer GPT models follow instructions literally — state every requirement explicitly, separated by ### delimiters.",
        format_mechanism="Number the requirements and restate the output format as the final line of the prompt.",
        grounding_mechanism="Provide the reference text inside triple quotes and instruct: answer using only the provided text; say \"not in the text\" otherwise.",
    ),
    ModelFamily.GEMINI: Profile(
        family=ModelFamily.GEMINI, display="Gemini",
        source="Google Gemini prompting guidance (RESEARCH.md 2.3)",
        structure_hint="Gemini's guidance: context first, question last, and always include a worked example (few-shot).",
        format_mechanism="Show one example of the exact output you want — Gemini docs treat few-shot as the primary format lever. Phrase rules positively (\"do X\", not \"don't do Y\").",
        grounding_mechanism="Place the source text before the question and add a positive rule: base every sentence on the text above.",
    ),
    ModelFamily.OPEN_WEIGHTS: Profile(
        family=ModelFamily.OPEN_WEIGHTS, display="open-weights model",
        source="lost-in-the-middle + instruction-following headroom notes (RESEARCH.md 2.7/Part 4)",
        structure_hint="Smaller instruction-following headroom: keep the prompt short, one requirement per line, no nested asks.",
        format_mechanism="Spell out the format mechanically and REPEAT the critical constraint as the last line — end-of-prompt text gets the most attention.",
        grounding_mechanism="Keep the source short and close to the question; instruct it to copy exact phrases from the source rather than paraphrase.",
    ),
    ModelFamily.GENERIC: Profile(
        family=ModelFamily.GENERIC, display="the model",
        source="cross-provider consensus (RESEARCH.md Part 2)",
        structure_hint="Separate instructions from content with clear delimiters.",
        format_mechanism="State the output format explicitly and restate the critical constraint at the end of the prompt.",
        grounding_mechanism="Label the source text clearly and instruct the model to use only that text.",
    ),
}


def get_profile(model_name: str) -> Profile:
    return PROFILES[detect_family(model_name)]
