# Use official Python image
# FROM python:3.8-slim
FROM python:3.6-slim

# Install system dependencies
RUN apt-get update && \
    apt-get install -y ffmpeg git build-essential libglib2.0-0 libsm6 libxext6 libxrender-dev && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Clone LipGAN and switch to fully_pythonic branch
RUN git clone https://github.com/Rudrabha/LipGAN.git /app && \
    git checkout fully_pythonic

# Install pip dependencies
COPY requirements.txt requirements.txt
RUN pip install --upgrade pip
RUN pip install numpy==1.13.3
RUN pip install -r /app/requirements.txt && \
RUN pip install git+https://www.github.com/keras-team/keras-contrib.git

# Default command
CMD [ "python", "inference.py" ]
