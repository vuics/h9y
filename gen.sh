#!/bin/sh

source activate sadtalker

python inference.py \
  --driven_audio examples/driven_audio/RD_Radio31_000.wav \
  --source_image examples/source_image/art_12.png \
  --enhancer gfpgan --batch_size 1 --cpu --still --preprocess crop --size 256 \
  --result_dir out/

# # pip install tts
# # python app_sadtalker.py

# python inference.py --driven_audio examples/driven_audio/RD_Radio31_000.wav \
#                     --source_image examples/source_image/art_12.png \
#                     --enhancer gfpgan

# python inference.py --driven_audio examples/driven_audio/RD_Radio31_000.wav \
#                     --source_image examples/source_image/art_12.png \
#                     --result_dir out/ \
#                     --still \
#                     --preprocess full \
#                     --enhancer gfpgan
