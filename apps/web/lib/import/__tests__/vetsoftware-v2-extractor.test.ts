import { describe, expect, it } from "vitest";
import iconv from "iconv-lite";
import { EventEmitter } from "node:events";
import {
  decodeWin1250,
  isPatientDeceased,
  parseBankaK,
  readTextBlob,
} from "../vetsoftware-v2-extractor";

describe("VetSoftware V2 Extractor & Normalizer", () => {
  describe("Sympathy Gate (isPatientDeceased)", () => {
    it("identifies animal as deceased when VYRAZEN is 'A'", () => {
      expect(isPatientDeceased({ VYRAZEN: "A" })).toBe(true);
      expect(isPatientDeceased({ VYRAZEN: "A " })).toBe(true);
      expect(isPatientDeceased({ VYRAZEN: " A" })).toBe(true);
    });

    it("identifies animal as alive when VYRAZEN is 'N'", () => {
      expect(isPatientDeceased({ VYRAZEN: "N" })).toBe(false);
    });

    it("identifies animal as alive when ZEMREL is the legacy sentinel year 3000 (31.12.2999)", () => {
      expect(isPatientDeceased({ ZEMREL: new Date("2999-12-31T23:00:00.000Z") })).toBe(false);
      expect(isPatientDeceased({ ZEMREL: "3000-01-01" })).toBe(false);
    });

    it("identifies animal as deceased when ZEMREL has a real past date (< 2100)", () => {
      expect(isPatientDeceased({ ZEMREL: new Date("2014-01-20T23:00:00.000Z") })).toBe(true);
      expect(isPatientDeceased({ ZEMREL: "2017-02-19" })).toBe(true);
    });

    it("handles null, undefined and invalid date strings safely without NaN false positives", () => {
      expect(isPatientDeceased({ ZEMREL: null })).toBe(false);
      expect(isPatientDeceased({ ZEMREL: undefined })).toBe(false);
      expect(isPatientDeceased({ ZEMREL: "invalid-date-format" })).toBe(false);
      expect(isPatientDeceased({})).toBe(false);
    });
  });

  describe("Address parsing (parseBankaK)", () => {
    it("parses city followed by 5-digit zip with space", () => {
      const res = parseBankaK("Rimavská Sobota 979 01");
      expect(res.city).toBe("Rimavská Sobota");
      expect(res.zip).toBe("97901");
    });

    it("parses 5-digit zip followed by city", () => {
      const res = parseBankaK("980 02 Jesenské");
      expect(res.city).toBe("Jesenské");
      expect(res.zip).toBe("98002");
    });

    it("handles city without zip code", () => {
      const res = parseBankaK("Tornaľa");
      expect(res.city).toBe("Tornaľa");
      expect(res.zip).toBeNull();
    });

    it("handles empty or whitespace string", () => {
      const res = parseBankaK("   ");
      expect(res.city).toBe("");
      expect(res.zip).toBeNull();
    });
  });

  describe("Encoding & BLOB decoders", () => {
    it("decodes WIN1250 buffer with Slovak diacritics correctly", () => {
      const original = "Mačka Líza s vyšetrením pľúc a labiek";
      const win1250Buf = iconv.encode(original, "win1250");
      expect(decodeWin1250(win1250Buf)).toBe(original);
    });

    it("safely reads text blob from callback stream", async () => {
      const text = "Kontrola po 24 hodinách. Rana sa hojí per primam.";
      const win1250Buf = iconv.encode(text, "win1250");

      const mockBlob = (cb: (err: any, name: any, emitter: EventEmitter) => void) => {
        const emitter = new EventEmitter();
        cb(null, "A", emitter);
        process.nextTick(() => {
          emitter.emit("data", win1250Buf.subarray(0, 20));
          emitter.emit("data", win1250Buf.subarray(20));
          emitter.emit("end");
        });
      };

      const result = await readTextBlob(mockBlob);
      expect(result).toBe(text);
    });
  });
});
