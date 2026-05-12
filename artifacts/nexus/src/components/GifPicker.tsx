import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Search, X, Loader2 } from "lucide-react";

interface TenorGif {
  id: string;
  title: string;
  media_formats: {
    gif?: { url: string; dims: [number, number] };
    tinygif?: { url: string; dims: [number, number] };
    nanogif?: { url: string; dims: [number, number] };
  };
  content_description: string;
}

interface GifPickerProps {
  onSelect: (url: string) => void;
  onClose: () => void;
  position?: "top" | "bottom";
  triggerRef?: React.RefObject<HTMLElement | null>;
}

const GIF_CATEGORIES = ["😂 Funny", "❤️ Love", "🔥 Hype", "🥺 Sad", "👏 Clap", "🎉 Party", "🤔 Think", "😤 Angry"];

export function GifPicker({ onSelect, onClose, position = "top", triggerRef }: GifPickerProps) {
  const [search, setSearch] = useState("");
  const [gifs, setGifs] = useState<TenorGif[]>([]);
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pickerStyle, setPickerStyle] = useState<React.CSSProperties>({
    position: "fixed", opacity: 0, pointerEvents: "none",
  });

  useLayoutEffect(() => {
    const PICKER_W = 300;
    const PICKER_H = 380;
    const GAP = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const el = triggerRef?.current;
    let top: number;
    let left: number;

    if (el) {
      const rect = el.getBoundingClientRect();
      if (position === "top" || rect.bottom + PICKER_H + GAP > vh) {
        top = rect.top - PICKER_H - GAP;
      } else {
        top = rect.bottom + GAP;
      }
      left = rect.right - PICKER_W;
    } else {
      top = vh - PICKER_H - 90;
      left = vw / 2 - PICKER_W / 2;
    }

    top = Math.max(8, Math.min(top, vh - PICKER_H - 8));
    left = Math.max(8, Math.min(left, vw - PICKER_W - 8));

    setPickerStyle({ position: "fixed", top, left, width: PICKER_W, zIndex: 9999, opacity: 1 });
  }, [triggerRef, position]);

  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (ref.current && !ref.current.contains(target) && !(triggerRef?.current?.contains(target))) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [onClose, triggerRef]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchGifs(search), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const fetchGifs = async (q: string) => {
    setLoading(true);
    try {
      const url = q.trim() ? `/api/gifs/search?q=${encodeURIComponent(q)}` : `/api/gifs/trending`;
      const res = await fetch(url, { credentials: "include" });
      const data = await res.json() as { results: TenorGif[]; configured: boolean };
      setConfigured(data.configured);
      setGifs(data.results ?? []);
    } catch {
      setGifs([]);
    }
    setLoading(false);
  };

  const getGifUrl = (gif: TenorGif) =>
    gif.media_formats?.tinygif?.url ?? gif.media_formats?.nanogif?.url ?? gif.media_formats?.gif?.url ?? "";

  const content = (
    <div
      ref={ref}
      style={pickerStyle}
      className="bg-popover border border-popover-border rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-opacity duration-100"
    >
      <div className="p-2 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2 bg-muted rounded-xl px-2.5 py-1.5">
          <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search GIFs…"
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
            autoFocus
          />
          {search && (
            <button onClick={() => setSearch("")}><X className="w-3 h-3 text-muted-foreground" /></button>
          )}
        </div>
      </div>

      {!search && (
        <div className="flex gap-1 px-2 py-1.5 overflow-x-auto border-b border-border flex-shrink-0" style={{ scrollbarWidth: "none" }}>
          {GIF_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSearch(cat.split(" ").slice(1).join(" "))}
              className="flex-shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <div className="overflow-y-auto flex-1" style={{ maxHeight: 260 }}>
        {!configured ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
            <p className="text-2xl mb-2">🎬</p>
            <p className="text-xs font-bold text-foreground">GIFs not configured</p>
            <p className="text-[10px] text-muted-foreground mt-1">Add <code className="bg-muted px-1 rounded">TENOR_API_KEY</code> to enable GIF search</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-full py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : gifs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
            <p className="text-2xl mb-2">🔍</p>
            <p className="text-xs">No GIFs found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1 p-1">
            {gifs.slice(0, 20).map((gif) => {
              const url = getGifUrl(gif);
              if (!url) return null;
              return (
                <button
                  key={gif.id}
                  onClick={() => { onSelect(url); onClose(); }}
                  className="relative aspect-video overflow-hidden rounded-xl hover:opacity-90 active:scale-95 transition-all bg-muted"
                  title={gif.content_description || gif.title}
                >
                  <img
                    src={url}
                    alt={gif.content_description || gif.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-2 py-1 border-t border-border text-center flex-shrink-0">
        <p className="text-[9px] text-muted-foreground/50">Powered by Tenor</p>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
