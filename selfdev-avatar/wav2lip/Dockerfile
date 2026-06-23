FROM pytorch/pytorch:1.7.1-cpu
RUN apt-get update && apt-get install -y ffmpeg
RUN pip install numpy scipy opencv-python matplotlib scikit-image dlib

WORKDIR /opt/app/
RUN git clone https://github.com/Rudrabha/Wav2Lip /opt/app

RUN pip install -r requirements.txt
