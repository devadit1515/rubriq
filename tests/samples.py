"""Curated prompt/output pairs with known, intended failure modes.
Each pair documents what a sensible evaluator MUST notice."""

SOURCE_ARTICLE = """\
The Larsen Glacier expedition of 1987 was led by Norwegian climatologist
Dr. Ingrid Solheim. Over four months, the twelve-person team drilled ice
cores to a depth of 800 meters, recovering samples dating back roughly
12,000 years. The expedition's findings, published in 1989, showed that
regional temperatures had risen 1.4 degrees Celsius over the preceding
century. Funding came primarily from the Norwegian Polar Institute, with
additional support from the University of Bergen. Two team members were
evacuated in the third month after a crevasse accident, but there were no
fatalities. The ice core archive remains in Tromsø and is still used by
researchers today."""

# --- summarization ---------------------------------------------------------

SUMM_PROMPT = (
    "Summarize the following text in at most 60 words.\n\n" + SOURCE_ARTICLE
)

SUMM_GOOD = (
    "In 1987, Dr. Ingrid Solheim led a twelve-person Norwegian expedition that "
    "drilled 800-meter ice cores on the Larsen Glacier, capturing 12,000 years "
    "of climate data. Published in 1989, the findings showed regional warming "
    "of 1.4 degrees Celsius over a century. Despite a crevasse accident, "
    "no one died."
)  # 51 words, faithful

SUMM_BAD = (
    "The famous 1987 Larsen Glacier expedition, led by the celebrated Dr. Ingrid "
    "Solheim, made groundbreaking discoveries that changed climate science forever. "
    "The team of fifteen brave scientists drilled to an unprecedented 1,200 meters, "
    "and tragically three researchers lost their lives in an avalanche. Their "
    "findings proved that global temperatures rose 3 degrees. It is important to "
    "note that this expedition remains a testament to human perseverance and "
    "stands as a pivotal moment in the history of polar research, inspiring "
    "generations of scientists around the world to pursue climate research."
)  # ~85 words: over limit, wrong team size, wrong depth, invented deaths, wrong figure, filler

# --- code generation --------------------------------------------------------

CODE_PROMPT = (
    "Write a Python function called parse_log_line that takes a log line like "
    "'2024-01-03 ERROR disk full' and returns a dict with keys date, level, "
    "and message."
)

CODE_GOOD = '''Here's the function:

```python
def parse_log_line(line: str) -> dict:
    date, level, message = line.split(" ", 2)
    return {"date": date, "level": level, "message": message}
```

It splits on the first two spaces so messages may contain spaces.'''

CODE_BAD = '''```python
def parse_line(line):
    # TODO: implement parsing logic
    parts = line.split(" "
    return {"date": parts[0]}
```'''  # wrong name, syntax error, TODO stub

# --- extraction -------------------------------------------------------------

EXTRACT_PROMPT = (
    "Extract all person names and institutions from the following text as JSON "
    'with keys "people" and "institutions".\n\n' + SOURCE_ARTICLE
)

EXTRACT_GOOD = """{"people": ["Dr. Ingrid Solheim"], "institutions": ["Norwegian Polar Institute", "University of Bergen"]}"""

EXTRACT_BAD = """{"people": ["Dr. Ingrid Solheim", "Dr. Erik Larsen"], "institutions": ["Norwegian Polar Institute", "Oslo Climate Center"]}"""
# Erik Larsen and Oslo Climate Center are invented

# --- open-world QA ----------------------------------------------------------

QA_OPEN_PROMPT = "What are the health benefits of intermittent fasting?"

QA_OPEN_RISKY = (
    "Intermittent fasting has remarkable health benefits. Studies show that it "
    "extends lifespan by 23.5% and reduces cancer risk by 41%. According to "
    "Dr. James Hoffman of Harvard Medical School, \"fasting is the single most "
    "powerful intervention in modern medicine\" (Hoffman et al., 2019). Research "
    "published at https://fasting-institute.org/study confirms these findings."
)

# --- creative writing -------------------------------------------------------

CREATIVE_PROMPT = "Write a short story opening about a sailor returning home after ten years at sea."

CREATIVE_CLICHED = (
    "At the end of the day, the old sailor knew that home was where the heart is. "
    "Little did he know what awaited him. His heart skipped a beat as the ship "
    "pulled into the bustling harbor, a whirlwind of emotions washing over him. "
    "In the blink of an eye, ten long years had passed, and time stood still as "
    "he gazed upon the picturesque village nestled in the hills, a hidden gem "
    "against all odds. It was a testament to his perseverance."
)

# --- multi-part grounded QA -------------------------------------------------

QA_MULTI_PROMPT = (
    "Based on the following text, answer these questions. Who led the expedition? "
    "How deep did they drill? Who funded it?\n\n"
    + SOURCE_ARTICLE
)

QA_MULTI_PARTIAL = (
    "The expedition was led by Dr. Ingrid Solheim, a Norwegian climatologist. "
    "The team drilled ice cores to a depth of 800 meters over four months."
)  # funding question ignored — its key terms never appear in the answer

# Documented limitation of the topical coverage proxy: a question whose TOPIC
# appears in the answer but is not actually answered will pass. Kept as a test
# so the limitation stays visible.
QA_MULTI_TOPIC_MENTIONED = (
    "Based on the following text, answer these questions. Who led the expedition? "
    "What happened to the ice cores afterwards?\n\n" + SOURCE_ARTICLE
)
