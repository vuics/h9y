#!/bin/bash

download_and_check_retry() {
  url="$1"
  target="$2"

  for i in {1..3}; do
    wget -nc "$url" -O "$target"
    if [ -s "$target" ]; then
      echo "✅ Successfully downloaded $target"
      return 0
    fi
    echo "⚠️ Download failed or empty. Retrying ($i)..."
    sleep 2
  done

  echo "❌ ERROR: Failed to download non-empty $target after 3 attempts."
  exit 1
}


# Models
mkdir ./checkpoints
download_and_check_retry https://github.com/OpenTalker/SadTalker/releases/download/v0.0.2-rc/mapping_00109-model.pth.tar ./checkpoints/mapping_00109-model.pth.tar

download_and_check_retry https://github.com/OpenTalker/SadTalker/releases/download/v0.0.2-rc/mapping_00229-model.pth.tar ./checkpoints/mapping_00229-model.pth.tar
download_and_check_retry https://github.com/OpenTalker/SadTalker/releases/download/v0.0.2-rc/SadTalker_V0.0.2_256.safetensors ./checkpoints/SadTalker_V0.0.2_256.safetensors
download_and_check_retry https://github.com/OpenTalker/SadTalker/releases/download/v0.0.2-rc/SadTalker_V0.0.2_512.safetensors ./checkpoints/SadTalker_V0.0.2_512.safetensors

# Enhancer
mkdir -p ./gfpgan/weights
download_and_check_retry https://github.com/xinntao/facexlib/releases/download/v0.1.0/alignment_WFLW_4HG.pth ./gfpgan/weights/alignment_WFLW_4HG.pth
download_and_check_retry https://github.com/xinntao/facexlib/releases/download/v0.1.0/detection_Resnet50_Final.pth ./gfpgan/weights/detection_Resnet50_Final.pth
download_and_check_retry https://github.com/TencentARC/GFPGAN/releases/download/v1.3.0/GFPGANv1.4.pth ./gfpgan/weights/GFPGANv1.4.pth
download_and_check_retry https://github.com/xinntao/facexlib/releases/download/v0.2.2/parsing_parsenet.pth ./gfpgan/weights/parsing_parsenet.pth
