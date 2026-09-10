# syntax=docker/dockerfile:1.19
ARG OLLAMA_IMAGE=ollama/ollama:0.32.6
FROM ${OLLAMA_IMAGE}

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
