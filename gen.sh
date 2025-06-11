#!/bin/bash

source activate sadtalker

cd sadtalker/

python inference.py \
  --driven_audio examples/driven_audio/RD_Radio31_000.wav \
  --source_image examples/source_image/art_12.png \
  --enhancer gfpgan --batch_size 1 --cpu --still --preprocess crop --size 256 \
  --result_dir /opt/app/data/

# Example Output:
#
# (base) root@bceaea9137a3:/opt/app# source activate sadtalker
# (sadtalker) root@bceaea9137a3:/opt/app# cd sadtalker/
# (sadtalker) root@bceaea9137a3:/opt/app/sadtalker# python inference.py \
#   --driven_audio examples/driven_audio/RD_Radio31_000.wav \
#   --source_image examples/source_image/art_12.png \
#   --enhancer gfpgan --batch_size 1 --cpu --still --preprocess crop --size 256 \
#   --result_dir /opt/app/data/
# /opt/conda/envs/sadtalker/lib/python3.8/site-packages/torchvision/io/image.py:13: UserWarning: Failed to load image Python extension:
#   warn(f"Failed to load image Python extension: {e}")
# using safetensor as default
# 3DMM Extraction for source image

# landmark Det:: 100%|█████████████████████████████████████████████████████████| 1/1 [00:23<00:00, 23.96s/it]
# 3DMM Extraction In Video:: 100%|█████████████████████████████████████████████| 1/1 [00:04<00:00,  4.14s/it]
# mel:: 100%|███████████████████████████████████████████████████████████| 200/200 [00:00<00:00, 67065.94it/s]
# audio2exp:: 100%|██████████████████████████████████████████████████████████| 20/20 [00:01<00:00, 10.50it/s]
# Face Renderer:: 100%|██████████████████████████████████████████████████| 200/200 [2:33:50<00:00, 46.15s/it]
# The generated video is named /opt/app/data/2025_06_11_02.08.43/art_12##RD_Radio31_000.mp4
# face enhancer....
# Face Enhancer:: 100%|██████████████████████████████████████████████████| 200/200 [2:17:58<00:00, 41.39s/it]
# The generated video is named /opt/app/data/2025_06_11_02.08.43/art_12##RD_Radio31_000_enhanced.mp4
# The generated video is named: /opt/app/data/2025_06_11_02.08.43.mp4

#################

# python app_sadtalker.py

# python inference.py --driven_audio examples/driven_audio/RD_Radio31_000.wav \
#                     --source_image examples/source_image/art_12.png \
#                     --enhancer gfpgan

# python inference.py --driven_audio examples/driven_audio/RD_Radio31_000.wav \
#                     --source_image examples/source_image/art_12.png \
#                     --result_dir out/ \
#                     --still \
#                     --preprocess full \
#                     --enhancer gfpgan

