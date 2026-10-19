# Polaroid face detector

The application bundles OpenCV Zoo's YuNet model for local face detection.
It does not identify people or upload photos. Only bounding boxes and upright
face landmarks are used for photo orientation and framing.

- Model: `face_detection_yunet_2023mar.onnx` (232,589 bytes)
- Source: <https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet>
- Download: <https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx>
- SHA-256: `8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4`
- License: [MIT](YUNET-LICENSE.txt), included in packaged application resources.

Inference uses the pinned ONNX Runtime Web CPU/WASM dependency, one thread,
640x640 inputs, and one session per Polaroid batch. The model, matching WASM
binary and matching loader module are bundled with the renderer for offline use.
No model download or remote inference is performed when preparing photos.
