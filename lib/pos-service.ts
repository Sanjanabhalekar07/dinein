import { loadPosData, savePosData, type PosData } from "@/lib/pos-data";

// This adapter keeps the demo's IndexedDB source of truth while exercising the
// same asynchronous loading and saving states used by a remote POS service.
const readLatencyMs = 320;
const writeLatencyMs = 180;

const wait = (milliseconds: number) => new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

export async function fetchPosSnapshot(): Promise<PosData | null> {
  await wait(readLatencyMs);
  return loadPosData();
}

export async function persistPosSnapshot(data: PosData): Promise<void> {
  await wait(writeLatencyMs);
  await savePosData(data);
}
