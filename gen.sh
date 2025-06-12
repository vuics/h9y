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




# INFO:server:command stdout: /opt/conda/envs/sadtalker/lib/python3.8/site-packages/torchvision/io/image.py:13: UserWarning: Failed to load image Python extension:
# warn(f"Failed to load image Python extension: {e}")
# using safetensor as default
# 3DMM Extraction for source image


# landmark Det::   0%|          | 0/1 [00:00<?, ?it/s]
# landmark Det:: 100%|██████████| 1/1 [00:22<00:00, 22.37s/it]
# landmark Det:: 100%|██████████| 1/1 [00:22<00:00, 22.37s/it]


# 3DMM Extraction In Video::   0%|          | 0/1 [00:00<?, ?it/s]
# 3DMM Extraction In Video:: 100%|██████████| 1/1 [00:03<00:00,  3.66s/it]
# 3DMM Extraction In Video:: 100%|██████████| 1/1 [00:03<00:00,  3.66s/it]


# mel::   0%|          | 0/10 [00:00<?, ?it/s]
# mel:: 100%|██████████| 10/10 [00:00<00:00, 40291.10it/s]


# audio2exp::   0%|          | 0/1 [00:00<?, ?it/s]
# audio2exp:: 100%|██████████| 1/1 [00:00<00:00,  7.89it/s]
# audio2exp:: 100%|██████████| 1/1 [00:00<00:00,  7.88it/s]


# Face Renderer::   0%|          | 0/10 [00:00<?, ?it/s]
# Face Renderer::  10%|█         | 1/10 [00:52<07:48, 52.04s/it]
# Face Renderer::  20%|██        | 2/10 [01:42<06:48, 51.01s/it]
# Face Renderer::  30%|███       | 3/10 [02:31<05:51, 50.27s/it]
# Face Renderer::  40%|████      | 4/10 [03:20<04:59, 49.86s/it]
# Face Renderer::  50%|█████     | 5/10 [04:10<04:08, 49.64s/it]
# Face Renderer::  60%|██████    | 6/10 [04:59<03:17, 49.44s/it]
# Face Renderer::  70%|███████   | 7/10 [05:50<02:29, 49.92s/it]
# Face Renderer::  80%|████████  | 8/10 [06:40<01:40, 50.10s/it]
# Face Renderer::  90%|█████████ | 9/10 [07:31<00:50, 50.29s/it]
# Face Renderer:: 100%|██████████| 10/10 [08:21<00:00, 50.30s/it]
# Face Renderer:: 100%|██████████| 10/10 [08:21<00:00, 50.17s/it]
# IMAGEIO FFMPEG_WRITER WARNING: input image is not divisible by macro_block_size=16, resizing from (256, 236) to (256, 240) to ensure video compatibility with most codecs and players. To prevent resizing, make your input image divisible by the macro_block_size or set the macro_block_size to 1 (risking incompatibility).
# The generated video is named /opt/app/data/2025_06_12_00.55.17/test##0a2a54a021004bdf87745d21d436e960_converted.mp4
# face enhancer....


# Face Enhancer::   0%|          | 0/10 [00:00<?, ?it/s]
# Face Enhancer::  10%|█         | 1/10 [00:41<06:09, 41.04s/it]
# Face Enhancer::  20%|██        | 2/10 [01:21<05:26, 40.83s/it]
# Face Enhancer::  30%|███       | 3/10 [02:02<04:46, 40.90s/it]
# Face Enhancer::  40%|████      | 4/10 [02:43<04:06, 41.04s/it]
# Face Enhancer::  50%|█████     | 5/10 [03:24<03:23, 40.74s/it]
# Face Enhancer::  60%|██████    | 6/10 [04:05<02:43, 40.86s/it]
# Face Enhancer::  70%|███████   | 7/10 [04:45<02:02, 40.79s/it]
# Face Enhancer::  80%|████████  | 8/10 [05:26<01:21, 40.59s/it]
# Face Enhancer::  90%|█████████ | 9/10 [06:06<00:40, 40.67s/it]
# Face Enhancer:: 100%|██████████| 10/10 [06:47<00:00, 40.60s/it]
# Face Enhancer:: 100%|██████████| 10/10 [06:47<00:00, 40.74s/it]
# The generated video is named /opt/app/data/2025_06_12_00.55.17/test##0a2a54a021004bdf87745d21d436e960_converted_enhanced.mp4
# The generated video is named: /opt/app/data/2025_06_12_00.55.17.mp4
# DEBUG:server:Deleted temporary file: /tmp/uploads/test.jpg
# DEBUG:server:Deleted temporary file: /tmp/uploads/recording-1749689086566.webm
# DEBUG:server:Deleted temporary file: /tmp/uploads/0a2a54a021004bdf87745d21d436e960_converted.wav
# INFO:     172.21.0.10:57926 - "POST /process HTTP/1.1" 200 OK




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








