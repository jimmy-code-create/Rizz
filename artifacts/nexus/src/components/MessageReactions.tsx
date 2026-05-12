import { useState, useCallback, useEffect } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

interface ReactionGroup {
  emoji: string;
  count: number;
  users: string[];
  hasReacted: boolean;
}

interface MessageReactionsProps {
  messageId: number;
  reactions?: ReactionGroup[];
  onReactionChange?: () => void;
  showPicker?: boolean;
}

const QUICK_EMOJIS = ["❤️", "🔥", "😂", "😮", "😢", "👏", "💯", "👑", "✨", "🙌", "💀", "🥰"];

export function MessageReactions({ messageId, reactions = [], onReactionChange, showPicker = true }: MessageReactionsProps) {
  const { user } = useAuth();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [localReactions, setLocalReactions] = useState<ReactionGroup[]>(reactions);
  const [pendingEmojis, setPendingEmojis] = useState<Set<string>>(new Set());

  // Sync local state when reactions prop updates from server
  useEffect(() => {
    if (pendingEmojis.size === 0) {
      setLocalReactions(reactions);
    }
  }, [reactions, pendingEmojis.size]);

  const toggleReaction = useCallback(async (emoji: string) => {
    if (!user || pendingEmojis.has(emoji)) return;
    setPendingEmojis(p => new Set([...p, emoji]));
    setShowEmojiPicker(false);

    const existing = localReactions.find(r => r.emoji === emoji);
    const hasReacted = existing?.hasReacted ?? false;

    // Optimistic update
    setLocalReactions(prev => {
      if (hasReacted) {
        return prev.map(r => r.emoji === emoji
          ? { ...r, count: r.count - 1, hasReacted: false, users: r.users.filter(u => u !== user.id) }
          : r
        ).filter(r => r.count > 0);
      } else {
        const found = prev.find(r => r.emoji === emoji);
        if (found) {
          return prev.map(r => r.emoji === emoji
            ? { ...r, count: r.count + 1, hasReacted: true, users: [...r.users, user.id] }
            : r
          );
        }
        return [...prev, { emoji, count: 1, hasReacted: true, users: [user.id] }];
      }
    });

    try {
      if (hasReacted) {
        await fetch(`/api/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`, {
          method: "DELETE", credentials: "include",
        });
      } else {
        await fetch(`/api/messages/${messageId}/reactions`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emoji }),
        });
      }
      onReactionChange?.();
    } catch {
      // Revert on error
      setLocalReactions(reactions);
    } finally {
      setPendingEmojis(p => { const next = new Set(p); next.delete(emoji); return next; });
    }
  }, [user, messageId, localReactions, reactions, onReactionChange, pendingEmojis]);

  if (localReactions.length === 0 && !showPicker) return null;

  return (
    <div className="group flex items-center flex-wrap gap-1 mt-1.5">
      {localReactions.map((reaction) => (
        <button
          key={reaction.emoji}
          onClick={() => toggleReaction(reaction.emoji)}
          disabled={pendingEmojis.has(reaction.emoji)}
          className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold transition-all hover:scale-105 active:scale-95 border",
            reaction.hasReacted
              ? "bg-primary/15 border-primary/40 text-primary"
              : "bg-muted border-border/60 text-foreground hover:bg-muted/80"
          )}
          title={`${reaction.count} reaction${reaction.count !== 1 ? "s" : ""}`}
        >
          <span className="text-sm leading-none">{reaction.emoji}</span>
          <span className="text-[10px]">{reaction.count}</span>
        </button>
      ))}

      {showPicker && (
        <div className="relative">
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="flex items-center justify-center w-6 h-6 rounded-full bg-muted border border-border/60 text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all opacity-0 group-hover:opacity-100"
          >
            <Plus className="w-3 h-3" />
          </button>

          {showEmojiPicker && (
            <div className="absolute bottom-full mb-1.5 left-0 bg-popover border border-popover-border rounded-2xl shadow-xl z-50 p-2">
              <div className="grid grid-cols-6 gap-1">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => toggleReaction(emoji)}
                    className="w-8 h-8 text-base flex items-center justify-center rounded-lg hover:bg-muted transition-colors hover:scale-110 active:scale-95"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
