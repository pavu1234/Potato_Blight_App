# Leaf-input check verification

## Implemented behavior

Every normal prediction entry point uses `predict()` in app.js, including the registered analysis tool. Before image preprocessing or disease inference, it awaits LeafGuard. Only status `leaf` proceeds. `not-leaf` and `uncertain` hide disease results and clear disease scores. Unavailable/failed leaf checking blocks prediction. Changing an image during checking cancels the stale result. The main thread prevents concurrent prediction requests.

The disease model weights, three-class order and RGB float32 0–255, bilinear 224 × 224 preprocessing remain unchanged. Existing camera connections are not modified. Added input verification affects acceptance rate and latency; original disease-only validation accuracy must not be used as the accuracy of this combined system.

The checker is CLIP ViT-B/32 quantized, distributed by Xenova for Transformers.js, pinned to revision d15189d7028b43f1d3e65039190477f6af591c2a. Transformers.js is pinned and vendored at 2.17.2. It compares explicit leaf prompts to face/person, animal, household object, screenshot, vegetation/field and other prompts. Acceptance requires a strong leaf preference; thresholds are conservative implementation choices, not statistically calibrated probabilities. No gate score is presented as a percentage of correctness.

## Checks performed

- Ran the actual quantized semantic model locally: three provided leaf examples (healthy, early blight and late blight) passed; the supplied screenshot, its extracted face-photo region, and the project drone illustration were rejected.
- Ran real CLIP WebAssembly inference inside Chromium with the production browser worker. Downloaded model bytes were served locally during this test; disease inference was mocked solely to count whether it was invoked.
- Browser flow: face rejected with zero disease calls; healthy leaf passed with one disease call; face after that rejected without another disease call or stale disease result.
- Checked 1440-pixel desktop and 390-pixel mobile rendering, rejection message visibility and horizontal overflow.
- Integration unit checks passed for non-leaf/uncertain rejection, missing checker, check failure, image changes while checking, duplicate requests, and accepted input retaining original preprocessing.
- Referenced UI element IDs were verified; modified JavaScript syntax checked.

This is a small smoke/regression test, not an independent accuracy evaluation. No user face image, screenshot or model scores from it are included in this package. No physical-drone, Safari, Android/iOS hardware, broad out-of-distribution, or large independent dataset test is claimed. A lightweight domain-trained leaf/non-leaf detector and representative validation data would be needed for stronger performance and reliability claims.

## Runtime behavior

The worker keeps the classifier loaded for this tab. The main thread caches a verdict only for the same decoded Image object. Each newly selected upload/capture is checked again. Model files may be cached by the browser. The image remains local; only model files are fetched remotely. The first download and processing can take time on a slow connection or device. A four-minute timeout or worker failure blocks disease inference and allows retry.

## Sources and licenses

- https://huggingface.co/Xenova/clip-vit-base-patch32
- https://huggingface.co/docs/transformers.js/v2.17.2/api/pipelines
- https://github.com/openai/CLIP

Third-party licenses and notices are in vendor/. Do not remove them when redistributing the packaged runtime.
