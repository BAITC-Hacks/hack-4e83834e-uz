FROM python:3.12-slim

WORKDIR /app

# libgl1/libglib2.0-0 are needed by opencv-python (an ultralytics dependency)
# even in a headless container - without them `import cv2` fails at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# Install CPU-only torch/torchvision *first*, from PyTorch's dedicated CPU
# wheel index - otherwise pip resolves ultralytics' unpinned torch
# dependency to the default PyPI wheel, which bundles multi-GB NVIDIA CUDA
# packages nobody needs for a CPU-only deploy (see project constraint:
# "keep everything runnable on CPU"). Pinning here satisfies ultralytics'
# torch>=1.8.0 / torchvision>=0.9.0 requirement without pip reaching for
# the CUDA build. A generous timeout + retries absorb slower connections.
RUN pip install --no-cache-dir --timeout 180 --retries 8 \
    torch==2.13.0 torchvision==0.28.0 --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir --timeout 180 --retries 8 -r requirements.txt

COPY . .

EXPOSE 8000

# Reseeds on every start (app/seed.py is idempotent - drops/recreates all
# tables - see /data/README.md), so the container always boots into a
# populated demo without a separate manual step. Detection uses whatever
# weights are baked into the image at backend/data/weights/roadwatch_ft.pt
# (see /model/README.md); the ranker uses backend/data/ranker.joblib.
CMD ["sh", "-c", "python -m app.seed && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
