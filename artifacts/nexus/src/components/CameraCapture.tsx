import { useState, useRef, useCallback, useEffect } from "react";
import { Camera, X, Check, RotateCcw, Loader2, FlipHorizontal, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";

interface CameraCaptureProps {
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
}

export function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  const startCamera = useCallback(async (facingMode: "user" | "environment") => {
    setLoading(true);
    setError(null);

    // Stop any existing stream
    streamRef.current?.getTracks().forEach(t => t.stop());

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setLoading(false);
      }
    } catch {
      setError("Could not access camera. Please allow camera permission and try again.");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    startCamera(facing);
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const flipCamera = () => {
    const next = facing === "user" ? "environment" : "user";
    setFacing(next);
    startCamera(next);
  };

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // Flash animation
    setFlash(true);
    setTimeout(() => setFlash(false), 300);

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Mirror if front camera
    if (facing === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setPreview(dataUrl);

    // Stop stream when preview is shown
    streamRef.current?.getTracks().forEach(t => t.stop());
  };

  const retake = () => {
    setPreview(null);
    startCamera(facing);
  };

  const confirmCapture = () => {
    if (preview) {
      onCapture(preview);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center">
      {/* Header */}
      <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4 py-3 z-10">
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-sm">
          <X className="w-5 h-5" />
        </button>
        <p className="text-white font-bold text-sm">Camera</p>
        {!preview && (
          <button onClick={flipCamera} className="w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-sm">
            <FlipHorizontal className="w-5 h-5" />
          </button>
        )}
        {preview && <div className="w-10" />}
      </div>

      {/* Camera view / preview */}
      <div className="relative w-full max-w-md aspect-[3/4] rounded-3xl overflow-hidden shadow-2xl">
        {/* Flash overlay */}
        {flash && <div className="absolute inset-0 bg-white z-20 animate-ping" style={{ animationDuration: "150ms", animationIterationCount: 1 }} />}

        {preview ? (
          <img
            src={preview}
            alt="Captured"
            className={cn("w-full h-full object-cover", facing === "user" && "scale-x-[-1]")}
          />
        ) : (
          <>
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
            )}
            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10 px-6 text-center">
                <Camera className="w-12 h-12 text-white/40 mb-3" />
                <p className="text-white text-sm">{error}</p>
              </div>
            )}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={cn(
                "w-full h-full object-cover",
                facing === "user" && "scale-x-[-1]"
              )}
            />
          </>
        )}

        {/* Grid overlay */}
        {!preview && !loading && (
          <div className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
              backgroundSize: "33.33% 33.33%",
            }}
          />
        )}
      </div>

      {/* Hidden canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Controls */}
      <div className="absolute bottom-8 inset-x-0 flex items-center justify-center gap-8">
        {preview ? (
          <>
            <button
              onClick={retake}
              className="w-14 h-14 rounded-full bg-white/20 text-white flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-all"
            >
              <RotateCcw className="w-6 h-6" />
            </button>
            <button
              onClick={confirmCapture}
              className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-xl glow-primary-sm hover:scale-105 transition-all"
            >
              <Check className="w-7 h-7 text-white" />
            </button>
          </>
        ) : (
          <button
            onClick={takePhoto}
            disabled={loading || !!error}
            className="w-16 h-16 rounded-full bg-white border-4 border-white/30 flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-40"
          />
        )}
      </div>
    </div>
  );
}

// Compact camera button for forms/modals
export function CameraButton({ onCapture, className }: { onCapture: (dataUrl: string) => void; className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-all text-xs font-bold",
          className
        )}
      >
        <Camera className="w-4 h-4" />
        Camera
      </button>
      {open && (
        <CameraCapture
          onCapture={onCapture}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
