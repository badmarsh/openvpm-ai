import { describe, it, expect } from "vitest";
import {
  isDicomFile,
  parseDicomMetadata,
  DICOM_WINDOW_PRESETS,
} from "../dicom-parser";

function createSyntheticDicomBuffer(opts: {
  modality?: string;
  rows?: number;
  cols?: number;
  bitsAllocated?: number;
  windowCenter?: number;
  windowWidth?: number;
}): ArrayBuffer {
  // DICOM Part 10: 128 bytes preamble + 4 bytes "DICM" + tags
  const buffer = new ArrayBuffer(512);
  const u8 = new Uint8Array(buffer);
  const view = new DataView(buffer);

  // Write "DICM" at offset 128
  u8[128] = 0x44; // D
  u8[129] = 0x49; // I
  u8[130] = 0x43; // C
  u8[131] = 0x4d; // M

  let offset = 132;

  // Tag (0008,0060) Modality - Explicit VR "CS", length 2
  if (opts.modality) {
    view.setUint16(offset, 0x0008, true);
    view.setUint16(offset + 2, 0x0060, true);
    u8[offset + 4] = 0x43; // C
    u8[offset + 5] = 0x53; // S
    view.setUint16(offset + 6, 2, true);
    u8[offset + 8] = opts.modality.charCodeAt(0);
    u8[offset + 9] = opts.modality.charCodeAt(1) || 0x20;
    offset += 10;
  }

  // Tag (0028,0010) Rows - Explicit VR "US", length 2
  if (opts.rows) {
    view.setUint16(offset, 0x0028, true);
    view.setUint16(offset + 2, 0x0010, true);
    u8[offset + 4] = 0x55; // U
    u8[offset + 5] = 0x53; // S
    view.setUint16(offset + 6, 2, true);
    view.setUint16(offset + 8, opts.rows, true);
    offset += 10;
  }

  // Tag (0028,0011) Columns - Explicit VR "US", length 2
  if (opts.cols) {
    view.setUint16(offset, 0x0028, true);
    view.setUint16(offset + 2, 0x0011, true);
    u8[offset + 4] = 0x55; // U
    u8[offset + 5] = 0x53; // S
    view.setUint16(offset + 6, 2, true);
    view.setUint16(offset + 8, opts.cols, true);
    offset += 10;
  }

  // Tag (0028,0100) Bits Allocated - Explicit VR "US", length 2
  if (opts.bitsAllocated) {
    view.setUint16(offset, 0x0028, true);
    view.setUint16(offset + 2, 0x0100, true);
    u8[offset + 4] = 0x55; // U
    u8[offset + 5] = 0x53; // S
    view.setUint16(offset + 6, 2, true);
    view.setUint16(offset + 8, opts.bitsAllocated, true);
    offset += 10;
  }

  return buffer;
}

describe("DICOM Part 10 Header Parser & Window/Level Presets", () => {
  it("identifies valid DICOM Part 10 magic bytes 'DICM' at offset 128", () => {
    const validBuf = createSyntheticDicomBuffer({});
    expect(isDicomFile(validBuf)).toBe(true);

    const invalidBuf = new ArrayBuffer(100);
    expect(isDicomFile(invalidBuf)).toBe(false);

    const corruptedBuf = new ArrayBuffer(200);
    expect(isDicomFile(corruptedBuf)).toBe(false);
  });

  it("parses modality, rows, columns, and bit depth from DICOM tags", () => {
    const buf = createSyntheticDicomBuffer({
      modality: "DX",
      rows: 512,
      cols: 512,
      bitsAllocated: 16,
    });

    const meta = parseDicomMetadata(buf);
    expect(meta.isDicom).toBe(true);
    expect(meta.modality).toBe("DX");
    expect(meta.rows).toBe(512);
    expect(meta.cols).toBe(512);
    expect(meta.bitsAllocated).toBe(16);
  });

  it("provides comprehensive veterinary Window/Level presets", () => {
    expect(DICOM_WINDOW_PRESETS.length).toBeGreaterThanOrEqual(4);

    const bone = DICOM_WINDOW_PRESETS.find((p) => p.id === "bone");
    expect(bone).toBeDefined();
    expect(bone?.windowWidth).toBeGreaterThan(1000);

    const lung = DICOM_WINDOW_PRESETS.find((p) => p.id === "lung");
    expect(lung).toBeDefined();
    expect(lung?.windowCenter).toBeLessThan(0); // Typical negative HU for lungs
  });
});
