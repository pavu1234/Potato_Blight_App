'use strict';
// Shared by the website and the Node validation harness. No network/photo uploads.
(function(root) {
  async function createLeafEngine(factory, wasmBytes, modelBytes) {
    const runtime = await factory({wasmBinary: wasmBytes});
    const bytes = new Uint8Array(modelBytes);
    const offset = runtime._malloc(bytes.length);
    runtime.HEAPU8.set(bytes, offset);
    const status = runtime.TFLiteWebModelRunner.CreateFromBufferAndOptions(offset, bytes.length, {numThreads: 1, enableProfiling: false, maxProfilingBufferEntries: 1024});
    if (!status.ok()) { const error = status.errorMessage(); status.delete(); runtime._free(offset); throw new Error(error); }
    const runner = status.value(); status.delete();
    const inputs = runner.GetInputs(), outputs = runner.GetOutputs();
    const input = inputs.get(0), output = outputs.get(0);
    if (inputs.size() !== 1 || outputs.size() !== 1 || String(input.shape) !== '1,224,224,3' || input.dataType !== 'float32' || output.data().length !== 3) throw new Error('Unexpected model signature');
    return { predict(pixels) {
      if (pixels.length !== 224 * 224 * 3) throw new Error('Invalid input size');
      input.data().set(pixels);
      if (!runner.Infer()) throw new Error('Inference failed');
      const scores = Array.from(output.data());
      if (scores.some(v => !Number.isFinite(v) || v < 0 || v > 1) || Math.abs(scores.reduce((a,b) => a+b, 0) - 1) > .01) throw new Error('Invalid model scores');
      return scores;
    }, dispose() { input.delete(); output.delete(); inputs.delete(); outputs.delete(); runner.delete(); runtime._free(offset); } };
  }
  if (typeof module === 'object' && module.exports) module.exports = {createLeafEngine};
  else root.createLeafEngine = createLeafEngine;
})(globalThis);

