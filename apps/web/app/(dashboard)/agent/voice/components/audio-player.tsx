"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, RotateCcw, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AudioPlayerProps {
  src: string;
  className?: string;
  autoPlay?: boolean;
  compact?: boolean;
  title?: string;
}

export function AudioPlayer({
  src,
  className,
  autoPlay = false,
  compact = false,
  title,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
    };
  }, [src]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, [isPlaying]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const target = parseFloat(e.target.value);
    audio.currentTime = target;
    setCurrentTime(target);
  };

  const handleRateChange = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const rates = [1, 1.25, 1.5, 2];
    const currentIndex = rates.indexOf(playbackRate);
    const nextRate = rates[(currentIndex + 1) % rates.length] ?? 1;
    audio.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  const handleRestart = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setCurrentTime(0);
    if (!isPlaying) {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/60 border text-xs", className)}>
        <audio ref={audioRef} src={src} autoPlay={autoPlay} preload="metadata" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 rounded-full shrink-0"
          onClick={togglePlay}
        >
          {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 fill-current ml-0.5" />}
        </Button>
        <span className="font-mono tabular-nums text-muted-foreground">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
        <input
          type="range"
          min="0"
          max={duration || 100}
          step="0.1"
          value={currentTime}
          onChange={handleSeek}
          className="h-1 flex-1 cursor-pointer accent-violet-600 dark:accent-violet-400"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleRateChange}
          className="h-5 px-1.5 text-[10px] font-mono text-muted-foreground"
        >
          {playbackRate}x
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border bg-gradient-to-r from-violet-500/5 via-purple-500/5 to-pink-500/5 p-3.5 shadow-sm space-y-2.5",
        className,
      )}
    >
      <audio ref={audioRef} src={src} autoPlay={autoPlay} preload="metadata" />
      
      {title && (
        <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
          <div className="flex items-center gap-1.5">
            <Volume2 className="h-3.5 w-3.5 text-violet-500" />
            <span>{title}</span>
          </div>
          <span className="font-mono text-[11px] tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      )}

      <div className="relative w-full flex items-center">
        <input
          type="range"
          min="0"
          max={duration || 100}
          step="0.05"
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-muted accent-violet-600 focus:outline-none"
        />
        <div
          className="absolute left-0 top-0 h-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 pointer-events-none"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={togglePlay}
            className="h-8 w-8 p-0 rounded-full bg-violet-600 hover:bg-violet-700 text-white shadow-sm"
          >
            {isPlaying ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRestart}
            className="h-7 w-7 p-0 rounded-full text-muted-foreground hover:text-foreground"
            title="Prehrať od začiatku"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>

          <span className="text-xs font-mono text-muted-foreground tabular-nums">
            {formatTime(currentTime)} <span className="opacity-50">/</span> {formatTime(duration)}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRateChange}
            className="h-7 px-2 text-xs font-mono font-medium rounded-md"
            title="Rýchlosť prehrávania"
          >
            {playbackRate}x
          </Button>
        </div>
      </div>
    </div>
  );
}
