import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createSimulatedMicStream,
  installSimulatedMicrophone,
  uninstallSimulatedMicrophone,
  isSimulatedMicrophoneInstalled,
} from "../mic-simulation";

describe("mic-simulation", () => {
  let mockAudioContext: any;
  let mockDestination: any;
  let mockBufferSource: any;
  let mockGainNode: any;
  let mockTrack: any;
  let mockStream: any;
  let mockAudioBuffer: any;
  let mockGetUserMedia: any;

  beforeEach(() => {
    mockTrack = {
      stop: vi.fn(),
      kind: "audio",
      enabled: true,
    };

    mockStream = {
      getTracks: vi.fn(() => [mockTrack]),
      getAudioTracks: vi.fn(() => [mockTrack]),
    };

    mockDestination = {
      stream: mockStream,
    };

    mockBufferSource = {
      buffer: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null,
    };

    mockGainNode = {
      gain: {
        value: 1,
        setValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };

    mockAudioBuffer = {
      duration: 23.59,
      sampleRate: 44100,
      numberOfChannels: 1,
    };

    mockAudioContext = {
      state: "running",
      currentTime: 0,
      resume: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      createBufferSource: vi.fn(() => mockBufferSource),
      createMediaStreamDestination: vi.fn(() => mockDestination),
      createGain: vi.fn(() => mockGainNode),
      destination: {},
      decodeAudioData: vi.fn().mockResolvedValue(mockAudioBuffer),
    };

    // Provide window and AudioContext
    Object.defineProperty(global, "window", {
      value: {
        AudioContext: vi.fn(() => mockAudioContext),
      },
      configurable: true,
      writable: true,
    });

    // Mock fetch
    Object.defineProperty(global, "fetch", {
      value: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
      }),
      configurable: true,
      writable: true,
    });

    // Mock navigator.mediaDevices
    mockGetUserMedia = vi.fn();
    const mediaDevices = {
      getUserMedia: mockGetUserMedia,
    };

    try {
      Object.defineProperty(navigator, "mediaDevices", {
        value: mediaDevices,
        configurable: true,
        writable: true,
      });
    } catch {
      Object.defineProperty(global, "navigator", {
        value: { mediaDevices },
        configurable: true,
        writable: true,
      });
    }
  });

  afterEach(() => {
    uninstallSimulatedMicrophone();
    vi.restoreAllMocks();
  });

  it("creates a simulated mic stream with connected audio nodes and calculated duration", async () => {
    const controller = await createSimulatedMicStream();

    expect(controller.stream).toBe(mockStream);
    expect(controller.duration).toBe(24); // Math.round(23.59)
    expect(mockBufferSource.start).toHaveBeenCalledWith(0);
    expect(mockBufferSource.connect).toHaveBeenCalledWith(mockDestination);
    expect(mockBufferSource.connect).toHaveBeenCalledWith(mockGainNode);
    expect(mockGainNode.connect).toHaveBeenCalledWith(mockAudioContext.destination);
  });

  it("mutes and unmutes speaker playback via gain node", async () => {
    const controller = await createSimulatedMicStream();

    expect(controller.isMuted()).toBe(false);

    controller.setMuted(true);
    expect(mockGainNode.gain.setValueAtTime).toHaveBeenCalledWith(0, 0);
    expect(controller.isMuted()).toBe(true);

    controller.setMuted(false);
    expect(mockGainNode.gain.setValueAtTime).toHaveBeenCalledWith(1, 0);
    expect(controller.isMuted()).toBe(false);
  });

  it("stops all audio tracks, source playback and closes AudioContext on stop()", async () => {
    const controller = await createSimulatedMicStream();

    controller.stop();

    expect(mockBufferSource.stop).toHaveBeenCalled();
    expect(mockBufferSource.disconnect).toHaveBeenCalled();
    expect(mockTrack.stop).toHaveBeenCalled();
    expect(mockAudioContext.close).toHaveBeenCalled();
  });

  it("invokes onEnded callback when buffer source playback reaches the end", async () => {
    const onEndedSpy = vi.fn();
    const controller = await createSimulatedMicStream({ onEnded: onEndedSpy });

    expect(mockBufferSource.onended).toBeDefined();
    mockBufferSource.onended();

    expect(onEndedSpy).toHaveBeenCalled();
    expect(mockBufferSource.stop).toHaveBeenCalled();
  });

  it("installs and uninstalls global navigator.mediaDevices.getUserMedia hook", async () => {
    expect(isSimulatedMicrophoneInstalled()).toBe(false);

    installSimulatedMicrophone();
    expect(isSimulatedMicrophoneInstalled()).toBe(true);

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    expect(stream).toBe(mockStream);

    uninstallSimulatedMicrophone();
    expect(isSimulatedMicrophoneInstalled()).toBe(false);
  });
});
