// Demo sample pairs. Each has a planted, known failure profile so the
// report teaches the interface (see tests/samples.py for the source pairs).

window.RUBRIQ_SAMPLES = (() => {
  const ARTICLE = `The Larsen Glacier expedition of 1987 was led by Norwegian climatologist
Dr. Ingrid Solheim. Over four months, the twelve-person team drilled ice
cores to a depth of 800 meters, recovering samples dating back roughly
12,000 years. The expedition's findings, published in 1989, showed that
regional temperatures had risen 1.4 degrees Celsius over the preceding
century. Funding came primarily from the Norwegian Polar Institute, with
additional support from the University of Bergen. Two team members were
evacuated in the third month after a crevasse accident, but there were no
fatalities. The ice core archive remains in Tromsø and is still used by
researchers today.`;

  return [
    {
      label: "Sabotaged summary",
      hint: "invented facts + blown word limit",
      model: "gpt-4o",
      prompt: "Summarize the following text in at most 60 words.\n\n" + ARTICLE,
      output:
        "The famous 1987 Larsen Glacier expedition, led by the celebrated Dr. Ingrid " +
        "Solheim, made groundbreaking discoveries that changed climate science forever. " +
        "The team of fifteen brave scientists drilled to an unprecedented 1,200 meters, " +
        "and tragically three researchers lost their lives in an avalanche. Their " +
        "findings proved that global temperatures rose 3 degrees. It is important to " +
        "note that this expedition remains a testament to human perseverance and " +
        "stands as a pivotal moment in the history of polar research, inspiring " +
        "generations of scientists around the world to pursue climate research.",
    },
    {
      label: "Faithful summary",
      hint: "the same task, done right",
      model: "claude sonnet",
      prompt: "Summarize the following text in at most 60 words.\n\n" + ARTICLE,
      output:
        "In 1987, Dr. Ingrid Solheim led a twelve-person Norwegian expedition that " +
        "drilled 800-meter ice cores on the Larsen Glacier, capturing 12,000 years " +
        "of climate data. Published in 1989, the findings showed regional warming " +
        "of 1.4 degrees Celsius over a century. Despite a crevasse accident, " +
        "no one died.",
    },
    {
      label: "Broken code",
      hint: "syntax error + wrong function name",
      model: "llama-3.1-70b",
      prompt:
        "Write a Python function called parse_log_line that takes a log line like " +
        "'2024-01-03 ERROR disk full' and returns a dict with keys date, level, " +
        "and message.",
      output:
        "```python\ndef parse_line(line):\n    # TODO: implement parsing logic\n" +
        "    parts = line.split(\" \"\n    return {\"date\": parts[0]}\n```",
    },
    {
      label: "Confident nonsense",
      hint: "fabricated citations & statistics",
      model: "gemini 2.0 pro",
      prompt: "What are the health benefits of intermittent fasting?",
      output:
        "Intermittent fasting has remarkable health benefits. Studies show that it " +
        "extends lifespan by 23.5% and reduces cancer risk by 41%. According to " +
        "Dr. James Hoffman of Harvard Medical School, \"fasting is the single most " +
        "powerful intervention in modern medicine\" (Hoffman et al., 2019). Research " +
        "published at https://fasting-institute.org/study confirms these findings.",
    },
  ];
})();
