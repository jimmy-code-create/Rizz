import { useState } from "react";
import { cn } from "@/lib/utils";
import { X, Check, ChevronRight, Star, Zap, Award, Plus, Trash2 } from "lucide-react";

const DEFAULT_QUESTS: Quest[] = [
  { id: "profile", emoji: "👤", title: "Set up your profile", desc: "Add a display name and bio", xp: 50 },
  { id: "post",    emoji: "📸", title: "Share your first post", desc: "Post something to your feed", xp: 100 },
  { id: "story",   emoji: "✨", title: "Post a story", desc: "Share a moment with your followers", xp: 75 },
  { id: "follow",  emoji: "👥", title: "Follow someone", desc: "Find and follow another user", xp: 25 },
  { id: "server",  emoji: "🏠", title: "Join a server", desc: "Join or create a community server", xp: 50 },
  { id: "music",   emoji: "🎵", title: "Listen to music", desc: "Play a track in the music player", xp: 25 },
];

interface Quest { id: string; emoji: string; title: string; desc: string; xp: number; custom?: boolean; }

function loadCustomQuests(): Quest[] {
  try { return JSON.parse(localStorage.getItem("rizz_custom_quests") ?? "[]") as Quest[]; }
  catch { return []; }
}

export function StarterQuest({ onClose }: { onClose: () => void }) {
  const [customQuests, setCustomQuests] = useState<Quest[]>(loadCustomQuests);
  const [completed, setCompleted] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("rizz_quests") ?? "[]") as string[]); }
    catch { return new Set(); }
  });
  const [showAdd, setShowAdd] = useState(false);
  const [newEmoji, setNewEmoji] = useState("🎯");
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newXp, setNewXp] = useState("50");

  const allQuests = [...DEFAULT_QUESTS, ...customQuests];

  const toggle = (id: string) => {
    setCompleted(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem("rizz_quests", JSON.stringify([...next]));
      return next;
    });
  };

  const addQuest = () => {
    if (!newTitle.trim()) return;
    const quest: Quest = {
      id: `custom_${Date.now()}`,
      emoji: newEmoji.trim() || "🎯",
      title: newTitle.trim(),
      desc: newDesc.trim() || "Complete this quest",
      xp: Math.max(5, Math.min(500, Number(newXp) || 50)),
      custom: true,
    };
    const updated = [...customQuests, quest];
    setCustomQuests(updated);
    localStorage.setItem("rizz_custom_quests", JSON.stringify(updated));
    setNewTitle(""); setNewDesc(""); setNewXp("50"); setNewEmoji("🎯");
    setShowAdd(false);
  };

  const deleteCustom = (id: string) => {
    const updated = customQuests.filter(q => q.id !== id);
    setCustomQuests(updated);
    localStorage.setItem("rizz_custom_quests", JSON.stringify(updated));
    setCompleted(prev => {
      const next = new Set(prev);
      next.delete(id);
      localStorage.setItem("rizz_quests", JSON.stringify([...next]));
      return next;
    });
  };

  const earnedXp = allQuests.filter(q => completed.has(q.id)).reduce((s, q) => s + q.xp, 0);
  const totalXp   = allQuests.reduce((s, q) => s + q.xp, 0);
  const pct       = totalXp > 0 ? Math.round((earnedXp / totalXp) * 100) : 0;
  const allDone   = allQuests.length > 0 && allQuests.every(q => completed.has(q.id));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm mx-4 bg-card border border-card-border rounded-t-3xl sm:rounded-3xl shadow-2xl pop-in overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="p-5 pb-4 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.12), hsl(280 80% 60% / 0.08))" }}>
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-primary/5 -translate-y-8 translate-x-8" />
          <div className="flex items-start justify-between relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-xl btn-primary flex items-center justify-center">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <h2 className="font-black text-foreground text-lg">Quests</h2>
              </div>
              <p className="text-xs text-muted-foreground">Tap quests to mark complete · Add your own</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowAdd(s => !s)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/15 text-primary text-xs font-bold hover:bg-primary/25 transition-all active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" /> Add Quest
              </button>
              <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-xl transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* XP bar */}
          <div className="mt-4 relative z-10">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-current" />
                <span className="text-sm font-black text-foreground">{earnedXp} XP</span>
                <span className="text-xs text-muted-foreground">/ {totalXp} XP</span>
              </div>
              <span className="text-xs font-bold text-primary">{pct}% done</span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full btn-primary rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>

        {/* Add Quest Form */}
        {showAdd && (
          <div className="px-4 py-3 border-b border-border/40 bg-muted/20 fade-in space-y-2.5">
            <p className="text-xs font-black text-foreground uppercase tracking-wider">New Quest</p>
            <div className="flex gap-2">
              <input
                value={newEmoji}
                onChange={e => setNewEmoji(e.target.value)}
                className="w-12 text-center bg-background border border-border rounded-xl py-2 text-xl focus:outline-none focus:ring-2 focus:ring-primary/30"
                maxLength={2}
              />
              <input
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addQuest()}
                placeholder="Quest title…"
                autoFocus
                className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <div className="flex items-center gap-1 bg-background border border-border rounded-xl px-2 py-2 w-20">
                <Star className="w-3 h-3 text-amber-400 fill-current flex-shrink-0" />
                <input
                  value={newXp}
                  onChange={e => setNewXp(e.target.value)}
                  type="number" min={5} max={500}
                  className="w-full bg-transparent text-sm text-foreground focus:outline-none text-center"
                />
              </div>
            </div>
            <input
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addQuest()}
              placeholder="Short description (optional)…"
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <div className="flex gap-2">
              <button onClick={addQuest} disabled={!newTitle.trim()}
                className="flex-1 py-2.5 btn-primary text-primary-foreground rounded-xl text-xs font-black disabled:opacity-40 transition-all active:scale-95">
                Add Quest
              </button>
              <button onClick={() => setShowAdd(false)}
                className="px-4 py-2.5 bg-muted text-muted-foreground rounded-xl text-xs font-bold hover:bg-muted/80 transition-all">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Quest list */}
        <div className="p-3 space-y-1.5 max-h-64 overflow-y-auto no-scrollbar">
          {allQuests.map(quest => {
            const done = completed.has(quest.id);
            return (
              <div key={quest.id} className="relative group/q">
                <button onClick={() => toggle(quest.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left hover:scale-[1.01] active:scale-[0.99]",
                    done ? "border-primary/40 bg-primary/5" : "border-border/40 bg-card hover:border-border/80"
                  )}>
                  <div className={cn(
                    "w-10 h-10 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 transition-all leading-none",
                    done ? "bg-primary/20" : "bg-muted"
                  )}>
                    {done ? <Check className="w-5 h-5 text-primary" strokeWidth={2.5} /> : <span style={{ fontFamily: "Apple Color Emoji, Segoe UI Emoji, sans-serif" }}>{quest.emoji}</span>}
                  </div>
                  <div className="flex-1 min-w-0 pr-1">
                    <p className={cn("text-sm font-bold truncate", done ? "text-primary line-through opacity-60" : "text-foreground")}>{quest.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{quest.desc}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={cn("text-xs font-black px-2 py-0.5 rounded-full whitespace-nowrap", done ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
                      +{quest.xp} XP
                    </span>
                    {!done && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                  </div>
                </button>
                {quest.custom && (
                  <button
                    onClick={() => deleteCustom(quest.id)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-0 group-hover/q:opacity-100 transition-all p-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 z-10"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className={cn("p-4 border-t border-border/40", allDone ? "bg-primary/5" : "")}>
          {allDone ? (
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-lg flex-shrink-0">
                <Award className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-black text-foreground text-sm">All Quests Done! 🎉</p>
                <p className="text-xs text-muted-foreground">You're a Rizz legend!</p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-center text-muted-foreground">
              {totalXp - earnedXp > 0 ? `${totalXp - earnedXp} XP remaining` : "Check off what you've done!"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
