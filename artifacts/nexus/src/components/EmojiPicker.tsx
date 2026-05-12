import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Search, X, Loader2 } from "lucide-react";

interface EmojiGGEmoji {
  id: string;
  title: string;
  slug: string;
  image: string;
  category: string;
  tags?: string[];
}

interface EmojiPickerProps {
  onSelect: (text: string) => void;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
  position?: "top" | "bottom";
}

const STANDARD_EMOJIS = [
  "😀","😂","🥰","😍","🤩","😎","🥳","🤗","😭","😱","🤯","💀","🫶","👏","🙌","🤙",
  "❤️","🔥","✨","💯","👑","🎉","💎","🌟","💜","🩷","🩵","🖤","🤍","💛","🧡","❤️‍🔥",
  "🐱","🐶","🦊","🐸","🦋","🌈","🌸","🍑","🫦","💅","💪","🫠","🙃","😤","😩","😏",
  "🎵","🎶","🎸","🎤","🎬","📸","🏆","⚡","🌊","🌙","⭐","🌺","🍕","🍔","🎮","🏀",
  "🙏","🤝","👋","🤞","✌️","🤟","🫂","👀","💭","💬","🗣️","📱","💻","🔥","⚠️","🚀",
];

const CATEGORIES = ["All", "owo", "Pepe", "Blobs", "Anime", "Gaming", "Memes", "Cute"];

export function EmojiPicker({ onSelect, onClose, triggerRef, position = "top" }: EmojiPickerProps) {
  const [tab, setTab] = useState<"standard" | "custom">("standard");
  const [emojis, setEmojis] = useState<EmojiGGEmoji[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("All");
  const pickerRef = useRef<HTMLDivElement>(null);
  const [pickerStyle, setPickerStyle] = useState<React.CSSProperties>({
    position: "fixed", opacity: 0, pointerEvents: "none",
  });

  useLayoutEffect(() => {
    const PICKER_W = 312;
    const PICKER_H = 380;
    const GAP = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top: number;
    let left: number;

    const el = triggerRef?.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      const spaceAbove = rect.top - GAP;
      const spaceBelow = vh - rect.bottom - GAP;
      if (position === "top" || spaceBelow < PICKER_H) {
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
      if (
        pickerRef.current && !pickerRef.current.contains(target) &&
        !(triggerRef?.current?.contains(target))
      ) {
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
    if (tab !== "custom") return;
    setLoading(true);
    const url = search
      ? `https://emoji.gg/api/?page=1&search=${encodeURIComponent(search)}`
      : `https://emoji.gg/api/?page=${page}`;
    fetch(url)
      .then((r) => r.json())
      .then((data: EmojiGGEmoji[]) => {
        const arr = Array.isArray(data) ? data : [];
        setEmojis((prev) => (page === 1 || search ? arr : [...prev, ...arr]));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [tab, page, search]);

  const filteredCustom = category === "All"
    ? emojis
    : emojis.filter((e) =>
        e.category?.toLowerCase().includes(category.toLowerCase()) ||
        e.title?.toLowerCase().includes(category.toLowerCase())
      );

  const content = (
    <div
      ref={pickerRef}
      style={pickerStyle}
      className="bg-popover border border-popover-border rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-opacity duration-100"
    >
      <div className="flex border-b border-border flex-shrink-0">
        <button
          onClick={() => setTab("standard")}
          className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
            tab === "standard" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Emoji
        </button>
        <button
          onClick={() => { setTab("custom"); setPage(1); setEmojis([]); setSearch(""); }}
          className={`flex-1 py-2.5 text-xs font-semibold transition-colors flex items-center justify-center gap-1 ${
            tab === "custom" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>🌟</span> emoji.gg
        </button>
      </div>

      {tab === "standard" ? (
        <div className="p-2 overflow-y-auto" style={{ maxHeight: 300 }}>
          <div className="grid grid-cols-8 gap-0.5">
            {STANDARD_EMOJIS.map((emoji, i) => (
              <button
                key={i}
                onClick={() => { onSelect(emoji); onClose(); }}
                className="w-8 h-8 text-lg flex items-center justify-center rounded-lg hover:bg-muted transition-colors active:scale-90"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="p-2 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2 bg-muted rounded-xl px-2.5 py-1.5">
              <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); setEmojis([]); }}
                placeholder="Search emoji.gg…"
                className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                autoFocus
              />
              {search && (
                <button onClick={() => { setSearch(""); setPage(1); setEmojis([]); }}>
                  <X className="w-3 h-3 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
          {!search && (
            <div className="flex gap-1 px-2 py-1.5 overflow-x-auto border-b border-border flex-shrink-0" style={{ scrollbarWidth: "none" }}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`flex-shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${
                    category === cat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
          <div className="p-2 overflow-y-auto" style={{ maxHeight: 230 }}>
            {loading && emojis.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">Loading from emoji.gg…</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-5 gap-1">
                  {filteredCustom.slice(0, 50).map((emoji) => (
                    <button
                      key={emoji.id}
                      onClick={() => { onSelect(`<:${emoji.slug}:${emoji.id}>`); onClose(); }}
                      title={emoji.title}
                      className="w-12 h-12 flex items-center justify-center rounded-xl hover:bg-muted transition-colors p-1.5 group"
                    >
                      <img
                        src={emoji.image}
                        alt={emoji.title}
                        className="w-8 h-8 object-contain group-hover:scale-110 transition-transform"
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
                {!search && filteredCustom.length >= 50 && (
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={loading}
                    className="w-full mt-2 py-1.5 text-xs text-primary hover:underline flex items-center justify-center gap-1"
                  >
                    {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                    Load more
                  </button>
                )}
                {filteredCustom.length === 0 && !loading && (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-xs">
                    No emojis found
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );

  return createPortal(content, document.body);
}
