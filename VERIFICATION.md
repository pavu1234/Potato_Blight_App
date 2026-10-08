# Verification and scope

## Unchanged disease model
`tomato-field-7c921aef.tflite` SHA-256:
`7c921aefe7035e4b7c6ae96d1e5daf065638b6be675dc95afcb998dfedd28004`
The model was downloaded from the currently deployed website and its hash verified. RGB, 224×224 bilinear resizing and float32 0–255 preprocessing are unchanged. New code consumes an event after classification; it does not modify disease probabilities.

## Implemented policy
- Phase 1: no severity percentage, zero duration, manual review.
- Phase 2 bands: 0% Healthy / 0 s; >0–5 Very low / 0 s; >5–10 Low / 2 s; >10–25 Medium / 5 s; >25–50 High / 8 s plus agronomist review; >50 Critical / 0 s plus review.
- Disease confidence <80%, invalid leaf, failed quality check, absent/invalid segmentation, segmentation confidence <80%, mismatched image selection, zero denominator, out-of-leaf disease pixels, or disagreement between Healthy classification and positive severity block the simulation.
- High severity requires operator-recorded agronomist review before the simulation. Every nonzero simulation also requires explicit operator confirmation and a manual water level above zero and no more than 100%.
- Image/input changes, review withdrawal, Stop, hidden tab and page exit stop the timer. Each completed simulation clears confirmation. Critical severity cannot start even when review is recorded.
- The sole product category is “locally registered broad-spectrum protectant fungicide.” This is a simulation category, not a product prescription. Actual product choice and application require the local label and agronomist approval.
- No hardware control, dosing, concentration, mixing-ratio or application-rate calculation exists.

## Quality screening limits
Basic quality screening checks shortest dimension >=224, mean grayscale brightness 20–240, fewer than 70% near-black/near-white pixels, and grayscale Laplacian variance >=8 on a 256×256 view. These are documented heuristics, not a validated image-quality model. They do not guarantee detection of every poor photo. The existing semantic leaf guard can also make mistakes. Imported masks and their confidence require human verification.

## Tests executed
`node tests/policy.test.mjs`: passed all band boundaries, confidence exactly at/below 80%, invalid data, missing/low-confidence segmentation, pixel count constraints, stale image identifiers, confirmation, water, classification conflicts, high/critical severity and mask validation.

Chromium desktop (1440×1000) and mobile (390×844): actual disease classifier loaded and a real Early-blight sample classified. The leaf guard alone was mocked as accepted for this integration test to avoid redownloading its 154 MB model; this was not an accuracy test of the guard. Synthetic mask fixtures tested mask import, exact pixel calculation, two-second simulation after confirmation, timer completion, input-change cancellation, invalid-input clearing and assessment JSON. Those fixture masks are not diagnostic segmentation ground truth and are not shipped as real leaf masks.

No page JavaScript errors or mobile horizontal overflow. WebGL drone rendered; desktop and mobile screenshots inspected. Reduced-motion preference starts with a static drone. Browser results: `tests/browser-results.json`.

No physical drone, camera receiver, tank sensor or pump was used in this test. Existing camera code was preserved. No new model accuracy or real-world severity-validation claim is made.

## Reference material
The numeric simulation policy comes from the user's project specification, not an agronomic dosing schedule.
- University of Minnesota, sprayer calibration basics: https://blog-fruit-vegetable-ipm.extension.umn.edu/2019/03/sprayer-calibration-basics-tips-for.html — calibration and label directions govern real application, which this simulator does not calculate.
- Three.js documentation: https://threejs.org/docs/ — procedural 3D rendering. Three.js 0.180.0 is bundled locally with its MIT license.
