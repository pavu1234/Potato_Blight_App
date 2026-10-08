# Compatible camera connections

The same trained leaf classifier processes uploads and captured frames. This update changes video acquisition only. A drone must provide a compatible video output; the website cannot unlock a proprietary camera or connect to an arbitrary drone app.

## 1. Phone or laptop

Choose **Phone / laptop camera**, click **Drone ON**, and allow permission. On phones, the rear camera is preferred when available. Capture a still image, then click **Analyze leaf**. The camera stays live until OFF, tab hiding or page exit.

## 2. Drone receiver or capture device

Use a receiver/controller that actually provides video output, with a capture device supported by your computer or phone. A USB charging cable alone is not a video connection.

1. Connect the video receiver and capture hardware.
2. Choose **Drone via connected capture device** and refresh the camera list.
3. Select its exact camera entry. If names are hidden, use Phone / laptop mode once to grant camera permission, turn it OFF, then refresh the device list.
4. Choose Drone ON and verify the preview is from the aircraft camera before capturing.

The browser cannot identify whether a selected camera belongs to an aircraft. Selection is explicit; an unavailable device causes an error instead of opening a default camera. Hardware and mobile browser support must be checked on the actual device.

## 3. Network drone video through an adapter

This package includes a receive-only WHEP client. A ground-station computer must first receive the drone's video and expose a working WHEP endpoint. The website does not run that server, and uploading adapter configuration to GitHub Pages will not start it.

One adapter option is [MediaMTX](https://mediamtx.org/docs/kickoff/install). The `adapter/mediamtx.example.yml` file in the ZIP is a configuration starting point for a drone that already provides an RTSP feed. It requires your real stream address, reachable adapter address, and TLS certificate files. It is not a hosted or preconfigured service.

1. Install MediaMTX on the computer that can reach your drone's stream.
2. Copy the example to `mediamtx.yml`; replace each REPLACE value. Keep camera passwords and private keys on this computer, never in a public repository.
3. Start `mediamtx mediamtx.yml` (Windows: `.\mediamtx.exe mediamtx.yml`).
4. First verify its video page at `https://YOUR-ADAPTER:8889/drone`. The certificate must be trusted by the viewing device.
5. Choose network mode on Leaf Flight and enter `https://YOUR-ADAPTER:8889/drone/whep`.
6. Allow browser local-network permission if requested. Both the browser and adapter must be able to reach each other for media, not just load the website.
7. Choose Drone ON. The network mode does not ask for or open a local camera.

For other supported source protocols, configure the adapter accordingly. For proprietary output, obtain a manufacturer-supported video bridge first. This client does not implement manufacturer SDKs, automatic drone discovery, audio or flight commands.

The bundled receiver uses complete ICE gathering rather than trickle ICE. Start with a trusted local network and a reachable adapter. Complex NAT/TURN-only networks need additional deployment work; this client does not consume WHEP-advertised TURN configuration automatically. HTTPS must be used when viewing from GitHub Pages. Plain HTTP localhost is accepted only when the frontend itself runs on HTTP localhost for development.

Use a video codec supported by both the adapter and the viewing browser. H.264 without B-frames is a practical compatibility option; some drone codecs need conversion at the ground station. An iframe of the vendor app is insufficient because the classifier needs access to the actual video frames.

The server must allow the site's origin, accept SDP POST and session DELETE requests, and expose the session Location response header. If you add authentication, the frontend supports an optional bearer token for the configured adapter only. Tokens are not stored in localStorage. The example is for a trusted isolated LAN; do not expose its unauthenticated feed publicly. Configure authenticated access for shared deployments.

## Accuracy and performance

- Original classifier weights and RGB 224 × 224 preprocessing are unchanged. No new accuracy claim is made.
- Aim for one close-up tomato leaf occupying most of the image. Avoid shadows, glare, motion blur, tiny leaves and wide aerial field images.
- The model always selects among Early blight, Healthy and Late blight. It does not detect all diseases or reliably reject non-leaf images.
- Scores are neither infected-area measurements nor guaranteed probabilities of correctness.
- Captures use the original 1920-pixel maximum dimension and JPEG quality. The requested local-camera frame rate is capped at 30 fps; the network feed rate is controlled by its adapter.
- Only requested still images are classified. The existing model loads once; there is no continuous inference queue or remote prediction upload.
- Capture waits for decoded frames. Missing frames for about four seconds disconnect the source; initial connection has a timeout. This detects stalled delivery, not a bridge that repeatedly transmits an old image as new frames. Disable any offline-video replacement on the adapter.
- A low-resolution capture triggers a warning. There is no validated blur detector, automatic sharpening or assurance that a usable-looking frame yields a correct diagnosis.
- Network video travels through your selected adapter; the classifier runs in your browser. No website video recording is implemented. Review the adapter's own recording settings separately.

## Verify on your hardware

Check permission denial, source identity, rear-camera selection, capture while live, physical unplugging, Wi-Fi loss, OFF while connecting, tab hiding, and reconnecting. Confirm that no phone-camera indicator appears in network mode. Compare a saved frame uploaded manually against the same captured frame to check the prediction path. Measure latency and classification accuracy on representative labelled drone leaf images before claiming field performance.

Included automated checks mock browser camera and WebRTC APIs. They validate source isolation and lifecycle logic, but are not evidence of physical-drone interoperability or measured streaming performance.

## Official connection references

- [Browser camera access](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [MediaMTX WHEP connections](https://mediamtx.org/docs/read/webrtc)
- [MediaMTX browser integration](https://mediamtx.org/docs/read/web-browsers)
- [MediaMTX connection and codec troubleshooting](https://mediamtx.org/docs/features/webrtc-specific-features)
- [MediaMTX configuration](https://mediamtx.org/docs/references/configuration-file)
