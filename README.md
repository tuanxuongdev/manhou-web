# Manhou on-device models

Files the Manhou app downloads at runtime, pinned by size and SHA-256 in the app's model manifest
(`src/engine/ai/models.ts`). Nothing here is bundled into the APK.

## ppmattingv2-stdc1-human-dyn.onnx

- Model: PP-MattingV2 human matting, 512 (STDC1), from PaddleSeg (https://github.com/PaddlePaddle/PaddleSeg, Matting).
- Licence: Apache License 2.0, see `LICENSE-PaddleSeg` (copied from PaddleSeg release/2.9).
- Source: the official inference model
  https://paddleseg.bj.bcebos.com/matting/models/deploy/ppmattingv2-stdc1-human_512.zip
  (sha256 daff48b08c61958b9a21093791f6aed8eb3939b34b7418e40c18b2348136893d).
- Changes: converted to ONNX with Paddle2ONNX 1.3.1 (opset 13), and the input height and width were made dynamic
  (`h`, `w`). The weights are unchanged.
- Input `img`: float32 [1, 3, H, W], RGB, (x / 255 − 0.5) / 0.5, with H and W multiples of 32.
- Output `sigmoid_5.tmp_0`: float32 [1, 1, H, W], alpha 0–1.
- Size 35 943 227 bytes, sha256 93024a53fa0b543fdef25452f2cbc6132381d666f649e67511b3a5118d2a4007.
