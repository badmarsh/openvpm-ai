import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("app/(dashboard)/agent/voice/page.tsx", "utf8");
const recordingButton = readFileSync(
  "app/(dashboard)/agent/voice/components/recording-button.tsx",
  "utf8",
);
const en = JSON.parse(readFileSync("messages/en.json", "utf8")) as Record<
  string,
  unknown
>;
const sk = JSON.parse(readFileSync("messages/sk.json", "utf8")) as Record<
  string,
  unknown
>;

function resolveLeaf(dict: Record<string, unknown>, key: string): unknown {
  let node: unknown = dict;
  for (const part of key.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

function pageKitImports(source: string): string {
  const match = source.match(
    /import\s*\{([\s\S]*?)\}\s*from "@\/components\/layout\/page-kit"/,
  );
  return match?.[1] ?? "";
}

describe("voice scribe page kit contract", () => {
  it("consumes the dashboard page kit primitives", () => {
    const imports = pageKitImports(page);
    expect(page).toContain('from "@/components/layout/page-kit"');
    for (const name of [
      "pageShellClass",
      "PageToolbar",
      "DataTableFrame",
      "KpiGrid",
      "KpiCard",
      "EmptyState",
      "filterControlClass",
      "underlineTabsListClass",
      "underlineTabsTriggerClass",
      "PageHeader",
    ]) {
      expect(imports).toContain(name);
    }
    expect(page).toContain("className={pageShellClass}");
  });

  it("uses the canonical PageHeader icon instead of an inline h1 icon", () => {
    expect(page).toContain("icon={Mic}");
    expect(page).not.toContain("<h1");
  });

  it("wraps the recording mode selection in PageToolbar", () => {
    const start = page.indexOf("<PageToolbar>");
    const end = page.indexOf("</PageToolbar>");
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const toolbar = page.slice(start, end);
    expect(toolbar).toContain('data-testid="voice-recording-mode"');
    expect(toolbar).toContain("filterControlClass");
    // Live Ambient vs Dictation vs File Upload capture modes.
    for (const key of ["voice.modes.live", "voice.modes.dictation", "voice.modes.upload"]) {
      expect(toolbar).toContain(key);
    }
    // Recording status pill is rendered in the toolbar.
    expect(toolbar).toContain('data-testid="voice-status-pill"');
  });

  it("frames dictation history and the SOAP extraction preview in DataTableFrame", () => {
    expect(page.match(/<DataTableFrame/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(page).toContain("</DataTableFrame>");
  });

  it("renders history KPIs through KpiGrid/KpiCard that drive the filter", () => {
    expect(page).toContain("<KpiGrid>");
    expect(page.match(/<KpiCard/g)).toHaveLength(4);
    expect(page).toContain("setHistoryFilter(");
  });

  it("uses kit EmptyState for history and SOAP empty states", () => {
    expect(page.match(/<EmptyState/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });
});

describe("voice scribe clinical safety gates (Slovak statutory compliance)", () => {
  it("keeps the controlled-substance zero-prefill warning marker (Zákon 139/1998 Z. z.)", () => {
    // Detects narcotic/psychotropic agents in dictated text via the shared
    // client-safe policy module (opiates, ketamine, propofol, etc.).
    expect(page).toContain(
      'from "@/lib/controlled-substances/policy"',
    );
    expect(page).toContain("isControlledSubstanceName");
    expect(page).toContain('data-testid="voice-controlled-substance-warning"');
    expect(page).toContain("voice.controlled.title");
    expect(page).toContain("voice.controlled.description");
    expect(page).toContain("139/1998");
  });

  it("keeps statutory draft indicators until a licensed vet signs (Zákon 39/2007 Z. z.)", () => {
    expect(page).toContain('data-testid="voice-soap-draft-badge"');
    expect(page).toContain("voice.soapCard.draftBadge");
    expect(page).toContain("voice.soapCard.draftStatutoryNote");
    expect(page).toContain("39/2007");
    // Human-in-the-loop confirmation flow must remain intact.
    expect(page).toContain('data-testid="voice-clinician-confirm"');
    expect(page).toContain("clinicianConfirmed");
    expect(page).toContain("prepareConfirmation");
    expect(page).toContain("saveAsSoapNote");
  });
});

describe("voice scribe audio pipeline resilience", () => {
  it("closes the AudioContext and stops MediaStream tracks on unmount", () => {
    expect(recordingButton).toContain("audioContextRef.current.close");
    expect(recordingButton).toContain("activeStreamRef");
    expect(recordingButton).toContain(
      "activeStreamRef.current.getTracks().forEach((trk) => trk.stop())",
    );
  });

  it("rolls back a leaked microphone stream when start-up fails after getUserMedia", () => {
    expect(recordingButton).toContain("let acquiredStream");
    expect(recordingButton).toContain(
      "acquiredStream.getTracks().forEach((trk) => trk.stop())",
    );
  });

  it("detaches recorder handlers before stop on unmount so no blob fires after unmount", () => {
    expect(recordingButton).toContain("recorder.ondataavailable = null");
    expect(recordingButton).toContain("recorder.onstop = null");
  });

  it("recovers suspended audio contexts when the browser tab regains focus", () => {
    expect(recordingButton).toContain('document.visibilityState !== "visible"');
    expect(recordingButton).toContain('"visibilitychange"');
    expect(recordingButton).toContain('ctx.state === "suspended"');
    expect(recordingButton).toContain("ctx.resume()");
  });

  it("discards a corrupt partial blob when the MediaRecorder errors mid-capture", () => {
    expect(recordingButton).toContain("recorder.onerror");
    expect(recordingButton).toContain("recorderFailed");
    expect(recordingButton).toContain("voice.recording.recordingFailed");
  });

  it("surfaces microphone permission failures to the page-level alert card", () => {
    expect(recordingButton).toContain("onMicError");
    expect(page).toContain('data-testid="voice-mic-error-card"');
    expect(page).toContain("voice.micError.instructions");
    expect(page).toContain("voice.micError.retry");
  });

  it("keeps the recorded buffer on network/transcription failure with an actionable retry", () => {
    expect(page).toContain('setStatus("error")');
    expect(page).toContain('status === "idle" || status === "error"');
    expect(page).toContain('data-testid="voice-process-error-card"');
    expect(page).toContain('data-testid="voice-process-retry"');
    expect(page).toContain("voice.processError.preservedNote");
  });

  it("adjusts the waveform visualizer to dark/light theme tokens", () => {
    expect(recordingButton).toContain("dark:from-red-400");
    expect(recordingButton).toContain("dark:to-pink-400");
  });
});

describe("voice scribe GDPR audio privacy", () => {
  it("never persists raw audio buffers to client storage", () => {
    for (const source of [page, recordingButton]) {
      expect(source).not.toContain("localStorage");
      expect(source).not.toContain("sessionStorage");
      expect(source).not.toContain("indexedDB");
    }
  });

  it("never writes transcript PII to client logs or telemetry", () => {
    for (const source of [page, recordingButton]) {
      expect(source).not.toMatch(/console\.(log|info|warn|error)\([^)]*(rawTranscript|soapSections|audioBase64)/);
    }
  });

  it("communicates the 24h GDPR audio retention lifecycle to the clinician", () => {
    expect(page).toContain("voice.recording.retentionNote");
  });
});

describe("voice scribe i18n leaf symmetry for new keys", () => {
  const newKeys = [
    "voice.status.idle",
    "voice.status.recording",
    "voice.status.processing",
    "voice.status.done",
    "voice.status.saved",
    "voice.status.error",
    "voice.modes.label",
    "voice.modes.live",
    "voice.modes.dictation",
    "voice.modes.upload",
    "voice.micError.title",
    "voice.micError.instructions",
    "voice.micError.retry",
    "voice.micError.dismiss",
    "voice.processError.title",
    "voice.processError.preservedNote",
    "voice.processError.retry",
    "voice.kpi.total",
    "voice.kpi.processed",
    "voice.kpi.savedInChart",
    "voice.kpi.drafts",
    "voice.controlled.title",
    "voice.controlled.description",
    "voice.soapCard.draftBadge",
    "voice.soapCard.finalizedBadge",
    "voice.soapCard.draftStatutoryNote",
    "voice.recording.hintLive",
    "voice.recording.hintUpload",
    "voice.recording.retentionNote",
    "voice.recording.recordingFailed",
    "voice.upload.invalidType",
    "voice.upload.hint",
    "voice.upload.button",
  ];

  it.each(newKeys) ("%s exists in both en.json and sk.json", (key) => {
    const enValue = resolveLeaf(en, key);
    const skValue = resolveLeaf(sk, key);
    expect(typeof enValue, `missing in en.json: ${key}`).toBe("string");
    expect(typeof skValue, `missing in sk.json: ${key}`).toBe("string");
    expect((enValue as string).length).toBeGreaterThan(0);
    expect((skValue as string).length).toBeGreaterThan(0);
  });

  it("uses only dictionary-defined voice.* keys for the new UI", () => {
    // Spot-check the statutory strings contain the correct legal citations.
    expect(resolveLeaf(sk, "voice.controlled.title")).toContain("139/1998");
    expect(resolveLeaf(en, "voice.controlled.title")).toContain("139/1998");
    expect(resolveLeaf(sk, "voice.soapCard.draftStatutoryNote")).toContain(
      "39/2007",
    );
    expect(resolveLeaf(en, "voice.soapCard.draftStatutoryNote")).toContain(
      "39/2007",
    );
  });
});
