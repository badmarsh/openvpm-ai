import { afterEach, describe, expect, it, vi } from "vitest";
import {
  resolveFiscalDriver,
  EmulationDriver,
  FiskalProDriver,
  Vrp2Driver,
  ElcomDriver,
} from "../driver";
import {
  assertCanVoidReceipt,
  EKASA_VOID_ROLES,
} from "../service";

function makePayload() {
  return {
    receiptNumber: "20260904-0042",
    dic: "12345678",
    pokladnicaId: "PK-01",
    amountTotal: "100.00",
    amountBase: "81.30",
    amountVat: "18.70",
    vatRate: "STANDARD_23",
    paymentMethod: "CARD" as const,
    items: [
      { name: "Antiparazitikum", qty: 1, unitPrice: "100.00", vatRate: "STANDARD_23" },
    ],
    issuedAt: new Date(),
  };
}

describe("Fiscal driver factory", () => {
  it("defaults to emulation", () => {
    expect(resolveFiscalDriver().type).toBe("EMULATION");
    expect(resolveFiscalDriver({ driverType: "EMULATION" }).type).toBe("EMULATION");
  });

  it("resolves every production driver", () => {
    expect(resolveFiscalDriver({ driverType: "FISKALPRO" }).type).toBe("FISKALPRO");
    expect(resolveFiscalDriver({ driverType: "VRP2" }).type).toBe("VRP2");
    expect(resolveFiscalDriver({ driverType: "ELCOM" }).type).toBe("ELCOM");
  });

  it("falls back to emulation for unknown driver types", () => {
    expect(resolveFiscalDriver({ driverType: "UNKNOWN" as never }).type).toBe("EMULATION");
  });
});

describe("FiskalPRO / Elcom terminal status", () => {
  afterEach(() => vi.restoreAllMocks());

  it("reads paper, CHDU memory and FS connection from FiskalPRO /status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ paper: false, chdu: true, fs: true }),
          { status: 200 }
        )
      )
    );
    const driver = new FiskalProDriver({ driverType: "FISKALPRO" });
    const status = await driver.getStatus();
    expect(status.ok).toBe(true);
    expect(status.paperOk).toBe(false); // no paper → offline print blocked upstream
    expect(status.chduMemoryOk).toBe(true);
    expect(status.fsConnection).toBe(true);
  });

  it("reports offline when the Elcom POS server is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED"); }));
    const driver = new ElcomDriver({ driverType: "ELCOM" });
    const status = await driver.getStatus();
    expect(status.ok).toBe(false);
    expect(status.message).toContain("ECONNREFUSED");
  });
});

describe("e-Kasa void authorization (Zákon č. 289/2008 Z. z.)", () => {
  it("allows only admin and veterinarian", () => {
    expect(EKASA_VOID_ROLES).toEqual(["admin", "veterinarian"]);
    expect(() => assertCanVoidReceipt("admin")).not.toThrow();
    expect(() => assertCanVoidReceipt("veterinarian")).not.toThrow();
    expect(() => assertCanVoidReceipt("front_desk")).toThrow(/admin alebo veterinarian/);
    expect(() => assertCanVoidReceipt("viewer")).toThrow();
    expect(() => assertCanVoidReceipt(null)).toThrow();
  });
});

describe("Driver payload mapping", () => {
  afterEach(() => vi.restoreAllMocks());

  it("VRP2 driver maps payment method and items into the cloud payload", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ uid: "UID-1", okp: "OKP", pkp: "PKP" }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const driver = new Vrp2Driver({ driverType: "VRP2", endpointUrl: "https://ekasa.financnasprava.sk/vrp2/api" });
    const result = await driver.printReceipt(makePayload());
    expect(result.success).toBe(true);
    expect(result.uid).toBe("UID-1");

    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(init.body as string);
    expect(body.receipt.number).toBe("20260904-0042");
    expect(body.receipt.paymentMethod).toBe("CARD");
    expect(body.receipt.items[0].name).toBe("Antiparazitikum");
  });
});
