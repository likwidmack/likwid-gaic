# syntax=docker/dockerfile:1.19
ARG PYTORCH_IMAGE=pytorch/pytorch:2.13.0-cuda13.0-cudnn9-runtime
FROM ${PYTORCH_IMAGE}

ENV DEBIAN_FRONTEND=noninteractive \
    HOME=/home/ubuntu \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_BREAK_SYSTEM_PACKAGES=1 \
    HF_HOME=/cache/huggingface \
    TORCH_HOME=/cache/torch
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg git libgl1 libglib2.0-0 libgomp1 \
    && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /opt/comfyui /data/input /data/output /data/temp /data/user /cache/huggingface /cache/torch \
    && chown -R ubuntu:ubuntu /opt/comfyui /data /cache
WORKDIR /opt/comfyui
COPY --from=comfy_source requirements.txt /tmp/comfyui-requirements-source.txt
RUN sed -E '/^(torch|torchvision|torchaudio)([[:space:]]|$)/d' /tmp/comfyui-requirements-source.txt > /tmp/comfyui-requirements.txt \
    && python -m pip install --no-cache-dir -r /tmp/comfyui-requirements.txt \
    && rm /tmp/comfyui-requirements-source.txt /tmp/comfyui-requirements.txt
COPY --from=comfy_source --chown=ubuntu:ubuntu \
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
    --exclude=__pycache__ \
    --exclude=**/__pycache__ \
    --exclude=input \
    --exclude=input/** \
    --exclude=models \
    --exclude=models/** \
    --exclude=output \
    --exclude=output/** \
    --exclude=temp \
    --exclude=temp/** \
    --exclude=user \
    --exclude=user/** \
    . .
RUN rm -rf /opt/comfyui/models \
    && ln -s /shared/models /opt/comfyui/models \
    && mkdir -p /shared/models /shared/tensors /shared/objects /shared/plugins /shared/tools

USER ubuntu
EXPOSE 8188
ENTRYPOINT ["python", "-u", "main.py"]
CMD ["--listen", "0.0.0.0", "--port", "8188", "--input-directory", "/data/input", "--output-directory", "/data/output", "--temp-directory", "/data/temp", "--user-directory", "/data/user", "--disable-api-nodes"]
