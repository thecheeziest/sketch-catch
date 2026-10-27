import { parentPort, workerData } from 'node:worker_threads';
import { revealToGif, type RevealToGifOptions } from './gif.service.js';

// replay.service가 GIF 1장마다 띄우는 워커 — 렌더링 동안 메인 스레드(소켓·타이머)를 막지 않는다
const buf = await revealToGif(workerData as RevealToGifOptions);
// Buffer가 공용 풀을 쓰고 있을 수 있어 복사본을 넘긴다 (풀 전체가 detach되지 않게)
const bytes = new Uint8Array(buf);
parentPort?.postMessage(bytes, [bytes.buffer]);
