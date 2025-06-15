# Use miniconda base image
FROM continuumio/miniconda3:25.3.1-1

ENV LANG=C.UTF-8 PYTHONIOENCODING=UTF-8 PYTHONUNBUFFERED=1
ENV PATH="/root/.local/bin:${PATH}"

RUN apt-get update --yes && \
    apt-get upgrade --yes && \
    apt-get install --yes --no-install-recommends python3-dev \
            curl ca-certificates gcc g++ make gnupg \
            npm wget cmake \
            libgl1 libglib2.0-0 \
            build-essential \
            pkg-config \
            libopenblas-dev \
            liblapack-dev \
            libx11-dev \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs
    # && apt-get clean && rm -rf /var/lib/apt/lists/*

# Verify
RUN node -v && npm -v
RUN npm i -g nodemon

# Set working directory
WORKDIR /opt/app/sadtalker

# Clone the SadTalker repo
RUN git clone https://github.com/OpenTalker/SadTalker.git /opt/app/sadtalker

# Create conda environment and install python
RUN conda create -n sadtalker python=3.8 -y
# RUN conda create -n sadtalker python=3.11 -y

# Activate environment and install dependencies
# RUN conda run -n sadtalker pip install torch==1.12.1 torchvision==0.13.1 torchaudio dlib
RUN conda run -n sadtalker pip install torch==1.12.1 torchvision==0.13.1 torchaudio
RUN conda install -n sadtalker -c conda-forge ffmpeg dlib -y
RUN conda run -n sadtalker pip install -r requirements.txt

# Make the download_models.sh script executable and run it inside the environment
# RUN chmod +x ./scripts/download_models.sh
# RUN ./scripts/download_models.sh

COPY ./download.sh ./
RUN ./download.sh

WORKDIR /opt/app/

COPY requirements.txt ./
RUN conda run -n sadtalker pip install -r requirements.txt

COPY src/*.py ./src/
COPY README.md *.sh ./

ENV OMP_NUM_THREADS=8
ENV PYTORCH_ENABLE_MPS_FALLBACK=1

# RUN wget -nc https://github.com/Winfredy/SadTalker/releases/download/v0.0.2/epoch_20.pth -O ./sadtalker/checkpoints/epoch_20.pth

EXPOSE 8533

# CMD ["nodemon", "--exec", "python", "/opt/app/src/avatar.py"]
# CMD ["conda", "run", "-n", "sadtalker", "nodemon", "--exec", "python", "/opt/app/src/avatar.py"]
CMD ["./run.sh"]
