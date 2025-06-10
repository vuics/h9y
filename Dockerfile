# git clone https://github.com/OpenTalker/SadTalker.git
# cd SadTalker 
# conda create -n sadtalker python=3.8
# conda activate sadtalker
# # install pytorch 2.0
# # pip install torch torchvision torchaudio
# pip install torch==1.12.1 torchvision==0.13.1 torchaudio
# conda install ffmpeg
# pip install -r requirements.txt
# pip install dlib # macOS needs to install the original dlib.

# chmod +x ./scripts/download_models.sh
# ./scripts/download_models.sh

# # wget -nc https://github.com/Winfredy/SadTalker/releases/download/v0.0.2/epoch_20.pth -O ./checkpoints/epoch_20.pth
# ```

# ```bash
# # pip install tts
# # python app_sadtalker.py

# # python inference.py --driven_audio examples/driven_audio/RD_Radio31_000.wav \
# #                     --source_image examples/source_image/art_12.png \
# #                     --enhancer gfpgan

# # python inference.py --driven_audio examples/driven_audio/RD_Radio31_000.wav \
# #                     --source_image examples/source_image/art_12.png \
# #                     --result_dir out/ \
# #                     --still \
# #                     --preprocess full \
# #                     --enhancer gfpgan
# ```


# Use miniconda base image
FROM continuumio/miniconda3:25.3.1-1

ENV LANG=C.UTF-8 PYTHONIOENCODING=UTF-8 PYTHONUNBUFFERED=1
ENV PATH="/root/.local/bin:${PATH}"

RUN apt-get update --yes && \
    apt-get upgrade --yes && \
    apt-get install --yes --no-install-recommends python3-dev \
            curl ca-certificates gcc g++ make gnupg \
            npm wget cmake \
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
# Note: Use bash -c to chain commands within the environment
RUN /bin/bash -c "\
    source activate sadtalker && \
    pip install torch==1.12.1 torchvision==0.13.1 torchaudio && \
    conda install -n sadtalker -c conda-forge ffmpeg -y && \
    pip install -r requirements.txt && \
    pip install dlib"

# Make the download_models.sh script executable and run it inside the environment
RUN /bin/bash -c "\
    source activate sadtalker && \
    chmod +x ./scripts/download_models.sh && \
    ./scripts/download_models.sh"

# Set environment variable to activate conda env on container start
SHELL ["conda", "run", "-n", "sadtalker", "/bin/bash", "-c"]


WORKDIR /opt/app/

COPY requirements.txt ./

RUN /bin/bash -c "\
    source activate sadtalker && \
    pip install -r requirements.txt"

COPY src/*.py ./src/
COPY README.md ./

EXPOSE 8533
# CMD ["nodemon", "--exec", "python", "/opt/app/src/avatar.py"]
# CMD ["/bin/bash", "-c", "sleep 3000"]

