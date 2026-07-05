"""The flagship contract: ONE unified repair prompt that names every
diagnosed problem with evidence, is paste-ready, and uses the named model
family's mechanisms. Generic advice is a test failure by design."""

import samples
from rubriq.schemas import EvalRequest, FailureMode, ModelFamily
from rubriq.scoring import LocalScorer

scorer = LocalScorer()

GENERIC_PHRASES = [
    "be more specific", "add more detail", "improve your prompt",
    "be clearer", "provide more context",
]


def run(prompt, output, model=""):
    return scorer.evaluate(EvalRequest(prompt=prompt, output=output, model_name=model))


def one(report):
    assert len(report.improvement_prompts) == 1, \
        f"expected exactly one unified repair prompt, got {len(report.improvement_prompts)}"
    return report.improvement_prompts[0]


def test_single_unified_prompt():
    rep = run(samples.SUMM_PROMPT, samples.SUMM_BAD, model="OpenAI GPT-5.5")
    ip = one(rep)
    # the diagnosis names ALL the problem classes, not just one
    assert "source does not support" in ip.diagnosis
    assert "constraint" in ip.diagnosis
    assert ip.failure_mode == FailureMode.UNFAITHFUL_CONTENT  # most severe leads


def test_no_generic_advice():
    for pair in [(samples.SUMM_PROMPT, samples.SUMM_BAD), (samples.CODE_PROMPT, samples.CODE_BAD)]:
        rep = run(*pair, model="OpenAI GPT-5.5")
        ip = one(rep)
        low = (ip.diagnosis + " " + ip.prompt_text).lower()
        for phrase in GENERIC_PHRASES:
            assert phrase not in low, f"generic advice '{phrase}'"


def test_prompt_carries_evidence_back():
    ip = one(run(samples.SUMM_PROMPT, samples.SUMM_BAD, model="OpenAI GPT-5.5"))
    assert "previous attempt" in ip.prompt_text.lower()
    assert "fifteen brave scientists" in ip.prompt_text  # the invented claim travels into the repair


def test_prompt_contains_original_instruction():
    ip = one(run(samples.SUMM_PROMPT, samples.SUMM_BAD, model="OpenAI GPT-5.5"))
    assert "Summarize" in ip.prompt_text and "60 words" in ip.prompt_text


def test_claude_gets_xml_mechanism():
    ip = one(run(samples.SUMM_PROMPT, samples.SUMM_BAD, model="Anthropic Claude Sonnet 5"))
    assert ip.model_family == ModelFamily.CLAUDE
    assert "<quotes>" in ip.prompt_text and "<rules>" in ip.prompt_text


def test_gpt_gets_delimiters_and_tail_emphasis():
    ip = one(run(samples.SUMM_PROMPT, samples.SUMM_BAD, model="OpenAI GPT-5.5"))
    assert ip.model_family == ModelFamily.GPT
    assert "### Requirements" in ip.prompt_text
    assert "IMPORTANT" in ip.prompt_text


def test_gemini_gets_fewshot_for_format():
    ip = one(run(samples.SUMM_PROMPT, samples.SUMM_BAD, model="Google Gemini 3.5 Flash"))
    assert ip.model_family == ModelFamily.GEMINI
    assert "example" in ip.prompt_text.lower()


def test_code_repair_names_defects():
    ip = one(run(samples.CODE_PROMPT, samples.CODE_BAD))
    assert "parse_log_line" in ip.prompt_text
    assert "does not parse" in ip.prompt_text or "does not parse" in ip.diagnosis


def test_no_empty_coverage_repair_on_code():
    """Regression: missing requested function names must never surface as a
    '0 parts unanswered' coverage diagnosis."""
    ip = one(run(samples.CODE_PROMPT, samples.CODE_BAD))
    assert "0 part(s)" not in ip.diagnosis
    assert 'e.g. ""' not in ip.diagnosis


def test_family_detection_current_models():
    from rubriq.prompts.model_profiles import detect_family
    cases = {
        "OpenAI GPT-5.6 Sol (preview)": ModelFamily.GPT,
        "OpenAI o3": ModelFamily.GPT,
        "Anthropic Claude Fable 5": ModelFamily.CLAUDE,
        "Google Gemini 3.5 Flash": ModelFamily.GEMINI,
        "Meta Llama 4 Maverick": ModelFamily.OPEN_WEIGHTS,
        "DeepSeek V4 Pro": ModelFamily.OPEN_WEIGHTS,
        "Z.ai GLM-5.1": ModelFamily.OPEN_WEIGHTS,
        "MiniMax M3": ModelFamily.OPEN_WEIGHTS,
        "Mistral Devstral 2": ModelFamily.OPEN_WEIGHTS,
        "xAI Grok 4.3": ModelFamily.GENERIC,
        "Cohere Command A": ModelFamily.GENERIC,
        "": ModelFamily.GENERIC,
    }
    for name, family in cases.items():
        assert detect_family(name) == family, f"{name!r} -> {detect_family(name)}"


def test_technique_sources_cited():
    ip = one(run(samples.SUMM_PROMPT, samples.SUMM_BAD, model="OpenAI GPT-5.5"))
    assert ip.technique_source.strip()
