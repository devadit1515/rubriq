"""Task classification on the sample pairs (rules; embeddings when cached)."""

import samples
from rubriq.classify import classify, split_instruction_and_source
from rubriq.schemas import TaskType


def test_summarization_detected():
    c = classify(samples.SUMM_PROMPT, samples.SUMM_GOOD)
    assert c.task_type == TaskType.SUMMARIZATION
    assert c.has_source_text


def test_code_detected():
    c = classify(samples.CODE_PROMPT, samples.CODE_GOOD)
    assert c.task_type == TaskType.CODE_GENERATION


def test_extraction_detected():
    c = classify(samples.EXTRACT_PROMPT, samples.EXTRACT_GOOD)
    assert c.task_type == TaskType.EXTRACTION
    assert c.has_source_text


def test_creative_detected():
    c = classify(samples.CREATIVE_PROMPT, samples.CREATIVE_CLICHED)
    assert c.task_type == TaskType.CREATIVE_WRITING


def test_open_qa_detected():
    c = classify(samples.QA_OPEN_PROMPT, samples.QA_OPEN_RISKY)
    assert c.task_type == TaskType.QA_OPEN
    assert not c.has_source_text


def test_grounded_qa_upgrade():
    c = classify(samples.QA_MULTI_PROMPT, samples.QA_MULTI_PARTIAL)
    assert c.task_type == TaskType.QA_GROUNDED
    assert c.has_source_text


def test_source_split_keeps_instruction():
    instruction, source = split_instruction_and_source(samples.SUMM_PROMPT)
    assert "at most 60 words" in instruction
    assert source is not None and "Solheim" in source
