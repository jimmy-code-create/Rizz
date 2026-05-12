import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, X, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  onClose?: () => void;
  className?: string;
}

// Web Speech API types (not in all TS lib versions)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionAny = any;

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SpeechRecognition: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webkitSpeechRecognition: any;
  }
}

export function VoiceInput({ onTranscript, onClose, className }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const [noiseLevel, setNoiseLevel] = useState(0);

  const recognitionRef = useRef<SpeechRecognitionAny | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      setError("Voice input is not supported in this browser. Try Chrome or Edge.");
    }
    return () => stopListening();
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;

    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    audioCtxRef.current?.close().catch(() => null);
    audioCtxRef.current = null;
    analyserRef.current = null;

    setIsListening(false);
    setNoiseLevel(0);
    setInterim("");
  }, []);

  const measureNoiseLevel = useCallback((analyser: AnalyserNode) => {
    const buffer = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(buffer);
      const avg = buffer.reduce((a, b) => a + b, 0) / buffer.length;
      setNoiseLevel(Math.min(100, (avg / 128) * 100));
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
  }, []);

  const startListening = useCallback(async () => {
    if (!supported) return;
    setError(null);
    setTranscript("");
    setInterim("");

    try {
      // Request mic with maximum noise suppression
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 16000,
        },
      });
      streamRef.current = stream;

      // Build noise-suppressed audio graph
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      // Dynamics compressor reduces background rumble
      const compressor = audioCtx.createDynamicsCompressor();
      compressor.threshold.value = -50;
      compressor.knee.value = 40;
      compressor.ratio.value = 12;
      compressor.attack.value = 0;
      compressor.release.value = 0.25;

      source.connect(compressor);
      compressor.connect(analyser);

      measureNoiseLevel(analyser);

      // Set up Web Speech API
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SR();
      recognitionRef.current = recognition;

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.maxAlternatives = 1;

      recognition.onstart = () => setIsListening(true);

      recognition.onresult = (e: SpeechRecognitionAny) => {
        let finalText = "";
        let interimText = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) {
            finalText += r[0].transcript;
          } else {
            interimText += r[0].transcript;
          }
        }
        if (finalText) setTranscript(prev => prev + finalText + " ");
        setInterim(interimText);
      };

      recognition.onerror = (e: SpeechRecognitionAny) => {
        if (e.error === "not-allowed") {
          setError("Microphone access denied. Please allow mic permissions.");
        } else if (e.error !== "aborted") {
          setError(`Voice error: ${e.error}. Try again.`);
        }
        stopListening();
      };

      recognition.onend = () => {
        if (isListening) {
          // Auto-restart for continuous listening
          try { recognition.start(); } catch { stopListening(); }
        }
      };

      recognition.start();
    } catch (err) {
      setError("Could not access microphone. Please allow permission and try again.");
      stopListening();
    }
  }, [supported, stopListening, measureNoiseLevel, isListening]);

  const handleConfirm = () => {
    const full = (transcript + interim).trim();
    if (full) onTranscript(full);
    stopListening();
    setTranscript("");
    setInterim("");
  };

  const handleDiscard = () => {
    stopListening();
    setTranscript("");
    setInterim("");
    onClose?.();
  };

  const bars = Array.from({ length: 5 }, (_, i) => i);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {!supported && (
        <div className="text-xs text-destructive bg-destructive/10 rounded-xl px-3 py-2 border border-destructive/20">
          {error}
        </div>
      )}

      {supported && (
        <>
          {/* Transcript area */}
          {(transcript || interim || isListening) && (
            <div className="glass-card rounded-2xl px-3 py-2.5 min-h-[60px] text-sm fade-in border border-primary/15">
              <span className="text-foreground font-medium">{transcript}</span>
              <span className="text-muted-foreground italic">{interim}</span>
              {isListening && !interim && !transcript && (
                <span className="text-muted-foreground text-xs animate-pulse">Listening...</span>
              )}
            </div>
          )}

          {error && (
            <div className="text-xs text-destructive bg-destructive/10 rounded-xl px-3 py-2 border border-destructive/20">
              {error}
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Mic button */}
            <button
              onClick={isListening ? stopListening : startListening}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-2xl font-bold text-sm transition-all",
                isListening
                  ? "bg-primary text-primary-foreground glow-primary-sm voice-recording"
                  : "bg-primary/10 text-primary hover:bg-primary/20"
              )}
            >
              {isListening ? (
                <>
                  <MicOff className="w-4 h-4" />
                  <span>Stop</span>
                  {/* Noise level bars */}
                  <div className="flex items-end gap-0.5 h-4">
                    {bars.map(i => (
                      <div
                        key={i}
                        className="w-1 bg-primary-foreground/70 rounded-full transition-all duration-100"
                        style={{
                          height: `${Math.max(3, (noiseLevel / 100) * 16 * (0.5 + Math.sin(Date.now() / 200 + i) * 0.5))}px`,
                        }}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  <span>Speak</span>
                </>
              )}
            </button>

            {/* Confirm/discard when there's text */}
            {(transcript || interim) && (
              <>
                <button
                  onClick={handleConfirm}
                  className="p-2 rounded-xl bg-green-500/15 text-green-600 hover:bg-green-500/25 transition-all"
                  title="Use this text"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={handleDiscard}
                  className="p-2 rounded-xl bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
                  title="Discard"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            )}

            {/* Noise suppression badge */}
            {isListening && (
              <span className="ml-auto text-[9px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                Noise Cancel ON
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Floating mic FAB for the layout
export function VoiceFAB() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);

  const handleTranscript = (t: string) => {
    setText(prev => prev ? prev + " " + t : t);
  };

  const handleCopy = async () => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          "fixed bottom-24 right-4 z-40 w-12 h-12 rounded-2xl shadow-xl flex items-center justify-center transition-all duration-200 md:bottom-8",
          "bg-gradient-to-br from-primary via-primary to-purple-600 text-white hover:scale-110 active:scale-95",
          open && "scale-110 ring-2 ring-primary/40 glow-primary-sm"
        )}
        aria-label="Voice Input"
      >
        <Mic className="w-5 h-5" />
      </button>

      {open && (
        <div className="fixed bottom-40 right-4 z-50 w-72 glass-panel rounded-3xl p-4 shadow-2xl pop-in md:bottom-24">
          <div className="flex items-center justify-between mb-3">
            <p className="font-black text-sm text-foreground">Voice Input</p>
            <div className="flex items-center gap-1">
              {text && (
                <button
                  onClick={handleCopy}
                  className="text-[10px] px-2 py-1 rounded-lg bg-primary/10 text-primary font-bold hover:bg-primary/20 transition-all"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <VoiceInput
            onTranscript={handleTranscript}
            onClose={() => setOpen(false)}
          />

          {text && (
            <div className="mt-2 p-2.5 bg-muted/50 rounded-xl text-xs text-foreground border border-border/40">
              <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Collected text</p>
              {text}
            </div>
          )}
        </div>
      )}
    </>
  );
}
