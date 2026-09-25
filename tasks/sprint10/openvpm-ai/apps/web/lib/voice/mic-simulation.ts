/**
 * Web Audio API Microphone Simulator for OpenVPM AI Voice Dictation.
 *
 * This module creates a genuine, spec-compliant `MediaStream` from an audio file
 * (e.g. `/demo/voice-demo.mp3`) using `AudioContext.createMediaStreamDestination()`.
 *
 * It feeds real-time PCM audio samples into the MediaStream tracks so that:
 * 1. `MediaRecorder` encodes the stream in real-time frame by frame.
 * 2. Visualizer `AnalyserNode` instances sample genuine frequency data.
 * 3. The dictation module handles the audio as if coming from a physical microphone.
 * 4. Automated tests (or developer machines without a mic) can test the full pipeline.
 */

export interface SimulatedMicStreamOptions {
  audioUrl?: string;
  playThroughSpeakers?: boolean;
  onEnded?: () => void;
  onError?: (err: Error) => void;
}

export interface SimulatedMicController {
  stream: MediaStream;
  audioContext: AudioContext;
  bufferSource: AudioBufferSourceNode;
  gainNode: GainNode;
  duration: number;
  stop: () => void;
  setMuted: (muted: boolean) => void;
  isMuted: () => boolean;
}

export const DEFAULT_DEMO_AUDIO_URL = "/demo/voice-demo.webm";

// In-memory cache for decoded audio buffer to avoid re-fetching on multiple test runs
let cachedAudioBuffer: { url: string; buffer: AudioBuffer } | null = null;

/**
 * Loads and decodes an audio file into an AudioBuffer using the provided AudioContext.
 */
export async function loadAudioBuffer(
  audioUrl: string,
  audioContext: AudioContext,
): Promise<AudioBuffer> {
  if (cachedAudioBuffer && cachedAudioBuffer.url === audioUrl) {
    return cachedAudioBuffer.buffer;
  }

  const response = await fetch(audioUrl);
  if (!response.ok) {
    throw new Error(`Failed to load audio for microphone simulation: HTTP ${response.status} from ${audioUrl}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  // decodeAudioData consumes the ArrayBuffer, so clone if caching or just cache the decoded AudioBuffer
  const decoded = await audioContext.decodeAudioData(arrayBuffer);
  cachedAudioBuffer = { url: audioUrl, buffer: decoded };
  return decoded;
}

/**
 * Creates a live, genuine MediaStream from an audio file.
 * The stream's tracks emit PCM audio in real time just like a hardware microphone.
 */
export async function createSimulatedMicStream(
  options?: SimulatedMicStreamOptions,
): Promise<SimulatedMicController> {
  if (typeof window === "undefined") {
    throw new Error("createSimulatedMicStream can only be run in a browser environment");
  }

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

  if (!AudioCtx) {
    throw new Error("Web Audio API (AudioContext) is not supported in this browser");
  }

  const audioContext = new AudioCtx();
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  const audioUrl = options?.audioUrl ?? DEFAULT_DEMO_AUDIO_URL;
  const audioBuffer = await loadAudioBuffer(audioUrl, audioContext);

  const bufferSource = audioContext.createBufferSource();
  bufferSource.buffer = audioBuffer;

  // Destination that produces the live MediaStream
  const destination = audioContext.createMediaStreamDestination();
  bufferSource.connect(destination);

  // Gain node for controlling speaker playback (monitoring)
  const gainNode = audioContext.createGain();
  const initialMuted = options?.playThroughSpeakers === false;
  gainNode.gain.setValueAtTime(initialMuted ? 0 : 1, audioContext.currentTime);

  bufferSource.connect(gainNode);
  gainNode.connect(audioContext.destination);

  let stopped = false;
  let muted = initialMuted;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    try {
      bufferSource.stop();
      bufferSource.disconnect();
    } catch {}

    destination.stream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {}
    });

    if (audioContext.state !== "closed") {
      audioContext.close().catch(() => {});
    }
  };

  bufferSource.onended = () => {
    if (!stopped) {
      options?.onEnded?.();
      stop();
    }
  };

  // Start playback into the destination stream
  bufferSource.start(0);

  const setMuted = (shouldMute: boolean) => {
    muted = shouldMute;
    if (audioContext.state !== "closed") {
      gainNode.gain.setValueAtTime(shouldMute ? 0 : 1, audioContext.currentTime);
    }
  };

  const isMuted = () => muted;

  return {
    stream: destination.stream,
    audioContext,
    bufferSource,
    gainNode,
    duration: Math.round(audioBuffer.duration),
    stop,
    setMuted,
    isMuted,
  };
}

// Global navigator.mediaDevices.getUserMedia hook management
let originalGetUserMedia: typeof navigator.mediaDevices.getUserMedia | null = null;
let globalSimulationActive = false;
let activeController: SimulatedMicController | null = null;

/**
 * Installs a global hook into `navigator.mediaDevices.getUserMedia` so that any
 * audio request returns a simulated microphone stream from the demo recording.
 */
export function installSimulatedMicrophone(options?: SimulatedMicStreamOptions) {
  if (typeof window === "undefined" || !navigator?.mediaDevices) return;
  if (globalSimulationActive) return;

  originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  globalSimulationActive = true;

  navigator.mediaDevices.getUserMedia = async (
    constraints?: MediaStreamConstraints,
  ): Promise<MediaStream> => {
    if (constraints?.audio) {
      if (activeController) {
        activeController.stop();
        activeController = null;
      }
      activeController = await createSimulatedMicStream(options);
      return activeController.stream;
    }

    if (originalGetUserMedia) {
      return originalGetUserMedia(constraints);
    }

    throw new Error("No media devices available");
  };
}

/**
 * Restores original `navigator.mediaDevices.getUserMedia`.
 */
export function uninstallSimulatedMicrophone() {
  if (typeof window === "undefined" || !navigator?.mediaDevices) return;
  if (!globalSimulationActive) return;

  if (activeController) {
    activeController.stop();
    activeController = null;
  }

  if (originalGetUserMedia) {
    navigator.mediaDevices.getUserMedia = originalGetUserMedia;
    originalGetUserMedia = null;
  }

  globalSimulationActive = false;
}

export function isSimulatedMicrophoneInstalled(): boolean {
  return globalSimulationActive;
}
