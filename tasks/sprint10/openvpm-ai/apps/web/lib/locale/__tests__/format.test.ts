import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatDate,
  regulatoryFramework,
  regionDefaults,
  localeForCountry,
  stripDoctorTitle,
  formatDoctorName,
  formatSpecies,
} from "../format";

describe("formatCurrency", () => {
  it("formats USD with a dollar sign", () => {
    const s = formatCurrency(65, "usd");
    expect(s).toContain("$");
    expect(s).toContain("65");
  });
  it("formats GBP with a pound sign in en-GB", () => {
    const s = formatCurrency(65, "gbp", "GB");
    expect(s).toContain("£");
    expect(s).toContain("65");
  });
  it("formats EUR", () => {
    expect(formatCurrency(40, "eur", "IE")).toContain("€");
  });
  it("accepts string amounts from the DB and coerces them", () => {
    const s = formatCurrency("65.00", "gbp", "GB");
    expect(s).toContain("£");
    expect(s).toContain("65");
  });
  it("treats null/undefined/non-numeric as zero", () => {
    expect(formatCurrency(null)).toContain("0");
    expect(formatCurrency(undefined)).toContain("0");
    expect(formatCurrency("not-a-number")).toContain("0");
  });
});

describe("formatDate", () => {
  it("uses month/day order for the US and day/month for the UK", () => {
    const us = formatDate("2026-06-07", "US");
    const gb = formatDate("2026-06-07", "GB");
    expect(us).toBe("06/07/2026");
    expect(gb).toBe("07/06/2026");
  });
});

describe("regulatoryFramework", () => {
  it("returns uk_vmd for GB, us_dea otherwise", () => {
    expect(regulatoryFramework("GB")).toBe("uk_vmd");
    expect(regulatoryFramework("US")).toBe("us_dea");
    expect(regulatoryFramework(null)).toBe("us_dea");
  });
});

describe("regionDefaults", () => {
  it("returns USD/8% for US (and unknown), GBP/20% for GB", () => {
    expect(regionDefaults("US")).toMatchObject({ currency: "usd", taxRatePercent: "8.00" });
    expect(regionDefaults("ZZ")).toMatchObject({ currency: "usd" });
    expect(regionDefaults("GB")).toMatchObject({
      currency: "gbp",
      taxRatePercent: "20.00",
      timezone: "Europe/London",
    });
    expect(regionDefaults("SK")).toMatchObject({
      currency: "eur",
      taxRatePercent: "20.00",
      timezone: "Europe/Bratislava",
    });
  });
});

describe("localeForCountry", () => {
  it("maps known countries and falls back to en-US", () => {
    expect(localeForCountry("GB")).toBe("en-GB");
    expect(localeForCountry("xx")).toBe("en-US");
    expect(localeForCountry(null)).toBe("en-US");
  });
});

describe("stripDoctorTitle", () => {
  it("strips single and duplicate doctor titles", () => {
    expect(stripDoctorTitle("MVDr. Martin Sýkora")).toBe("Martin Sýkora");
    expect(stripDoctorTitle("MVDr. MVDr. Martin Sýkora")).toBe("Martin Sýkora");
    expect(stripDoctorTitle("Dr. Sarah Chen")).toBe("Sarah Chen");
    expect(stripDoctorTitle("Dr Sarah Chen")).toBe("Sarah Chen");
    expect(stripDoctorTitle("Martin Sýkora")).toBe("Martin Sýkora");
    expect(stripDoctorTitle("Drew Barrymore")).toBe("Drew Barrymore");
    expect(stripDoctorTitle(null)).toBe("");
  });
});

describe("formatDoctorName", () => {
  const fakeT = (_key: string, fallback?: string, params?: Record<string, string | number>) => {
    return (fallback ?? "").replace("{name}", String(params?.name ?? ""));
  };

  it("formats doctor name without duplicating prefix", () => {
    expect(formatDoctorName("MVDr. Martin Sýkora", fakeT)).toBe("Dr. Martin Sýkora");
    expect(formatDoctorName("MVDr. MVDr. Martin Sýkora", fakeT)).toBe("Dr. Martin Sýkora");
    expect(formatDoctorName("Martin Sýkora", fakeT)).toBe("Dr. Martin Sýkora");
    expect(formatDoctorName("", fakeT)).toBe("");
  });
});

describe("formatSpecies", () => {
  const fakeT = (key: string, fallback?: string) => {
    if (key === "species.feline") return "Mačka";
    if (key === "species.canine") return "Pes";
    return fallback ?? "";
  };

  it("translates known species", () => {
    expect(formatSpecies("feline", fakeT)).toBe("Mačka");
    expect(formatSpecies("canine", fakeT)).toBe("Pes");
    expect(formatSpecies("unknown_species", fakeT)).toBe("unknown_species");
    expect(formatSpecies(null, fakeT)).toBe("");
  });
});

