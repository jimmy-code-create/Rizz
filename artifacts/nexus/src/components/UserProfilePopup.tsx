import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar } from "./Avatar";
import { VerifiedBadge } from "./VerifiedBadge";
import { cn } from "@/lib/utils";
import { MessageCircle, UserPlus, UserMinus, Loader2, X, ShieldOff, ShieldCheck, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";

interface UserProfilePopupProps {
  userId: string;
  onClose: () => void;
  onMessage?: () => void;
}

function isImageUrl(icon: string) {
  return icon.startsWith("/") || icon.startsWith("http");
}

const BANNER_COLORS = [
  "from-violet-600 to-indigo-600",
  "from-rose-500 to-pink-600",
  "from-amber-500 to-orange-600",
  "from-emerald-500 to-teal-600",
  "from-sky-500 to-blue-600",
  "from-fuchsia-500 to-purple-600",
];

export function UserProfilePopup({ userId, onClose, onMessage }: UserProfilePopupProps) {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const popupRef = useRef<HTMLDivElement>(null);
  const isMe = userId === me?.id;
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [actionPending, setActionPending] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: [`/api/users/${userId}`],
    queryFn: () => fetch(`/api/users/${userId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!userId,
  });

  const { data: badgesData } = useQuery({
    queryKey: [`/api/users/${userId}/badges`],
    queryFn: () => fetch(`/api/users/${userId}/badges`, { credentials: "include" }).then(r => r.json()),
    enabled: !!userId,
  });

  const { data: mutualsData } = useQuery({
    queryKey: [`/api/users/${userId}/mutuals`],
    queryFn: () => fetch(`/api/users/${userId}/mutuals`, { credentials: "include" }).then(r => r.json()),
    enabled: !!userId && !isMe,
  });

  const badges = badgesData?.badges ?? [];
  const mutuals: Array<{ id: string; displayName?: string | null; avatarUrl?: string | null; username?: string | null }> = mutualsData?.mutuals ?? [];
  const bannerColor = BANNER_COLORS[Math.abs((userId.charCodeAt(0) || 65) - 65) % BANNER_COLORS.length];

  const handleFollow = async () => {
    if (!profile || actionPending) return;
    setActionPending(true);
    try {
      const endpoint = profile.isFollowing ? `/api/users/${userId}/unfollow` : `/api/users/${userId}/follow`;
      await fetch(endpoint, { method: "POST", credentials: "include" });
      qc.invalidateQueries({ queryKey: [`/api/users/${userId}`] });
    } finally { setActionPending(false); }
  };

  const handleBlock = async () => {
    setActionPending(true);
    try {
      if (profile?.isBlocked) {
        await fetch(`/api/users/${userId}/block`, { method: "DELETE", credentials: "include" });
        qc.invalidateQueries({ queryKey: [`/api/users/${userId}`] });
        setShowBlockConfirm(false);
      } else {
        await fetch(`/api/users/${userId}/block`, { method: "POST", credentials: "include" });
        qc.invalidateQueries({ queryKey: [`/api/users/${userId}`] });
        setShowBlockConfirm(false);
        onClose();
      }
    } finally { setActionPending(false); }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={popupRef}
        className="relative bg-card border border-card-border rounded-3xl shadow-2xl w-full max-w-xs overflow-hidden animate-in zoom-in-95 fade-in duration-200"
      >
        {/* Banner */}
        <div className={cn("h-20 bg-gradient-to-br relative", bannerColor)}>
          <button onClick={onClose} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/30 flex items-center justify-center text-white hover:bg-black/50 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="px-4 pb-4">
          <div className="flex items-end justify-between -mt-9 mb-3">
            <div className="ring-4 ring-card rounded-full shadow-lg">
              <Avatar src={profile?.avatarUrl ?? profile?.profileImageUrl} name={profile?.displayName ?? "User"} size="lg" />
            </div>
            {!isMe && (
              <div className="flex gap-2 mt-2">
                {onMessage && (
                  <button onClick={() => { onMessage(); onClose(); }} className="p-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors" title="Send message">
                    <MessageCircle className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={handleFollow}
                  disabled={actionPending}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                    profile?.isFollowing
                      ? "bg-muted text-foreground hover:bg-destructive/10 hover:text-destructive"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  )}
                >
                  {actionPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : profile?.isFollowing ? <UserMinus className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                  {profile?.isFollowing ? "Unfollow" : "Follow"}
                </button>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : (
            <>
              {/* Name + verified */}
              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                <h3 className="font-black text-base text-foreground">{profile?.displayName ?? "User"}</h3>
                {profile?.isVerified && <VerifiedBadge size="sm" />}
                {badges.slice(0, 3).map((b: { id: number; icon: string; name: string }, i: number) => (
                  isImageUrl(b.icon)
                    ? <img key={i} src={b.icon} alt={b.name} className="w-5 h-5 rounded-md object-cover" />
                    : <span key={i} className="text-sm" title={b.name}>{b.icon}</span>
                ))}
              </div>

              {/* Username + follows-you chip */}
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs text-muted-foreground">@{profile?.username ?? userId.slice(0, 8)}</p>
                {!isMe && profile?.isFollowingBack && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-primary/10 text-primary rounded-full border border-primary/20">
                    Follows you
                  </span>
                )}
              </div>

              {profile?.bio && <p className="text-xs text-foreground leading-relaxed mb-3 line-clamp-3">{profile.bio}</p>}

              {/* Stats */}
              <div className="flex gap-4 py-2 border-t border-border/40 mb-3">
                <div className="text-center">
                  <p className="font-black text-sm text-foreground">{profile?.followerCount ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">Followers</p>
                </div>
                <div className="text-center">
                  <p className="font-black text-sm text-foreground">{profile?.followingCount ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">Following</p>
                </div>
                <div className="text-center">
                  <p className="font-black text-sm text-foreground">{badges.length}</p>
                  <p className="text-[10px] text-muted-foreground">Badges</p>
                </div>
              </div>

              {/* Mutual friends */}
              {!isMe && mutuals.length > 0 && (
                <div className="mb-3 p-2.5 bg-muted/50 rounded-2xl border border-border/30">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Users className="w-3 h-3 text-muted-foreground" />
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                      {mutuals.length} Mutual Friend{mutuals.length > 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {mutuals.slice(0, 4).map((m, i) => (
                      <div key={m.id} style={{ marginLeft: i > 0 ? -8 : 0 }}>
                        <Avatar src={m.avatarUrl} name={m.displayName || "User"} size="xs" className="ring-2 ring-card" />
                      </div>
                    ))}
                    <p className="text-[10px] text-muted-foreground ml-2 truncate">
                      {mutuals.slice(0, 2).map(m => m.displayName || m.username).join(", ")}
                      {mutuals.length > 2 ? ` +${mutuals.length - 2} more` : ""}
                    </p>
                  </div>
                </div>
              )}

              {/* Badges preview */}
              {badges.length > 0 && (
                <div className="flex gap-2 flex-wrap mb-3">
                  {badges.slice(0, 6).map((b: { id: number; icon: string; name: string; rarity: string }, i: number) => (
                    <div key={i} title={b.name}>
                      {isImageUrl(b.icon)
                        ? <img src={b.icon} alt={b.name} className="w-8 h-8 rounded-xl object-cover ring-1 ring-amber-400/50 shadow-sm" />
                        : <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-lg ring-1 ring-amber-400/50">{b.icon}</div>
                      }
                    </div>
                  ))}
                  {badges.length > 6 && <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-[10px] font-black text-muted-foreground">+{badges.length - 6}</div>}
                </div>
              )}

              {/* Action row */}
              {!isMe && (
                <div className="flex gap-2 border-t border-border/40 pt-3">
                  <button
                    onClick={() => { navigate(`/profile/${userId}`); onClose(); }}
                    className="flex-1 py-1.5 rounded-xl bg-muted text-xs font-bold text-foreground hover:bg-muted/70 transition-colors"
                  >
                    View Profile
                  </button>
                  {showBlockConfirm ? (
                    <div className="flex gap-1">
                      <button onClick={() => setShowBlockConfirm(false)} className="px-2 py-1.5 rounded-xl bg-muted text-xs font-bold text-muted-foreground">
                        Cancel
                      </button>
                      <button onClick={handleBlock} disabled={actionPending}
                        className="px-2 py-1.5 rounded-xl bg-destructive/10 text-destructive text-xs font-bold hover:bg-destructive/20 transition-colors">
                        {actionPending ? "…" : profile?.isBlocked ? "Unblock" : "Confirm Block"}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowBlockConfirm(true)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors",
                        profile?.isBlocked
                          ? "bg-green-500/10 text-green-600 hover:bg-green-500/20"
                          : "bg-muted text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      )}
                      title={profile?.isBlocked ? "Unblock user" : "Block user"}
                    >
                      {profile?.isBlocked ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />}
                      {profile?.isBlocked ? "Unblock" : "Block"}
                    </button>
                  )}
                </div>
              )}

              <p className="text-[9px] font-mono text-muted-foreground/40 mt-3 truncate">ID: {profile?.id ?? userId}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
