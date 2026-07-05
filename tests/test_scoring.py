"""End-to-end: LocalScorer must behave sensibly on the curated pairs.
"Sensibly" is concrete: good outputs beat bad outputs, known flaws are
found and quoted, and improvement prompts obey the no-generic-advice
contract. Requires the two local models (cached by warmup)."""

import pytest

import samples
from rubriq.schemas import EvalRequest, FailureMode
from rubriq.scoring import LocalScorer

scorer = LocalScorer()


def run(prompt, output, model=""):
    return scorer.evaluate(EvalRequest(prompt=prompt, output=output, model_name=model))


@pytest.fixture(scope="module")
def summ_good():
    return run(samples.SUMM_PROMPT, samples.SUMM_GOOD)


@pytest.fixture(scope="module")
def summ_bad():
    return run(samples.SUMM_PROMPT, samples.SUMM_BAD, model="gpt-4o")


class TestSummarization:
    def test_good_beats_bad_overall(self, summ_good, summ_bad):
        assert summ_good.overall.score > summ_bad.overall.score + 10

    def test_bad_fails_word_limit(self, summ_bad):
        instr = next(p for p in summ_bad.parameters if p.parameter == "instruction_following")
        assert any(f.failure_mode in (FailureMode.MISSED_CONSTRAINT, FailureMode.FORMAT_VIOLATION)
                   for f in instr.findings)

    def test_good_passes_word_limit(self, summ_good):
        instr = next(p for p in summ_good.parameters if p.parameter == "instruction_following")
        assert instr.score == 100.0

    def test_bad_flagged_unfaithful(self, summ_bad):
        faith = next(p for p in summ_bad.parameters if p.parameter == "faithfulness")
        assert faith.score is not None
        assert any(f.failure_mode == FailureMode.UNFAITHFUL_CONTENT for f in faith.findings)

    def test_good_faithfulness_beats_bad(self, summ_good, summ_bad):
        fg = next(p for p in summ_good.parameters if p.parameter == "faithfulness")
        fb = next(p for p in summ_bad.parameters if p.parameter == "faithfulness")
        assert fg.score > fb.score

    def test_findings_quote_the_output(self, summ_bad):
        faith = next(p for p in summ_bad.parameters if p.parameter == "faithfulness")
        quoted = [e.quote for f in faith.findings for e in f.evidence if e.source == "output"]
        assert quoted, "unfaithfulness findings must quote the offending sentences"


class TestCode:
    def test_bad_code_flagged(self):
        report = run(samples.CODE_PROMPT, samples.CODE_BAD)
        code = next(p for p in report.parameters if p.parameter == "code_validity")
        details = " ".join(f.detail for f in code.findings)
        assert "parse" in details.lower()
        assert "parse_log_line" in details  # requested name missing

    def test_good_code_clean(self):
        report = run(samples.CODE_PROMPT, samples.CODE_GOOD)
        code = next(p for p in report.parameters if p.parameter == "code_validity")
        assert code.score >= 80

    def test_honesty_note_static_only(self):
        report = run(samples.CODE_PROMPT, samples.CODE_GOOD)
        assert any("never executed" in n for n in report.honesty_notes)


class TestExtraction:
    def test_invented_values_caught(self):
        report = run(samples.EXTRACT_PROMPT, samples.EXTRACT_BAD)
        g = next(p for p in report.parameters if p.parameter == "extraction_grounding")
        invented = [e.quote for f in g.findings for e in f.evidence]
        assert any("Erik Larsen" in q for q in invented)
        assert any("Oslo Climate Center" in q for q in invented)

    def test_clean_extraction_scores_full(self):
        report = run(samples.EXTRACT_PROMPT, samples.EXTRACT_GOOD)
        g = next(p for p in report.parameters if p.parameter == "extraction_grounding")
        assert g.score == 100.0


class TestOpenQA:
    def test_risk_signals_found(self):
        report = run(samples.QA_OPEN_PROMPT, samples.QA_OPEN_RISKY)
        risk = next(p for p in report.parameters if p.parameter == "hallucination_risk")
        kinds = {f.data.get("kind") for f in risk.findings}
        assert "citation_pattern" in kinds
        assert "precise_statistic" in kinds
        assert "url" in kinds

    def test_factual_accuracy_declared_out_of_scope(self):
        report = run(samples.QA_OPEN_PROMPT, samples.QA_OPEN_RISKY)
        fact = next(p for p in report.parameters if p.parameter == "factual_accuracy")
        assert fact.score is None and fact.requires_judge

    def test_carveout_honesty_note_present(self):
        report = run(samples.QA_OPEN_PROMPT, samples.QA_OPEN_RISKY)
        assert any("judge" in n.lower() for n in report.honesty_notes)


class TestCreative:
    def test_cliches_flagged_as_proxy(self):
        report = run(samples.CREATIVE_PROMPT, samples.CREATIVE_CLICHED)
        style = next(p for p in report.parameters if p.parameter == "creative_proxies")
        assert style.is_proxy
        assert any(f.failure_mode == FailureMode.LOW_DIVERSITY for f in style.findings)
        quoted = " ".join(e.quote for f in style.findings for e in f.evidence)
        assert "at the end of the day" in quoted or "heart skipped a beat" in quoted


class TestCoverage:
    def test_unanswered_part_found(self):
        report = run(samples.QA_MULTI_PROMPT, samples.QA_MULTI_PARTIAL)
        cov = next(p for p in report.parameters if p.parameter == "question_coverage")
        assert cov.score is not None and cov.score < 100
        assert cov.is_proxy
        quoted = " ".join(e.quote for f in cov.findings for e in f.evidence)
        assert "funded" in quoted.lower()  # the ignored funding question

    def test_known_limitation_topic_mentioned_passes(self):
        """Documents the proxy's honest limit: a question whose topic appears
        in the answer (ice cores) passes the topical check even though it was
        not truly answered. Judge mode is the fix, not a stricter threshold."""
        report = run(samples.QA_MULTI_TOPIC_MENTIONED, samples.QA_MULTI_PARTIAL)
        cov = next(p for p in report.parameters if p.parameter == "question_coverage")
        assert cov.score == 100.0
        assert "topical" in cov.verdict.lower()
