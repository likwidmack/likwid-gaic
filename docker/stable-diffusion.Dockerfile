# syntax=docker/dockerfile:1.19
FROM pytorch/pytorch:2.8.0-cuda12.8-cudnn9-runtime

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
RUN apt-get update \
    && apt-get install -y --no-install-recommends git libgl1 libglib2.0-0 libgoogle-perftools4 libtcmalloc-minimal4 \
    && rm -rf /var/lib/apt/lists/*
RUN useradd --create-home --uid 1000 app \
    && mkdir -p /opt/stable-diffusion /data /shared/models /shared/tensors /shared/objects /shared/plugins /shared/tools \
    && chown -R app:app /opt/stable-diffusion /data /shared
WORKDIR /opt/stable-diffusion
COPY --from=stable_source --chown=app:app \
    --exclude=.git \
    --exclude=.git/** \
    --exclude=.env \
    --exclude=.env.* \
    --exclude=**/.env \
    --exclude=**/.env.* \
    --exclude=.venv \
    --exclude=.venv/** \
    --exclude=venv \
    --exclude=venv/** \
    --exclude=models \
    --exclude=models/** \
    --exclude=outputs \
    --exclude=outputs/** \
    --exclude=repositories \
    --exclude=repositories/** \
    . .
RUN python -m pip install --no-cache-dir \
      'https://github.com/openai/CLIP/archive/d50d76daa670286dd6cacf3bcd80b5e4823fc8e1.zip' \
    && python -m pip install --no-cache-dir \
      'https://github.com/mlfoundations/open_clip/archive/bb6e834e9c70d9c27d0dc3ecedeebeaeb1ffad6b.zip' \
    && python -m pip install --no-cache-dir -r requirements_versions.txt
USER app
RUN git config --global --add safe.directory '/opt/stable-diffusion/repositories/stable-diffusion-webui-assets' \
    && git config --global --add safe.directory '/opt/stable-diffusion/repositories/stable-diffusion-stability-ai' \
    && git config --global --add safe.directory '/opt/stable-diffusion/repositories/generative-models' \
    && git config --global --add safe.directory '/opt/stable-diffusion/repositories/k-diffusion' \
    && git config --global --add safe.directory '/opt/stable-diffusion/repositories/BLIP'
EXPOSE 7860
ENTRYPOINT ["python", "-u", "launch.py"]
CMD ["--listen", "--api", "--port", "7860", "--data-dir", "/data", "--ckpt-dir", "/shared/models/Stable-diffusion", "--vae-dir", "/shared/models/VAE", "--lora-dir", "/shared/models/Lora", "--embeddings-dir", "/shared/models/embeddings", "--no-download-sd-model", "--skip-version-check"]
