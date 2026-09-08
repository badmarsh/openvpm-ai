/**
 * Klientský DICOM parser a Window/Level renderer pre veterinárne zobrazovacie metódy.
 * Podporuje RTG, CT, USG vo formáte DICOM Part 10 (.dcm) bez externých C++ závislostí.
 */

export interface DicomMetadata {
  isDicom: boolean;
  patientName?: string;
  patientId?: string;
  modality?: string;
  studyDate?: string;
  manufacturer?: string;
  rows: number;
  cols: number;
  bitsAllocated: number;
  bitsStored: number;
  highBit: number;
  pixelRepresentation: number; // 0 = unsigned, 1 = signed
  windowCenter: number;
  windowWidth: number;
  rescaleIntercept: number;
  rescaleSlope: number;
  photometricInterpretation: string;
  pixelDataOffset: number;
  pixelDataLength: number;
}

export interface DicomWindowPreset {
  id: string;
  name: string;
  windowWidth: number;
  windowCenter: number;
}

export const DICOM_WINDOW_PRESETS: DicomWindowPreset[] = [
  { id: "default", name: "Predvolené", windowWidth: 400, windowCenter: 40 },
  { id: "bone", name: "Kosť / Fraktúra", windowWidth: 2000, windowCenter: 350 },
  { id: "lung", name: "Pľúca / Thorax", windowWidth: 1500, windowCenter: -600 },
  { id: "soft_tissue", name: "Mäkké tkanivo", windowWidth: 350, windowCenter: 40 },
  { id: "abdomen", name: "Abdomen", windowWidth: 400, windowCenter: 50 },
  { id: "high_contrast", name: "Vysoký kontrast", windowWidth: 800, windowCenter: 200 },
];

/**
 * Overí prítomnosť DICOM Part 10 hlavičky ("DICM" na bajte 128).
 */
export function isDicomFile(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 132) return false;
  const view = new Uint8Array(buffer, 128, 4);
  return (
    view[0] === 0x44 && // D
    view[1] === 0x49 && // I
    view[2] === 0x43 && // C
    view[3] === 0x4d    // M
  );
}

/**
 * Parsuje DICOM hlavičku a základné metadáta.
 */
export function parseDicomMetadata(buffer: ArrayBuffer): DicomMetadata {
  const isDcm = isDicomFile(buffer);
  const dataView = new DataView(buffer);

  // Predvolené hodnoty
  const meta: DicomMetadata = {
    isDicom: isDcm,
    rows: 0,
    cols: 0,
    bitsAllocated: 16,
    bitsStored: 12,
    highBit: 11,
    pixelRepresentation: 0,
    windowCenter: 40,
    windowWidth: 400,
    rescaleIntercept: 0,
    rescaleSlope: 1,
    photometricInterpretation: "MONOCHROME2",
    pixelDataOffset: 0,
    pixelDataLength: 0,
  };

  if (!isDcm) {
    return meta;
  }

  // Prehľadávame DICOM tagy od offsetu 132
  let offset = 132;
  const length = buffer.byteLength;

  const textDecoder = new TextDecoder("latin1");

  while (offset < length - 8) {
    const group = dataView.getUint16(offset, true);
    const element = dataView.getUint16(offset + 2, true);
    offset += 4;

    // Explicit VR vs Implicit VR check
    const vrChars = [dataView.getUint8(offset), dataView.getUint8(offset + 1)];
    const isExplicitVR =
      vrChars[0] >= 65 && vrChars[0] <= 90 && vrChars[1] >= 65 && vrChars[1] <= 90;

    let vr = "";
    let elementLength = 0;

    if (isExplicitVR) {
      vr = String.fromCharCode(vrChars[0], vrChars[1]);
      offset += 2;

      // 32-bit dĺžka pre OB, OW, OF, SQ, UT, UN
      if (["OB", "OW", "OF", "SQ", "UT", "UN"].includes(vr)) {
        offset += 2; // rezerva
        elementLength = dataView.getUint32(offset, true);
        offset += 4;
      } else {
        elementLength = dataView.getUint16(offset, true);
        offset += 2;
      }
    } else {
      elementLength = dataView.getUint32(offset, true);
      offset += 4;
    }

    if (elementLength === 0xffffffff) {
      // Neurčená dĺžka (napr. zapuzdrený pixel data stream)
      break;
    }

    // Identifikácia kľúčových tagov
    // (0008,0020) Study Date
    if (group === 0x0008 && element === 0x0020) {
      meta.studyDate = textDecoder.decode(new Uint8Array(buffer, offset, elementLength)).trim();
    }
    // (0008,0060) Modality
    else if (group === 0x0008 && element === 0x0060) {
      meta.modality = textDecoder.decode(new Uint8Array(buffer, offset, elementLength)).trim();
    }
    // (0008,0070) Manufacturer
    else if (group === 0x0008 && element === 0x0070) {
      meta.manufacturer = textDecoder.decode(new Uint8Array(buffer, offset, elementLength)).trim();
    }
    // (0010,0010) Patient Name
    else if (group === 0x0010 && element === 0x0010) {
      meta.patientName = textDecoder.decode(new Uint8Array(buffer, offset, elementLength)).replace(/\^/g, " ").trim();
    }
    // (0010,0020) Patient ID / Chip
    else if (group === 0x0010 && element === 0x0020) {
      meta.patientId = textDecoder.decode(new Uint8Array(buffer, offset, elementLength)).trim();
    }
    // (0028,0004) Photometric Interpretation
    else if (group === 0x0028 && element === 0x0004) {
      meta.photometricInterpretation = textDecoder.decode(new Uint8Array(buffer, offset, elementLength)).trim();
    }
    // (0028,0010) Rows
    else if (group === 0x0028 && element === 0x0010) {
      meta.rows = dataView.getUint16(offset, true);
    }
    // (0028,0011) Columns
    else if (group === 0x0028 && element === 0x0011) {
      meta.cols = dataView.getUint16(offset, true);
    }
    // (0028,0100) Bits Allocated
    else if (group === 0x0028 && element === 0x0100) {
      meta.bitsAllocated = dataView.getUint16(offset, true);
    }
    // (0028,0101) Bits Stored
    else if (group === 0x0028 && element === 0x0101) {
      meta.bitsStored = dataView.getUint16(offset, true);
    }
    // (0028,0102) High Bit
    else if (group === 0x0028 && element === 0x0102) {
      meta.highBit = dataView.getUint16(offset, true);
    }
    // (0028,0103) Pixel Representation
    else if (group === 0x0028 && element === 0x0103) {
      meta.pixelRepresentation = dataView.getUint16(offset, true);
    }
    // (0028,1050) Window Center
    else if (group === 0x0028 && element === 0x1050) {
      const valStr = textDecoder.decode(new Uint8Array(buffer, offset, elementLength)).trim();
      const num = parseFloat(valStr.split("\\")[0]);
      if (!isNaN(num)) meta.windowCenter = num;
    }
    // (0028,1051) Window Width
    else if (group === 0x0028 && element === 0x1051) {
      const valStr = textDecoder.decode(new Uint8Array(buffer, offset, elementLength)).trim();
      const num = parseFloat(valStr.split("\\")[0]);
      if (!isNaN(num) && num > 0) meta.windowWidth = num;
    }
    // (0028,1052) Rescale Intercept
    else if (group === 0x0028 && element === 0x1052) {
      const valStr = textDecoder.decode(new Uint8Array(buffer, offset, elementLength)).trim();
      const num = parseFloat(valStr);
      if (!isNaN(num)) meta.rescaleIntercept = num;
    }
    // (0028,1053) Rescale Slope
    else if (group === 0x0028 && element === 0x1053) {
      const valStr = textDecoder.decode(new Uint8Array(buffer, offset, elementLength)).trim();
      const num = parseFloat(valStr);
      if (!isNaN(num) && num !== 0) meta.rescaleSlope = num;
    }
    // (7FE0,0010) Pixel Data
    else if (group === 0x7fe0 && element === 0x0010) {
      meta.pixelDataOffset = offset;
      meta.pixelDataLength = elementLength;
      break; // Pixel data je posledný veľký blok
    }

    offset += elementLength;
  }

  return meta;
}

/**
 * Vykreslí DICOM snímku do HTML5 Canvasu s aplikáciou Window/Level transformácie.
 */
export function renderDicomToCanvas(
  canvas: HTMLCanvasElement,
  buffer: ArrayBuffer,
  meta: DicomMetadata,
  options: {
    windowCenter: number;
    windowWidth: number;
    invert?: boolean;
  }
): void {
  const width = meta.cols;
  const height = meta.rows;

  if (!width || !height || meta.pixelDataOffset === 0) {
    return;
  }

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  const is16Bit = meta.bitsAllocated === 16;
  const isSigned = meta.pixelRepresentation === 1;
  const isMonochrome1 = meta.photometricInterpretation === "MONOCHROME1";
  const shouldInvert = isMonochrome1 ? !options.invert : Boolean(options.invert);

  const windowCenter = options.windowCenter;
  const windowWidth = Math.max(1, options.windowWidth);
  const halfWidth = windowWidth / 2;
  const minWindow = windowCenter - halfWidth;
  const maxWindow = windowCenter + halfWidth;

  const rescaleSlope = meta.rescaleSlope || 1;
  const rescaleIntercept = meta.rescaleIntercept || 0;

  const totalPixels = width * height;

  if (is16Bit) {
    const pixelView = isSigned
      ? new Int16Array(buffer, meta.pixelDataOffset, totalPixels)
      : new Uint16Array(buffer, meta.pixelDataOffset, totalPixels);

    let dstIdx = 0;
    for (let i = 0; i < totalPixels; i++) {
      const rawVal = pixelView[i];
      const huValue = rawVal * rescaleSlope + rescaleIntercept;

      let intensity: number;
      if (huValue <= minWindow) {
        intensity = 0;
      } else if (huValue >= maxWindow) {
        intensity = 255;
      } else {
        intensity = Math.round(((huValue - minWindow) / windowWidth) * 255);
      }

      if (shouldInvert) {
        intensity = 255 - intensity;
      }

      data[dstIdx] = intensity;     // R
      data[dstIdx + 1] = intensity; // G
      data[dstIdx + 2] = intensity; // B
      data[dstIdx + 3] = 255;       // Alpha
      dstIdx += 4;
    }
  } else {
    // 8-bit obraz
    const pixelView = new Uint8Array(buffer, meta.pixelDataOffset, totalPixels);
    let dstIdx = 0;
    for (let i = 0; i < totalPixels; i++) {
      let intensity = pixelView[i];
      if (shouldInvert) {
        intensity = 255 - intensity;
      }

      data[dstIdx] = intensity;
      data[dstIdx + 1] = intensity;
      data[dstIdx + 2] = intensity;
      data[dstIdx + 3] = 255;
      dstIdx += 4;
    }
  }

  ctx.putImageData(imgData, 0, 0);
}
