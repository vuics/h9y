# FROM python:3.12.9-slim-bookworm

# NOTE: python:3.11 solves the error on install:
#
#   > AttributeError: module 'pkgutil' has no attribute 'ImpImporter'.
#
#   This happens because pkgutil.ImpImporter was removed in Python 3.12,
#   but libmagic==1.0, google-search-results==2.4.2, langdetect==1.0.9
#   are still referencing it, likely via its use of an older setuptools or pkg_resources.
FROM python:3.11-slim-bookworm

ENV LANG=C.UTF-8 PYTHONIOENCODING=UTF-8 PYTHONUNBUFFERED=1
ENV PATH="/root/.local/bin:${PATH}"

RUN apt-get update --yes && \
    apt-get upgrade --yes && \
    apt-get install --yes --no-install-recommends python3-dev \
            curl ca-certificates gcc g++ make gnupg \
            npm wget libmagic1 chromium chromium-driver \
            libreoffice \
            tesseract-ocr \
            libzmq3-dev \
            poppler-utils \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs
    # && apt-get clean && rm -rf /var/lib/apt/lists/*

# Verify
RUN node -v && npm -v

# Install Rust using rustup
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Set environment variables for Chrome/Chromium
ENV CHROME_BIN=/usr/bin/chromium \
    CHROMIUM_PATH=/usr/bin/chromium \
    BROWSER=/usr/bin/chromium \
    DISPLAY=:99

RUN npm i -g nodemon
RUN pip install --upgrade pip && \
    pip install \
      setuptools==65.5.0 \
      wheel==0.45.1 \
      nltk==3.9.1 \
      playwright==1.51.0 \
      ipython==9.0.2 \
      ipykernel==6.29.5 \
      bash_kernel==0.10.0
RUN python -m nltk.downloader punkt punkt_tab averaged_perceptron_tagger_eng
RUN python -m ipykernel install --user --name python3
RUN python -m bash_kernel.install
RUN playwright install --with-deps
RUN npm i -g node-gyp
RUN npm i -g ijavascript
RUN ijsinstall --install=global


# Browser-Use requires python3.12
# I am using Dockerfile.browseruse for that
#
# RUN pip install --no-cache-dir uv
# RUN uv pip install --system --no-cache-dir browser-use
# RUN uvx browser-use install


WORKDIR /opt/app/

# NOTE: The requirements.txt is to cache big number of dependencies.
COPY requirements.txt ./
RUN pip install -r requirements.txt

# NOTE: The setup.py will contain additional dependencies.
# It helps for quick installation of new depenencies.
COPY setup.py ./
RUN pip install .

COPY src/*.py ./src/
COPY README.md ./
COPY ./input/ ./input/

ENV PYTHONPATH="${PYTHONPATH}:/opt/app/input/selfdev-notebooks/"

# Run the XMPP agency by default
# CMD ["python", "-m", "src.xmpp_agency"]
CMD ["nodemon", "--exec", "python", "src/agents.py"]

