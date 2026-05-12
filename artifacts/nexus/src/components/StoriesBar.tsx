import { useListStories, useCreateStory, useViewStory } from "@workspace/api-client-react";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/hooks/use-auth";
import { Plus, X, ChevronLeft, ChevronRight, Loader2, Camera, Video, Image as ImageIcon, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect, useCallback } from "react";
import type { StoryGroup } from "@workspace/api-client-react";
import { useSound } from "@/hooks/use-sound";
import { cn } from "@/lib/utils";

const STORY_DURATION = 5000;

export function StoriesBar() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: storyGroups } = useListStories();
  const [viewing, setViewing] = useState<StoryGroup | null>(null);
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showCreator, setShowCreator] = useState(false);
  const { playStory, playClick } = useSound();

  const [deleting, setDeleting] = useState(false);

  const { mutate: viewStory } = useViewStory({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/stories"] }) },
  });

  const deleteStory = async (storyId: number) => {
    if (deleting) return;
    setDeleting(true);
    try {
      await fetch(`/api/stories/${storyId}`, { method: "DELETE", credentials: "include" });
      qc.invalidateQueries({ queryKey: ["/api/stories"] });
      goNext();
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  };
  const { mutate: createStory, isPending: creating } = useCreateStory({
    mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/stories"] }); setShowCreator(false); } },
  });

  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startProgress = useCallback(() => {
    setProgress(0);
    if (progressRef.current) clearInterval(progressRef.current);
    const start = Date.now();
    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const p = Math.min((elapsed / STORY_DURATION) * 100, 100);
      setProgress(p);
      if (p >= 100) clearInterval(progressRef.current!);
    }, 50);
  }, []);

  const goNext = useCallback(() => {
    if (!viewing?.stories) return;
    if (storyIdx < viewing.stories.length - 1) {
      const next = storyIdx + 1;
      setStoryIdx(next);
      viewStory({ storyId: viewing.stories[next].id });
      startProgress();
    } else {
      setViewing(null);
      if (progressRef.current) clearInterval(progressRef.current);
    }
  }, [viewing, storyIdx, viewStory, startProgress]);

  const goPrev = useCallback(() => {
    if (storyIdx > 0) {
      const prev = storyIdx - 1;
      setStoryIdx(prev);
      startProgress();
    }
  }, [storyIdx, startProgress]);

  const openStory = (group: StoryGroup) => {
    setViewing(group);
    setStoryIdx(0);
    if (group.stories?.[0]) viewStory({ storyId: group.stories[0].id });
    playStory();
    startProgress();
  };

  useEffect(() => {
    if (!viewing) {
      if (progressRef.current) clearInterval(progressRef.current);
      setProgress(0);
      return undefined;
    }
    if (progress >= 100) {
      const timer = setTimeout(goNext, 100);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [progress, viewing, goNext]);

  useEffect(() => {
    return () => { if (progressRef.current) clearInterval(progressRef.current); };
  }, []);

  const currentStory = viewing?.stories?.[storyIdx];

  return (
    <>
      {/* Stories row */}
      <div className="flex gap-3.5 overflow-x-auto pb-1 no-scrollbar px-0.5">
        {/* Add story button */}
        <button
          onClick={() => { setShowCreator(true); playClick(); }}
          className="flex-shrink-0 flex flex-col items-center gap-2 group"
        >
          <div className="relative w-16 h-16">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/30 group-hover:border-primary group-hover:scale-105 transition-all duration-200 flex items-center justify-center">
              <Plus className="w-7 h-7 text-primary" strokeWidth={2.5} />
            </div>
          </div>
          <span className="text-[10px] text-muted-foreground font-semibold">Add Story</span>
        </button>

        {/* Story groups */}
        {storyGroups?.groups?.map((group) => (
          <button
            key={group.user?.id}
            onClick={() => openStory(group)}
            className="flex-shrink-0 flex flex-col items-center gap-2 group"
          >
            <div className="relative w-16 h-16">
              {/* Gradient ring */}
              <div className={cn(
                "absolute inset-0 rounded-full p-[2.5px]",
                group.hasUnviewed !== false ? "story-ring" : "story-ring-viewed"
              )}>
                <div className="w-full h-full rounded-full bg-background p-[2px]">
                  <Avatar
                    src={group.user?.avatarUrl}
                    name={group.user?.displayName || group.user?.username || "User"}
                    size="lg"
                    className="w-full h-full"
                  />
                </div>
              </div>
              {/* Viewed dim overlay */}
              {group.hasUnviewed === false && (
                <div className="absolute inset-[5px] rounded-full bg-background/40" />
              )}
            </div>
            <span className="text-[10px] text-muted-foreground font-semibold max-w-[60px] truncate">
              {group.user?.username}
            </span>
          </button>
        ))}
      </div>

      {/* Story Creator Sheet */}
      {showCreator && (
        <StoryCreator
          onClose={() => setShowCreator(false)}
          onCreate={(data) => createStory({ data: { mediaUrl: data.mediaUrl, type: "image" } })}
          creating={creating}
        />
      )}

      {/* Story Viewer */}
      {viewing && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center backdrop-blur-sm"
          onClick={() => setViewing(null)}
        >
          <div
            className="relative w-full max-w-[360px] mx-4 h-[88vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl"
            style={{ boxShadow: "0 0 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.08)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Progress bars */}
            <div className="absolute top-3.5 left-3.5 right-3.5 flex gap-1.5 z-20">
              {viewing.stories?.map((_, i) => (
                <div key={i} className="flex-1 h-[3px] rounded-full bg-white/20 overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full"
                    style={{
                      width: i < storyIdx ? "100%" : i === storyIdx ? `${progress}%` : "0%",
                      transition: i === storyIdx ? "none" : undefined,
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Header */}
            <div className="absolute top-10 left-3.5 right-3.5 flex items-center justify-between z-20">
              <div className="flex items-center gap-2.5">
                <div className="p-[2px] story-ring rounded-full">
                  <div className="p-[2px] bg-black/30 rounded-full">
                    <Avatar src={viewing.user?.avatarUrl} name={viewing.user?.displayName || "User"} size="sm" />
                  </div>
                </div>
                <div>
                  <p className="text-white font-bold text-sm drop-shadow">{viewing.user?.username}</p>
                  {currentStory?.createdAt && (
                    <p className="text-white/55 text-[10px]">
                      {new Date(currentStory.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {currentStory && viewing.user?.id === user?.id && (
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteStory(currentStory.id); }}
                    disabled={deleting}
                    className="p-2 text-red-400 hover:text-red-300 bg-black/25 hover:bg-red-500/30 rounded-full backdrop-blur-sm transition-all disabled:opacity-50"
                    title="Delete story"
                  >
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                )}
                <button
                  onClick={() => setViewing(null)}
                  className="p-2 text-white/80 hover:text-white bg-black/25 hover:bg-black/40 rounded-full backdrop-blur-sm transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Story media */}
            {currentStory && (
              currentStory.mediaUrl?.match(/\.(mp4|webm|ogg|mov)$/i) ? (
                <video
                  src={currentStory.mediaUrl}
                  autoPlay muted loop={false} playsInline
                  className="w-full h-full object-cover"
                  onEnded={goNext}
                />
              ) : (
                <img
                  src={currentStory.mediaUrl ?? undefined}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="eager"
                />
              )
            )}

            {/* Gradient overlays */}
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/50 to-transparent pointer-events-none z-10" />
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/60 to-transparent pointer-events-none z-10" />

            {/* Tap zones — left/center/right so center tap doesn't navigate */}
            <div className="absolute inset-0 flex z-10">
              <button
                className="w-[28%] flex items-center justify-start pl-3"
                onClick={(e) => { e.stopPropagation(); goPrev(); }}
                aria-label="Previous story"
              >
                {storyIdx > 0 && (
                  <div className="p-1.5 rounded-full bg-white/15 backdrop-blur-sm hover:bg-white/25 transition-colors">
                    <ChevronLeft className="w-4 h-4 text-white" />
                  </div>
                )}
              </button>
              {/* Center zone — no navigation, lets interactions pass through */}
              <div className="flex-1" />
              <button
                className="w-[28%] flex items-center justify-end pr-3"
                onClick={(e) => { e.stopPropagation(); goNext(); }}
                aria-label="Next story"
              >
                <div className="p-1.5 rounded-full bg-white/15 backdrop-blur-sm hover:bg-white/25 transition-colors">
                  <ChevronRight className="w-4 h-4 text-white" />
                </div>
              </button>
            </div>

            {/* Bottom reactions */}
            <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-4 z-20">
              {["❤️", "🔥", "😍", "😂", "👏"].map((r) => (
                <button
                  key={r}
                  className="text-2xl hover:scale-150 transition-all duration-150 active:scale-90 drop-shadow-2xl"
                  onClick={(e) => { e.stopPropagation(); }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StoryCreator({
  onClose,
  onCreate,
  creating,
}: {
  onClose: () => void;
  onCreate: (data: { mediaUrl: string }) => void;
  creating: boolean;
}) {
  const [preview, setPreview] = useState<string>("");
  const [url, setUrl] = useState("");
  const [tab, setTab] = useState<"upload" | "url">("upload");
  const fileRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string>("");

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    // Upload to server
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload/media", { method: "POST", credentials: "include", body: formData });
      if (res.ok) {
        const { url: serverUrl } = await res.json() as { url: string };
        setUploadedUrl(serverUrl);
      }
    } catch {
      // keep local preview as fallback
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = () => {
    const finalUrl = tab === "upload" ? (uploadedUrl || preview) : url.trim();
    if (!finalUrl) return;
    onCreate({ mediaUrl: finalUrl });
  };

  const isVideo = preview?.startsWith("data:video") || url?.match(/\.(mp4|webm|ogg|mov)$/i);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md" onClick={onClose}>
      <div
        className="bg-card border border-card-border rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-sm mx-0 sm:mx-4 p-5 pop-in"
        style={{ boxShadow: "0 -20px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-foreground">Add Story</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/60 rounded-2xl p-1 mb-4">
          {(["upload", "url"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all",
                tab === t ? "btn-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "upload" ? <Camera className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
              {t === "upload" ? "Upload" : "URL"}
            </button>
          ))}
        </div>

        {tab === "upload" ? (
          <div>
            <input ref={fileRef} type="file" accept="image/*,video/*" capture="environment" onChange={handleFile} className="hidden" />
            {preview ? (
              <div className="relative rounded-2xl overflow-hidden mb-4 aspect-[9/16] max-h-60 bg-muted">
                {isVideo
                  ? <video src={preview} className="w-full h-full object-cover" muted autoPlay loop playsInline />
                  : <img src={preview} alt="" className="w-full h-full object-cover" />}
                <button onClick={() => setPreview("")} className="absolute top-2 right-2 bg-black/55 rounded-full p-1.5 text-white hover:bg-black/75 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full h-40 rounded-2xl border-2 border-dashed border-primary/35 flex flex-col items-center justify-center gap-3 text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 active:scale-[0.98] transition-all mb-4"
              >
                <div className="flex gap-4 text-current">
                  <Camera className="w-8 h-8 opacity-80" />
                  <Video className="w-8 h-8 opacity-80" />
                </div>
                <p className="text-sm font-semibold">Tap to choose photo or video</p>
                <p className="text-xs opacity-50">JPG, PNG, MP4, MOV</p>
              </button>
            )}
          </div>
        ) : (
          <div className="mb-4">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste image or video URL…"
              className="w-full bg-muted border border-border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25 transition-all"
            />
            {url && !url.match(/\.(mp4|webm|ogg|mov)$/i) && (
              <div className="mt-3 rounded-2xl overflow-hidden max-h-40 bg-muted">
                <img src={url} alt="" className="w-full h-full object-cover" onError={() => {}} />
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={creating || uploading || (!preview && !url)}
          className={cn(
            "w-full py-3.5 rounded-2xl text-sm font-black transition-all",
            !creating && !uploading && (preview || url)
              ? "btn-primary text-primary-foreground glow-primary-sm"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          {uploading ? "Uploading…" : creating
            ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Sharing…</span>
            : "Share Story ✨"}
        </button>
      </div>
    </div>
  );
}
