import { useState, useRef, useCallback } from "react";
import { X, Smile, Upload, Loader2, Hash, Image as ImageIcon, Music, Bold, Italic, Strikethrough } from "lucide-react";
import { useCreatePost } from "@workspace/api-client-react";
import { CameraButton } from "@/components/CameraCapture";
import { VoiceInput } from "@/components/VoiceInput";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Avatar } from "@/components/Avatar";
import { EmojiPicker } from "@/components/EmojiPicker";
import { cn } from "@/lib/utils";
import { useSound } from "@/hooks/use-sound";

const MOOD_OPTIONS = [
  { emoji: "🔥", label: "Fire" },
  { emoji: "✨", label: "Vibe" },
  { emoji: "😂", label: "Lol" },
  { emoji: "💯", label: "Facts" },
  { emoji: "🥰", label: "Love" },
  { emoji: "😤", label: "Grr" },
  { emoji: "🤯", label: "Mind blown" },
  { emoji: "👑", label: "Royalty" },
];

export function CreatePostModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [isVideo, setIsVideo] = useState(false);
  const [tagsInput, setTagsInput] = useState("");
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [songText, setSongText] = useState("");
  const [activeSection, setActiveSection] = useState<"media" | "tags" | "mood" | "song" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const qc = useQueryClient();
  const { playPost, playClick } = useSound();

  const { mutate: createPost, isPending } = useCreatePost({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/feed"] });
        qc.invalidateQueries({ queryKey: ["/api/posts"] });
        playPost();
        onClose();
      },
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setIsVideo(file.type.startsWith("video/"));
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setImagePreview(dataUrl);
      setImageUrl(dataUrl);
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const insertEmoji = (emoji: string) => {
    const ta = textareaRef.current;
    if (!ta) { setContent((c) => c + emoji); setShowEmoji(false); return; }
    const start = ta.selectionStart ?? content.length;
    const end = ta.selectionEnd ?? content.length;
    const next = content.slice(0, start) + emoji + content.slice(end);
    setContent(next);
    setShowEmoji(false);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  };

  const wrapSelection = (prefix: string, suffix?: string) => {
    const ta = textareaRef.current;
    if (!ta) { setContent(c => prefix + c + (suffix ?? prefix)); return; }
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    const suf = suffix ?? prefix;
    const selected = content.slice(start, end);
    const next = content.slice(0, start) + prefix + selected + suf + content.slice(end);
    setContent(next);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  // Auto-detect hashtags in content
  const detectedTags = content.match(/#([a-zA-Z0-9_]+)/g)?.map((t) => t.slice(1)) ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    const manualTags = tagsInput
      .split(",")
      .map((t) => t.trim().replace(/^#/, ""))
      .filter(Boolean);
    const allTags = [...new Set([...detectedTags, ...manualTags])];
    const songSuffix = songText.trim() ? `\n\n🎵 *${songText.trim()}*` : "";
    const finalContent = (selectedMood ? `${selectedMood} ${content.trim()}` : content.trim()) + songSuffix;
    createPost({
      data: {
        content: finalContent,
        mediaUrl: imageUrl || undefined,
        tags: allTags.length > 0 ? allTags : undefined,
      },
    });
  };

  const toggleSection = useCallback((s: "media" | "tags" | "mood" | "song") => {
    setActiveSection((prev) => (prev === s ? null : s));
    playClick();
  }, [playClick]);

  const charLimit = 500;
  const charPct = Math.min((content.length / charLimit) * 100, 100);
  const overLimit = content.length > charLimit;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-card border border-card-border rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-lg mx-0 sm:mx-4 fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-0">
          <h2 className="text-lg font-black text-foreground">Create Post</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-muted rounded-2xl text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5">
          {/* Text area */}
          <div className="flex gap-3 mb-4">
            <Avatar src={user?.profileImageUrl} name={user?.firstName || "Me"} size="md" />
            <div className="flex-1 relative">
              {selectedMood && (
                <span className="text-xl mb-1 block">{selectedMood}</span>
              )}
              <textarea
                ref={textareaRef}
                className="w-full bg-transparent resize-none text-foreground placeholder:text-muted-foreground focus:outline-none text-base leading-relaxed min-h-[100px]"
                placeholder="What's your rizz today? ✨"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                autoFocus
              />
              {/* Character arc */}
              <div className="flex items-center justify-end gap-2 mt-1">
                <svg className="w-6 h-6 -rotate-90" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" fill="none" stroke="hsl(var(--muted))" strokeWidth="2.5" />
                  <circle
                    cx="12" cy="12" r="10" fill="none"
                    stroke={overLimit ? "hsl(var(--destructive))" : "hsl(var(--primary))"}
                    strokeWidth="2.5"
                    strokeDasharray={`${charPct * 0.628} 100`}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dasharray 0.2s ease" }}
                  />
                </svg>
                <span className={cn("text-xs font-bold", overLimit ? "text-destructive" : charPct > 80 ? "text-amber-500" : "text-muted-foreground")}>
                  {charLimit - content.length}
                </span>
              </div>
            </div>
          </div>

          {/* Auto-detected tags */}
          {detectedTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3 px-1">
              {detectedTags.map((tag) => (
                <span key={tag} className="text-xs text-primary bg-primary/10 px-2.5 py-1 rounded-full font-semibold">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Media preview */}
          {(imagePreview || imageUrl) && (
            <div className="relative mb-4 rounded-2xl overflow-hidden bg-muted">
              {uploading ? (
                <div className="h-40 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : isVideo ? (
                <video src={imagePreview || imageUrl} className="w-full max-h-64 object-cover" muted autoPlay loop playsInline />
              ) : (
                <img src={imagePreview || imageUrl} alt="Preview" className="w-full max-h-64 object-cover" />
              )}
              <button
                type="button"
                onClick={() => { setImageUrl(""); setImagePreview(""); setIsVideo(false); }}
                className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full p-1.5 text-white hover:bg-black/80 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Expandable sections */}
          <div className="space-y-2 mb-4">
            {/* Media section */}
            {activeSection === "media" && (
              <div className="bg-muted/50 rounded-2xl p-3 fade-in space-y-2">
                <input ref={fileRef} type="file" accept="image/*,video/*" onChange={handleFileChange} className="hidden" />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-primary/40 text-sm font-semibold text-primary hover:bg-primary/5 transition-all"
                  >
                    <Upload className="w-4 h-4" /> Upload
                  </button>
                  <CameraButton
                    className="flex-1 justify-center p-3 border border-dashed border-primary/30"
                    onCapture={(dataUrl) => { setImagePreview(dataUrl); setImageUrl(dataUrl); setIsVideo(false); }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const url = prompt("Paste image or video URL:");
                      if (url) { setImageUrl(url); setImagePreview(url); setIsVideo(/\.(mp4|webm|ogg|mov)$/i.test(url)); }
                    }}
                    className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-border text-sm font-semibold text-muted-foreground hover:bg-muted transition-all"
                  >
                    <ImageIcon className="w-4 h-4" /> URL
                  </button>
                </div>
                {/* Voice input for post content */}
                <div className="border-t border-border/30 pt-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Dictate your post</p>
                  <VoiceInput
                    onTranscript={(text) => setContent(prev => prev ? prev + " " + text : text)}
                  />
                </div>
              </div>
            )}

            {/* Tags section */}
            {activeSection === "tags" && (
              <div className="fade-in">
                <input
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="extra #tags, #vibes (or type in post above)"
                  className="w-full bg-muted/60 border border-border/40 rounded-2xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                />
              </div>
            )}

            {/* Mood section */}
            {activeSection === "mood" && (
              <div className="bg-muted/50 rounded-2xl p-3 fade-in">
                <p className="text-xs font-bold text-muted-foreground mb-2">Select mood</p>
                <div className="flex flex-wrap gap-2">
                  {MOOD_OPTIONS.map((m) => (
                    <button
                      key={m.emoji}
                      type="button"
                      onClick={() => { setSelectedMood(selectedMood === m.emoji ? null : m.emoji); }}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold transition-all hover:scale-105",
                        selectedMood === m.emoji
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-card border border-border text-foreground hover:bg-muted"
                      )}
                    >
                      {m.emoji} {m.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Song section */}
            {activeSection === "song" && (
              <div className="bg-muted/50 rounded-2xl p-3 fade-in">
                <p className="text-xs font-bold text-muted-foreground mb-2">🎵 What are you listening to?</p>
                <input
                  value={songText}
                  onChange={(e) => setSongText(e.target.value)}
                  placeholder="Artist – Song title"
                  maxLength={80}
                  className="w-full bg-card border border-border/50 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                />
                {songText && (
                  <p className="text-xs text-muted-foreground mt-2">Will appear as: 🎵 <em>{songText}</em></p>
                )}
              </div>
            )}
          </div>

          {/* Toolbar + Submit */}
          <div className="border-t border-border/40 pt-4 flex items-center justify-between">
            <div className="flex items-center gap-0.5 flex-wrap">
              {/* Rich text formatting */}
              <button type="button" onClick={() => wrapSelection("**")} className="p-2 rounded-xl transition-all text-muted-foreground hover:text-primary hover:bg-primary/10 font-bold text-sm" title="Bold (**text**)">
                <Bold className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => wrapSelection("*")} className="p-2 rounded-xl transition-all text-muted-foreground hover:text-primary hover:bg-primary/10" title="Italic (*text*)">
                <Italic className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => wrapSelection("~~")} className="p-2 rounded-xl transition-all text-muted-foreground hover:text-primary hover:bg-primary/10" title="Strikethrough (~~text~~)">
                <Strikethrough className="w-4 h-4" />
              </button>
              <div className="w-px h-4 bg-border/60 mx-0.5" />
              <button
                type="button"
                onClick={() => toggleSection("media")}
                className={cn(
                  "p-2 rounded-xl transition-all",
                  activeSection === "media" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                )}
                title="Add media"
              >
                <ImageIcon className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => toggleSection("tags")}
                className={cn(
                  "p-2 rounded-xl transition-all",
                  activeSection === "tags" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                )}
                title="Add tags"
              >
                <Hash className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => toggleSection("mood")}
                className={cn(
                  "p-2 rounded-xl transition-all",
                  selectedMood ? "text-primary bg-primary/10" : activeSection === "mood" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                )}
                title="Set mood"
              >
                <span className="text-lg leading-none">{selectedMood ?? "🎭"}</span>
              </button>
              <button
                type="button"
                onClick={() => toggleSection("song")}
                className={cn(
                  "p-2 rounded-xl transition-all",
                  activeSection === "song" || songText ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                )}
                title="Add song"
              >
                <Music className="w-5 h-5" />
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setShowEmoji(!showEmoji); playClick(); }}
                  className={cn(
                    "p-2 rounded-xl transition-all",
                    showEmoji ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                  )}
                  title="Emoji"
                >
                  <Smile className="w-5 h-5" />
                </button>
                {showEmoji && (
                  <EmojiPicker
                    onSelect={insertEmoji}
                    onClose={() => setShowEmoji(false)}
                    position="top"
                  />
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={!content.trim() || isPending || overLimit}
              className={cn(
                "px-6 py-2.5 rounded-2xl text-sm font-black transition-all",
                content.trim() && !isPending && !overLimit
                  ? "btn-primary text-primary-foreground glow-primary-sm"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Posting…
                </span>
              ) : "Post ✨"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
