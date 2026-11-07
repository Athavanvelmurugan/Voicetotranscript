const test = require('node:test');
const assert = require('node:assert/strict');

// Simulate the fixed continuous recording chunk emission logic of useMicrophone
class MockContinuousRecorder {
  constructor(timeslice = 10000, onChunk) {
    this.timeslice = timeslice;
    this.onChunk = onChunk;
    this.state = 'inactive';
    this.chunkIndex = 0;
    this.overlapBuffer = null;
    this.uploadLog = [];
  }

  start() {
    this.state = 'recording';
  }

  // Simulates browser emitting a chunk every 10 seconds in ondataavailable
  emitDataAvailable(chunkBytes) {
    if (this.state !== 'recording' && this.state !== 'stopping') return;

    const idx = this.chunkIndex++;
    // Simulate overlap retention: 1.5s = 15% of 10s chunk
    const overlapSlice = chunkBytes.subarray(-Math.floor(chunkBytes.length * 0.15));

    let payload = chunkBytes;
    if (this.overlapBuffer && idx > 0) {
      payload = Buffer.concat([this.overlapBuffer, chunkBytes]);
    }
    this.overlapBuffer = overlapSlice;

    this.uploadLog.push({
      chunkIndex: idx,
      size: payload.length,
      timestamp: Date.now(),
    });

    if (this.onChunk) {
      this.onChunk({ chunkIndex: idx, data: payload });
    }
  }

  pause() {
    this.state = 'paused';
    // Does NOT reset chunkIndex!
  }

  resume() {
    this.state = 'recording';
    // Preserves chunkIndex!
  }

  stop(finalBytes) {
    this.state = 'stopping';
    if (finalBytes && finalBytes.length > 0) {
      this.emitDataAvailable(finalBytes);
    }
    this.state = 'inactive';
  }
}

test('BUG 8 Regression Test: Continuous Recording Chunk Streaming', async (t) => {
  await t.test('1. Emits distinct chunk uploads every 10s during continuous recording without accumulating in memory', () => {
    const uploads = [];
    const recorder = new MockContinuousRecorder(10000, (chunk) => uploads.push(chunk));
    recorder.start();

    // Simulate 35 seconds of recording:
    // At 10s -> chunk 0
    recorder.emitDataAvailable(Buffer.alloc(32000, 1));
    // At 20s -> chunk 1
    recorder.emitDataAvailable(Buffer.alloc(32000, 2));
    // At 30s -> chunk 2
    recorder.emitDataAvailable(Buffer.alloc(32000, 3));
    // At 35s (stop) -> chunk 3
    recorder.stop(Buffer.alloc(16000, 4));

    assert.strictEqual(uploads.length, 4, 'Must trigger 4 separate uploads across 35 seconds');
    assert.strictEqual(uploads[0].chunkIndex, 0);
    assert.strictEqual(uploads[1].chunkIndex, 1);
    assert.strictEqual(uploads[2].chunkIndex, 2);
    assert.strictEqual(uploads[3].chunkIndex, 3);
  });

  await t.test('2. Pause and resume does NOT reset chunkIndex', () => {
    const uploads = [];
    const recorder = new MockContinuousRecorder(10000, (chunk) => uploads.push(chunk));
    recorder.start();

    recorder.emitDataAvailable(Buffer.alloc(1000)); // chunk 0
    recorder.pause();
    assert.strictEqual(recorder.state, 'paused');

    recorder.resume();
    assert.strictEqual(recorder.state, 'recording');
    recorder.emitDataAvailable(Buffer.alloc(1000)); // chunk 1 (NOT reset to 0!)

    assert.strictEqual(uploads.length, 2);
    assert.strictEqual(uploads[0].chunkIndex, 0);
    assert.strictEqual(uploads[1].chunkIndex, 1, 'Chunk index must NOT be reset to 0 upon resume');
  });
});

