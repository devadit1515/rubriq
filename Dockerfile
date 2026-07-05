# Rubriq engine + UI, single container. Built for Hugging Face Spaces
# (Docker SDK, port 7860) but runs anywhere: docker run -p 7860:7860 rubriq
FROM python:3.12-slim

# HF Spaces convention: run as UID 1000 with a writable home.
RUN useradd -m -u 1000 user
USER user
ENV PATH="/home/user/.local/bin:$PATH" \
    HF_HOME="/home/user/.cache/huggingface" \
    OMP_NUM_THREADS=2
WORKDIR /home/user/app

# CPU-only torch first: the default wheel drags CUDA (~5GB) into the image.
RUN pip install --no-cache-dir --user torch --index-url https://download.pytorch.org/whl/cpu

COPY --chown=user pyproject.toml README.md ./
COPY --chown=user rubriq ./rubriq
RUN pip install --no-cache-dir --user .

# Bake both models into the image so cold starts skip the download.
RUN python -c "from rubriq.models import availability; a = availability(); assert all(a.values()), a"

# API-only: the frontend lives on Vercel and reaches this engine via rewrites, so
# the image ships no web assets. (If a web/dist is mounted at runtime it is served,
# but the deployed engine does not carry one.)

EXPOSE 7860
CMD ["uvicorn", "rubriq.api.main:app", "--host", "0.0.0.0", "--port", "7860"]
