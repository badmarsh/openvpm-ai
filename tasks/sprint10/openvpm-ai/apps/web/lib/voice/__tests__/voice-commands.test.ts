import { describe, it, expect } from "vitest";
import { VOICE_COMMANDS } from "@/app/(dashboard)/agent/voice/components/voice-commands";

describe("Voice Commands Specification", () => {
  it("contains all required documentation commands", () => {
    const docCommands = VOICE_COMMANDS.filter((c) => c.category === "documentation");
    const phrases = docCommands.map((c) => c.phrase);

    expect(phrases).toContain("Nová poznámka pacienta");
    expect(phrases).toContain("Začať konzultáciu");
    expect(phrases).toContain("Ukončiť poznámku");
    expect(phrases).toContain("Uložiť dokument");
  });

  it("contains all required formatting commands", () => {
    const fmtCommands = VOICE_COMMANDS.filter((c) => c.category === "formatting");
    const phrases = fmtCommands.map((c) => c.phrase);

    expect(phrases).toContain("Nový odsek");
    expect(phrases).toContain("Odrážka");
    expect(phrases).toContain("Číslovaný zoznam");
    expect(phrases).toContain("Tučný text");
  });

  it("contains all required navigation commands", () => {
    const navCommands = VOICE_COMMANDS.filter((c) => c.category === "navigation");
    const phrases = navCommands.map((c) => c.phrase);

    expect(phrases).toContain("Prejsť na pacientov");
    expect(phrases).toContain("Otvoriť termíny");
    expect(phrases).toContain("Zobraziť prehľad");
    expect(phrases).toContain("Hľadať v záznamoch");
  });

  it("ensures each command has valid actionKey, description, and icon", () => {
    expect(VOICE_COMMANDS.length).toBe(12);
    for (const cmd of VOICE_COMMANDS) {
      expect(cmd.id).toBeDefined();
      expect(cmd.actionKey).toBeTruthy();
      expect(cmd.description).toBeTruthy();
      expect(cmd.icon).toBeDefined();
      expect(cmd.exampleUsage).toBeTruthy();
    }
  });
});
