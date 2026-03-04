import { useRef, useState, useEffect, useCallback } from "react";
import { Play, Pause, Camera, Trash2, CheckCircle2, X, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface VideoFrameExtractorProps {
  videoFile: File;
  onFramesSelected: (frames: File[]) => void;
  onClose: () => void;
}

export default function VideoFrameExtractor({ videoFile, onFramesSelected, onClose }: VideoFrameExtractorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [frames, setFrames] = useState<{ blob: Blob; url: string; time: number; selected: boolean }[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(videoFile);
    setVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [videoFile]);

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const seekTo = (value: number[]) => {
    if (videoRef.current) {
      videoRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      setFrames(prev => [...prev, { blob, url, time: video.currentTime, selected: true }]);
    }, "image/jpeg", 0.92);
  }, []);

  const autoExtractFrames = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    setIsExtracting(true);
    video.pause();
    setIsPlaying(false);

    const interval = Math.max(3, duration / 10); // every ~3s or 10 frames max
    const times: number[] = [];
    for (let t = 0; t < duration; t += interval) {
      times.push(t);
    }

    const newFrames: typeof frames = [];
    for (const t of times) {
      video.currentTime = t;
      await new Promise<void>((resolve) => {
        const handler = () => {
          video.removeEventListener("seeked", handler);
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0);
            canvas.toBlob((blob) => {
              if (blob) {
                const url = URL.createObjectURL(blob);
                newFrames.push({ blob, url, time: t, selected: false });
              }
              resolve();
            }, "image/jpeg", 0.92);
          } else {
            resolve();
          }
        };
        video.addEventListener("seeked", handler);
      });
    }

    setFrames(prev => [...prev, ...newFrames]);
    setIsExtracting(false);
  };

  const toggleFrameSelection = (index: number) => {
    setFrames(prev => prev.map((f, i) => i === index ? { ...f, selected: !f.selected } : f));
  };

  const removeFrame = (index: number) => {
    setFrames(prev => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const confirmFrames = () => {
    const selected = frames.filter(f => f.selected);
    const files = selected.map((f, i) =>
      new File([f.blob], `frame_${i + 1}_${Math.round(f.time)}s.jpg`, { type: "image/jpeg" })
    );
    onFramesSelected(files);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const selectedCount = frames.filter(f => f.selected).length;

  return (
    <div className="space-y-3 p-3 bg-secondary/50 rounded-lg border border-border">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground flex items-center gap-1">
          <Video size={14} /> Extrair Fotos do Vídeo
        </span>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
          <X size={14} />
        </Button>
      </div>

      {/* Video Player */}
      <div className="relative rounded-lg overflow-hidden bg-black">
        <video
          ref={videoRef}
          src={videoUrl}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => setIsPlaying(false)}
          className="w-full max-h-[250px] object-contain"
          playsInline
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={togglePlay}>
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
        </Button>
        <div className="flex-1">
          <Slider
            min={0}
            max={duration || 1}
            step={0.1}
            value={[currentTime]}
            onValueChange={seekTo}
            className="w-full"
          />
        </div>
        <span className="text-xs text-muted-foreground min-w-[70px] text-right">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" className="flex-1 text-xs border-border" onClick={captureFrame}>
          <Camera size={14} className="mr-1" /> Capturar Frame
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 text-xs border-border"
          onClick={autoExtractFrames}
          disabled={isExtracting || duration === 0}
        >
          {isExtracting ? "Extraindo..." : "📸 Auto-extrair"}
        </Button>
      </div>

      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Frames grid */}
      {frames.length > 0 && (
        <>
          <div className="grid grid-cols-4 gap-2 max-h-[200px] overflow-y-auto">
            {frames.map((frame, i) => (
              <div
                key={i}
                className={`relative rounded-lg overflow-hidden border-2 cursor-pointer aspect-video ${
                  frame.selected ? "border-primary" : "border-border opacity-60"
                }`}
                onClick={() => toggleFrameSelection(i)}
              >
                <img src={frame.url} alt={`Frame ${i + 1}`} className="w-full h-full object-cover" />
                <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] text-center py-0.5">
                  {formatTime(frame.time)}
                </span>
                {frame.selected && (
                  <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                    <CheckCircle2 size={10} />
                  </div>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeFrame(i); }}
                  className="absolute top-1 left-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
          </div>

          <Button
            type="button"
            size="sm"
            className="w-full bg-primary text-primary-foreground"
            onClick={confirmFrames}
            disabled={selectedCount === 0}
          >
            <CheckCircle2 size={14} className="mr-1" />
            Usar {selectedCount} foto{selectedCount !== 1 ? "s" : ""} selecionada{selectedCount !== 1 ? "s" : ""}
          </Button>
        </>
      )}
    </div>
  );
}
