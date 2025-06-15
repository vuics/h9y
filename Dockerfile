FROM ghcr.io/speaches-ai/speaches:0.8.0-cpu

RUN uv sync --all-extras

USER root
RUN apt-get update && apt-get install -y python3 python3-pip sudo
RUN pip3 install --break-system-packages speaches-cli==0.1.0
# RUN apt-get clean && rm -rf /var/lib/apt/lists/*
# USER ubuntu

COPY ./run.sh .

ENV SPEACHES_BASE_URL="http://127.0.0.1:8372"
ENV UVICORN_PORT=8372
EXPOSE 8372

# CMD ["uvicorn", "--factory", "speaches.main:create_app"]
CMD ["./run.sh"]
