import type { CachedAiModel, PracticeAiFeatureMappings } from "@openpims/db";

export const DEFAULT_ALIBABA_PRESETS: CachedAiModel[] = [
  { id: "qwen-image-3.0", name: "Qwen Image 3.0", isImageGeneration: true },
  { id: "wan3.0-video", name: "Wan 3.0 Video", isVideoGeneration: true },
  { id: "wan3.0-video-prime", name: "Wan 3.0 Video Prime", isVideoGeneration: true },
  { id: "wan2.1-t2i-turbo", name: "Wan 2.1 Text-to-Image Turbo", isImageGeneration: true },
  { id: "wanx2.1-t2i-turbo", name: "Wanx 2.1 Text-to-Image", isImageGeneration: true },
  { id: "wan-t2v", name: "Wan Text-to-Video (Auto-failover Group)", isVideoGeneration: true },
  { id: "wan-i2v", name: "Wan Image-to-Video (Auto-failover Group)", isVideoGeneration: true },
  { id: "wan2.1-t2v-turbo", name: "Wan 2.1 Video Turbo", isVideoGeneration: true },
  { id: "wan2.1-i2v-turbo", name: "Wan 2.1 Image-to-Video Turbo", isVideoGeneration: true },
  { id: "qwen-plus", name: "Qwen Plus (Chat & SOAP)", isVision: false },
  { id: "qwen-max", name: "Qwen Max (Reasoning & Complex)", isVision: false },
  { id: "qwen-turbo", name: "Qwen Turbo (Fast Chat)", isVision: false },
  { id: "qwen2.5-72b-instruct", name: "Qwen 2.5 72B Instruct", isVision: false },
  { id: "qwen-vl-max", name: "Qwen VL Max (RTG & Vision)", isVision: true },
  { id: "qwen2.5-vl-72b-instruct", name: "Qwen 2.5 VL 72B (Vision)", isVision: true },
];

export const DEFAULT_GEMINI_PRESETS: CachedAiModel[] = [
  { id: "gemini-3.8-flash", name: "Gemini 3.8 Flash (Multimodal & Fast)", isVision: true },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash (Fast Multimodal)", isVision: true },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro (Clinical Reasoning)", isVision: true },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", isVision: true },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", isVision: true },
  { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", isVision: true },
  { id: "imagen-3.0-generate-002", name: "Imagen 3 (Image Generation)", isImageGeneration: true },
];

export const DEFAULT_PRACTICE_FEATURE_MAPPINGS: PracticeAiFeatureMappings = {
  assistant: { provider: "gemini", model: "gemini-3.8-flash", temperature: 0.2 },
  imagingRtg: { provider: "gemini", model: "gemini-3.8-flash", temperature: 0.1 },
  voiceSoap: { provider: "gemini", model: "gemini-3.8-flash" },
  labParser: { provider: "gemini", model: "gemini-3.8-flash" },
  imageGeneration: { provider: "alibaba", model: "qwen-image-3.0", size: "1024*1024" },
  videoGeneration: { provider: "alibaba", model: "wan3.0-video", duration: 5 },
  marketingCopy: { provider: "gemini", model: "gemini-3.8-flash" },
};
