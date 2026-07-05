"""Deterministic constraint extraction + checking. No models needed."""

from rubriq.constraints import extract_constraints, run_checks


def kinds(instruction):
    return {c.kind for c in extract_constraints(instruction)}


class TestExtraction:
    def test_max_words(self):
        assert "max_word" in kinds("Summarize this in at most 150 words.")
        assert "max_word" in kinds("Keep it under 50 words please")
        assert "max_word" in kinds("no more than 100 words")

    def test_min_and_exact_and_approx(self):
        assert "min_word" in kinds("Write at least 300 words about dogs.")
        assert "exact_sentence" in kinds("Answer in exactly two sentences.")
        assert "approx_word" in kinds("Write about 200 words on this topic.")

    def test_bullets_and_format(self):
        assert "max_bullet" in kinds("Give me at most 5 bullet points.")
        assert "format_json" in kinds("Return the result as JSON.")
        assert "format_json" in kinds("Output valid JSON only")
        assert "format_table" in kinds("Present this as a markdown table.")
        assert "single_paragraph" in kinds("Explain it in a single paragraph.")

    def test_include_exclude(self):
        ks = extract_constraints('Include the word "sustainability" and don\'t use the word "synergy".')
        got = {(c.kind, c.params.get("term")) for c in ks}
        assert ("must_include", "sustainability") in got
        assert ("must_exclude", "synergy") in got

    def test_no_false_positives_on_plain_prompt(self):
        assert kinds("Tell me about the history of Rome.") == set()


class TestChecking:
    def test_word_limit_violation_detected(self):
        results = run_checks("Summarize in at most 10 words.", "This output has quite a few more than ten words in it, clearly.")
        r = next(r for r in results if r.constraint.kind == "max_word")
        assert not r.passed

    def test_word_limit_pass(self):
        results = run_checks("Summarize in at most 10 words.", "Seven words are in this sentence, exactly.")
        r = next(r for r in results if r.constraint.kind == "max_word")
        assert r.passed

    def test_json_validity(self):
        ok = run_checks("Return as JSON.", '{"a": 1}')
        assert ok[0].passed
        bad = run_checks("Return as JSON.", '{"a": 1,,}')
        assert not bad[0].passed
        assert "position" in bad[0].detail

    def test_json_in_fence_ok(self):
        ok = run_checks("Return as JSON.", '```json\n{"a": 1}\n```')
        assert ok[0].passed

    def test_must_exclude_quotes_evidence(self):
        results = run_checks('Avoid using the word "leverage".', "We can leverage this approach.")
        r = next(r for r in results if r.constraint.kind == "must_exclude")
        assert not r.passed
        assert r.evidence and "leverage" in r.evidence[0].quote.lower()

    def test_code_fence_excluded_from_word_count(self):
        prompt = "Explain in at most 20 words."
        output = "Short answer here, well within limits.\n```python\n" + "x = 1\n" * 200 + "```"
        r = next(r for r in run_checks(prompt, output) if r.constraint.kind == "max_word")
        assert r.passed
