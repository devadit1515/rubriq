"""The flagship contract: improvement prompts must name the diagnosed
problem, quote evidence, be paste-ready, and use the named model family's
mechanism. Generic advice is a test failure by design."""

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


def test_bad_summary_generates_prompts():
    report = run(samples.SUMM_PROMPT, samples.SUMM_BAD, model="gpt-4o")
    assert report.improvement_prompts, "a failing output must generate repairs"
    modes = {p.failure_mode for p in report.improvement_prompts}
    assert FailureMode.UNFAITHFUL_CONTENT in modes
    assert FailureMode.MISSED_CONSTRAINT in modes or FailureMode.VERBOSITY in modes


def test_no_generic_advice():
    for pair in [(samples.SUMM_PROMPT, samples.SUMM_BAD), (samples.CODE_PROMPT, samples.CODE_BAD)]:
        report = run(*pair, model="gpt-4o")
        for ip in report.improvement_prompts:
            low = (ip.diagnosis + " " + ip.prompt_text).lower()
            for phrase in GENERIC_PHRASES:
                assert phrase not in low, f"generic advice '{phrase}' in {ip.title}"


def test_diagnosis_names_the_evidence():
    report = run(samples.SUMM_PROMPT, samples.SUMM_BAD, model="gpt-4o")
    unfaithful = next(p for p in report.improvement_prompts
                      if p.failure_mode == FailureMode.UNFAITHFUL_CONTENT)
    # The repair prompt must carry the actual invented claims back to the model.
    assert '"' in unfaithful.prompt_text
    assert "previous attempt" in unfaithful.prompt_text.lower()


def test_prompt_contains_original_instruction():
    report = run(samples.SUMM_PROMPT, samples.SUMM_BAD, model="gpt-4o")
    for ip in report.improvement_prompts:
        assert "60 words" in ip.prompt_text or "Summarize" in ip.prompt_text, \
            "repair prompts must be complete replacements, not advice"


def test_claude_gets_xml_mechanism():
    report = run(samples.SUMM_PROMPT, samples.SUMM_BAD, model="claude sonnet")
    unfaithful = next(p for p in report.improvement_prompts
                      if p.failure_mode == FailureMode.UNFAITHFUL_CONTENT)
    assert unfaithful.model_family == ModelFamily.CLAUDE
    assert "<quotes>" in unfaithful.prompt_text or "<source>" in unfaithful.prompt_text


def test_gpt_gets_delimiters_and_tail_emphasis():
    report = run(samples.SUMM_PROMPT, samples.SUMM_BAD, model="gpt-4o")
    unfaithful = next(p for p in report.improvement_prompts
                      if p.failure_mode == FailureMode.UNFAITHFUL_CONTENT)
    assert unfaithful.model_family == ModelFamily.GPT
    assert "IMPORTANT" in unfaithful.prompt_text or "###" in unfaithful.prompt_text


def test_gemini_gets_fewshot_for_format():
    report = run(samples.SUMM_PROMPT, samples.SUMM_BAD, model="gemini-1.5-pro")
    constraint = next((p for p in report.improvement_prompts
                       if p.failure_mode in (FailureMode.MISSED_CONSTRAINT, FailureMode.FORMAT_VIOLATION)), None)
    if constraint:
        assert "example" in constraint.prompt_text.lower()


def test_code_repair_names_defects():
    report = run(samples.CODE_PROMPT, samples.CODE_BAD)
    code = next(p for p in report.improvement_prompts if p.failure_mode == FailureMode.INVALID_CODE)
    assert "parse_log_line" in code.prompt_text  # the missing requested name travels into the repair
    assert "fix each" in code.prompt_text.lower()


def test_no_empty_coverage_repair_on_code():
    """Regression: missing requested function names must route to the code
    repair, never produce a '0 parts unanswered' coverage card."""
    report = run(samples.CODE_PROMPT, samples.CODE_BAD)
    for ip in report.improvement_prompts:
        assert "0 part(s)" not in ip.diagnosis
        if ip.failure_mode == FailureMode.INCOMPLETE_COVERAGE:
            assert 'e.g. ""' not in ip.diagnosis


def test_technique_sources_cited():
    report = run(samples.SUMM_PROMPT, samples.SUMM_BAD, model="gpt-4o")
    for ip in report.improvement_prompts:
        assert ip.technique_source.strip(), "every template must cite its source"
