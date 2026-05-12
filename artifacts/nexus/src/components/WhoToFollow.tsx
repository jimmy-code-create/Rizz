import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar } from "@/components/Avatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { Link } from "wouter";
import { UserPlus, Users, Loader2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useOnlineUsers } from "@/hooks/use-presence";

interface SuggestedUser {
  id: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  isVerified?: boolean;
  followerCount: number;
  bio?: string | null;
  topBadge?: { id: number; name?: string | null; icon?: string | null } | null;
  isOnline?: boolean;
}

export function WhoToFollow() {
  const qc = useQueryClient();
  const onlineUsers = useOnlineUsers();
  const [followed, setFollowed] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<{ users: SuggestedUser[] }>({
    queryKey: ["/api/suggestions"],
    queryFn: () => fetch("/api/suggestions", { credentials: "include" }).then((r) => r.json()),
    staleTime: 60_000,
  });

  const followMutation = useMutation({
    mutationFn: (userId: string) =>
      fetch(`/api/users/${userId}/follow`, { method: "POST", credentials: "include" }).then((r) => r.json()),
    onSuccess: (_, userId) => {
      setFollowed((prev) => new Set([...prev, userId]));
      qc.invalidateQueries({ queryKey: ["/api/suggestions"] });
    },
  });

  const users = (data?.users ?? []).filter((u) => !followed.has(u.id)).slice(0, 5);

  if (!isLoading && users.length === 0) return null;

  return (
    <div className="rizz-card overflow-hidden mb-4">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30">
        <Users className="w-4 h-4 text-primary" />
        <h3 className="font-black text-sm text-foreground">Who to Follow</h3>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="divide-y divide-border/20">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
              <Link href={`/profile/${u.id}`}>
                <a>
                  <Avatar
                    src={u.avatarUrl}
                    name={u.displayName || u.username || "?"}
                    size="sm"
                    online={onlineUsers.has(u.id)}
                  />
                </a>
              </Link>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <Link href={`/profile/${u.id}`}>
                    <a className="text-sm font-black text-foreground hover:text-primary transition-colors truncate">
                      {u.displayName || u.username}
                    </a>
                  </Link>
                  {u.isVerified && <VerifiedBadge size="sm" />}
                  {u.topBadge?.icon && (
                    <span className="text-xs" title={u.topBadge.name ?? ""}>{u.topBadge.icon}</span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  @{u.username} · {u.followerCount.toLocaleString()} followers
                </p>
              </div>
              <button
                onClick={() => followMutation.mutate(u.id)}
                disabled={followMutation.isPending}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-black transition-all",
                  "bg-primary text-primary-foreground hover:opacity-90 active:scale-95 shadow-sm",
                  "disabled:opacity-60"
                )}
              >
                <UserPlus className="w-3 h-3" />
                Follow
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
