import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Avatar } from "@/components/Avatar";
import { cn } from "@/lib/utils";
import { useTheme, THEME_COLORS } from "@/contexts/ThemeContext";
import {
  Home,
  Search,
  Bell,
  MessageCircle,
  Server,
  Award,
  LogOut,
  User,
  Plus,
  Settings,
  Sun,
  Moon,
  Monitor,
  Zap,
  Sparkles,
  Volume2,
  VolumeX,
  Crown,
  Menu,
  X,
  ChevronRight,
  BellOff,
  Smile,
  Lock,
  Eye,
  EyeOff,
  Bookmark,
  Bot,
  Film,
  Trophy,
  Phone,
  PhoneOff,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { CreatePostModal } from "@/components/CreatePostModal";
import { CallModal } from "@/components/CallModal";
import { useSound, setSoundEnabled } from "@/hooks/use-sound";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtime } from "@/hooks/use-realtime";
import { useToast } from "@/hooks/use-toast";

const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/search", icon: Search, label: "Explore" },
  { href: "/notifications", icon: Bell, label: "Alerts" },
  { href: "/dms", icon: MessageCircle, label: "Messages" },
  { href: "/servers", icon: Server, label: "Servers" },
  { href: "/leaderboard", icon: Trophy, label: "Leaderboard" },
  { href: "/badges", icon: Award, label: "Badges" },
  { href: "/bookmarks", icon: Bookmark, label: "Saved" },
];

const mobileNav = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/search", icon: Search, label: "Explore" },
  { href: "/dms", icon: MessageCircle, label: "DMs" },
  { href: "/profile/me", icon: User, label: "Profile" },
];

const STATUS_PRESETS = [
  { icon: "●", color: "#22c55e", label: "Active" },
  { icon: "☽", color: "#818cf8", label: "Sleeping" },
  { icon: "◈", color: "#06b6d4", label: "Gaming" },
  { icon: "♪", color: "#f43f5e", label: "Vibing" },
  { icon: "▣", color: "#f59e0b", label: "Studying" },
  { icon: "▶", color: "#a855f7", label: "Watching" },
  { icon: "⚡", color: "#10b981", label: "Working out" },
  { icon: "⊘", color: "#ef4444", label: "Busy" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showTheme, setShowTheme] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { mode, color, setMode, setColor, soundEnabled, setSoundEnabled: setSound, vibeMode, setVibeMode, resolvedMode } = useTheme();
  const { playClick, playNotification } = useSound();
  const qc = useQueryClient();

  // ── Owner panel 7-tap unlock ──────────────────────────────────────────
  const [ownerTapCount, setOwnerTapCount] = useState(0);
  const ownerTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showOwnerLogin, setShowOwnerLogin] = useState(false);
  const [ownerUser, setOwnerUser] = useState("");
  const [ownerPass, setOwnerPass] = useState("");
  const [ownerPassVisible, setOwnerPassVisible] = useState(false);
  const [ownerErr, setOwnerErr] = useState("");
  const [ownerPending, setOwnerPending] = useState(false);

  // ── Custom status + DND ───────────────────────────────────────────────
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [statusInput, setStatusInput] = useState("");
  const [statusPending, setStatusPending] = useState(false);
  const [dndLocal, setDndLocal] = useState(false);

  const { data: adminCheck } = useQuery({
    queryKey: ["/api/admin/check"],
    queryFn: () => fetch("/api/admin/check", { credentials: "include" }).then(r => r.json()) as Promise<{ isAdmin: boolean }>,
    staleTime: 60_000,
  });

  const { data: meData } = useQuery({
    queryKey: ["/api/users/me"],
    queryFn: () => fetch("/api/users/me", { credentials: "include" }).then(r => r.json()) as Promise<{ customStatus?: string | null; dnd?: boolean }>,
    staleTime: 30_000,
  });

  const handleSoundToggle = () => {
    const next = !soundEnabled;
    setSound(next);
    setSoundEnabled(next);
    if (next) playNotification();
  };

  const ownerTapHandler = () => {
    if (ownerTapTimer.current) clearTimeout(ownerTapTimer.current);
    const next = ownerTapCount + 1;
    if (next >= 7) {
      setOwnerTapCount(0);
      setOwnerUser("");
      setOwnerPass("");
      setOwnerErr("");
      setShowOwnerLogin(true);
      return;
    }
    setOwnerTapCount(next);
    ownerTapTimer.current = setTimeout(() => setOwnerTapCount(0), 3000);
  };

  const handleOwnerLogin = async () => {
    if (!ownerUser.trim() || !ownerPass.trim()) return;
    setOwnerPending(true);
    setOwnerErr("");
    try {
      const res = await fetch("/api/admin/owner-login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: ownerUser, password: ownerPass }),
      });
      if (res.ok) {
        setShowOwnerLogin(false);
        qc.invalidateQueries({ queryKey: ["/api/admin/check"] });
        setDrawerOpen(false);
        setLocation("/admin");
      } else {
        const data = await res.json();
        setOwnerErr(data.error ?? "Invalid credentials");
      }
    } catch {
      setOwnerErr("Network error. Try again.");
    } finally {
      setOwnerPending(false);
    }
  };

  const handleSetStatus = async (text: string, dnd: boolean) => {
    setStatusPending(true);
    try {
      await fetch("/api/users/me/status", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: text || null, dnd }),
      });
      setDndLocal(dnd);
      qc.invalidateQueries({ queryKey: ["/api/users/me"] });
      setShowStatusPicker(false);
    } finally {
      setStatusPending(false);
    }
  };

  const customStatus = meData?.customStatus ?? null;
  const isDnd = meData?.dnd ?? dndLocal;

  const { toast } = useToast();
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const notifPrefKey = "rizz_notif_";

  type IncomingCallBannerState = {
    conversationId: number;
    callType: "voice" | "video";
    callerId: string;
    callerName: string;
    callerAvatar: string | null;
    offer: { sdp: string; type: RTCSdpType; callType: "voice" | "video" } | null;
    accepted: boolean;
  };
  const [incomingCall, setIncomingCall] = useState<IncomingCallBannerState | null>(null);

  const handleGlobalDecline = async () => {
    if (!incomingCall) return;
    await fetch(`/api/calls/offer/${incomingCall.conversationId}`, { method: "DELETE", credentials: "include" });
    setIncomingCall(null);
  };

  const handleGlobalAccept = async () => {
    if (!incomingCall) return;
    if (incomingCall.offer) {
      setIncomingCall(prev => prev ? { ...prev, accepted: true } : null);
      return;
    }
    const r = await fetch(`/api/calls/offer/${incomingCall.conversationId}`, { credentials: "include" });
    const { offer } = await r.json();
    setIncomingCall(prev => prev ? { ...prev, offer, accepted: true } : null);
  };

  useRealtime((event) => {
    if (event.type === "new_notification" || event.type === "new_like" || event.type === "new_comment" || event.type === "new_follow") {
      const notifEnabled = localStorage.getItem(
        event.type === "new_like" ? `${notifPrefKey}likes` :
        event.type === "new_comment" ? `${notifPrefKey}comments` :
        event.type === "new_follow" ? `${notifPrefKey}follows` : `${notifPrefKey}likes`
      );
      if (notifEnabled === "false") return;
      setUnreadNotifs((n) => n + 1);
      const msg = "message" in event ? event.message :
        event.type === "new_like" ? `${event.actorName} liked your post` :
        event.type === "new_comment" ? `${event.actorName} commented on your post` :
        `${event.actorName} followed you`;
      toast({ title: "🔔 New notification", description: msg });
      playNotification();
    } else if (event.type === "new_message" || event.type === "new_group_msg") {
      if (localStorage.getItem(`${notifPrefKey}messages`) === "false") return;
      setUnreadNotifs((n) => n + 1);
      toast({ title: "💬 New message", description: "You have a new direct message" });
      playNotification();
    } else if (event.type === "incoming_call" && !location.startsWith("/dms")) {
      setIncomingCall({
        conversationId: event.conversationId,
        callType: event.callType,
        callerId: event.callerId,
        callerName: event.callerName,
        callerAvatar: event.callerAvatar,
        offer: null,
        accepted: false,
      });
      playNotification();
      fetch(`/api/calls/offer/${event.conversationId}`, { credentials: "include" })
        .then(r => r.json())
        .then(({ offer }) => {
          if (offer) setIncomingCall(prev => prev ? { ...prev, offer } : null);
        })
        .catch(() => {});
    } else if (event.type === "call_declined") {
      setIncomingCall(null);
    }
  });

  useEffect(() => {
    if (location.startsWith("/notifications")) setUnreadNotifs(0);
  }, [location]);

  return (
    <div className="flex h-screen bg-background overflow-hidden relative">
      {/* Global incoming call modal (when not on /dms) */}
      {incomingCall && incomingCall.accepted && incomingCall.offer && (
        <CallModal
          conversationId={incomingCall.conversationId}
          otherUser={{ id: incomingCall.callerId, displayName: incomingCall.callerName, avatarUrl: incomingCall.callerAvatar }}
          callType={incomingCall.callType}
          mode="callee"
          incomingOffer={{ sdp: incomingCall.offer.sdp, type: incomingCall.offer.type as RTCSdpType, callerName: incomingCall.callerName, callType: incomingCall.callType }}
          onClose={() => setIncomingCall(null)}
        />
      )}
      {/* Incoming call banner (before accepted / while loading offer) */}
      {incomingCall && !(incomingCall.accepted && incomingCall.offer) && (
        <div className="fixed bottom-6 right-4 z-[200] w-80 pop-in">
          <div className="bg-card border border-card-border rounded-2xl shadow-2xl overflow-hidden"
            style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06)" }}>
            {/* Gradient bar */}
            <div className="h-1 w-full bg-gradient-to-r from-primary to-purple-500" />
            <div className="p-4 flex items-center gap-3">
              <div className="relative flex-shrink-0">
                <Avatar src={incomingCall.callerAvatar} name={incomingCall.callerName} size="md" />
                <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-500 ring-2 ring-card flex items-center justify-center">
                  {incomingCall.callType === "video" ? "📹" : "📞"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate text-foreground">{incomingCall.callerName}</p>
                <p className="text-xs text-muted-foreground animate-pulse">
                  {incomingCall.callType === "video" ? "Incoming video call…" : "Incoming voice call…"}
                </p>
              </div>
            </div>
            <div className="flex border-t border-border/50">
              <button
                onClick={handleGlobalDecline}
                className="flex-1 py-3 flex items-center justify-center gap-2 text-red-500 hover:bg-red-500/10 transition-colors font-semibold text-sm"
              >
                <PhoneOff className="w-4 h-4" />
                Decline
              </button>
              <div className="w-px bg-border/50" />
              <button
                onClick={handleGlobalAccept}
                disabled={incomingCall.accepted}
                className="flex-1 py-3 flex items-center justify-center gap-2 text-green-500 hover:bg-green-500/10 transition-colors font-semibold text-sm disabled:opacity-60"
              >
                <Phone className="w-4 h-4" />
                {incomingCall.accepted ? "Connecting…" : "Accept"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Animated background orbs — only when Vibe Mode is on */}
      {vibeMode && (
        <div className="rizz-bg" aria-hidden>
          <div className="rizz-orb rizz-orb-1" />
          <div className="rizz-orb rizz-orb-2" />
          <div className="rizz-orb rizz-orb-3" />
        </div>
      )}

      {/* ── MOBILE DRAWER BACKDROP ──────────────────────────────── */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── MOBILE SLIDE-IN DRAWER ──────────────────────────────── */}
      <aside
        className={cn(
          "md:hidden fixed top-0 left-0 h-full w-72 z-50 glass-sidebar flex flex-col transition-transform duration-300 ease-out",
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Drawer header */}
        <div className="px-5 py-5 border-b border-sidebar-border/60 flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-2xl btn-primary flex items-center justify-center flex-shrink-0 cursor-pointer select-none"
            onClick={ownerTapHandler}
          >
            <Zap className="w-4.5 h-4.5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <h1
            className="text-2xl font-black rizz-gradient tracking-tight cursor-pointer select-none"
            onClick={ownerTapHandler}
          >
            Rizz
          </h1>
          {ownerTapCount >= 3 && (
            <span className="text-[9px] text-muted-foreground/50 ml-0.5">{7 - ownerTapCount} more…</span>
          )}
          <div className="flex-1" />
          <button
            onClick={() => setDrawerOpen(false)}
            className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer user card */}
        <div className="px-4 py-3 border-b border-sidebar-border/40">
          <Link href="/profile/me">
            <a className="flex items-center gap-3" onClick={() => setDrawerOpen(false)}>
              <div className="relative">
                <Avatar src={user?.profileImageUrl} name={user?.firstName || "Me"} size="md" />
                {isDnd && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 border-2 border-background flex items-center justify-center">
                    <BellOff className="w-2 h-2 text-white" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-sidebar-foreground truncate">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                  {customStatus ? (
                    <span className="truncate">{customStatus}</span>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block flex-shrink-0" />
                      Active now
                    </>
                  )}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </a>
          </Link>
          {/* Status picker toggle */}
          <button
            onClick={() => setShowStatusPicker(!showStatusPicker)}
            className="mt-2 w-full text-[10px] text-muted-foreground hover:text-primary transition-colors text-left flex items-center gap-1 px-0.5"
          >
            <Smile className="w-3 h-3" />
            {customStatus ? "Change status" : "Set a status"}
          </button>
          {showStatusPicker && (
            <div className="mt-2 bg-card border border-card-border rounded-2xl p-3 space-y-2 shadow-lg">
              <div className="flex flex-wrap gap-1.5">
                {STATUS_PRESETS.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => { setStatusInput(`${s.icon} ${s.label}`); }}
                    className="text-[10px] px-2 py-1 bg-muted rounded-full hover:bg-primary/10 hover:text-primary transition-all font-semibold flex items-center gap-1"
                  >
                    <span style={{ color: s.color, fontSize: "11px" }}>{s.icon}</span>
                    {s.label}
                  </button>
                ))}
              </div>
              <input
                value={statusInput}
                onChange={(e) => setStatusInput(e.target.value)}
                placeholder="Custom status…"
                maxLength={80}
                className="w-full bg-muted rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setDndLocal(!isDnd); handleSetStatus(statusInput, !isDnd); }}
                  className={cn("flex items-center gap-1 text-[10px] px-2 py-1 rounded-full font-bold transition-all",
                    isDnd ? "bg-red-500/20 text-red-500" : "bg-muted text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                  )}
                >
                  <BellOff className="w-2.5 h-2.5" />
                  {isDnd ? "DND On" : "Set DND"}
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => handleSetStatus("", false)}
                  className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                >
                  Clear
                </button>
                <button
                  onClick={() => handleSetStatus(statusInput, isDnd)}
                  disabled={statusPending}
                  className="text-[10px] px-3 py-1.5 bg-primary text-primary-foreground rounded-xl font-bold disabled:opacity-50"
                >
                  {statusPending ? "…" : "Set"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Drawer nav */}
        <div className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, icon: Icon, label }) => {
            const active = href === "/" ? location === "/" : location.startsWith(href);
            return (
              <Link key={href} href={href}>
                <a
                  onClick={() => { setDrawerOpen(false); !active && playClick(); }}
                  className={cn(
                    "flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-semibold transition-all",
                    active ? "nav-active text-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/60"
                  )}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" strokeWidth={active ? 2.5 : 2} />
                  {label}
                </a>
              </Link>
            );
          })}

          <button
            onClick={() => { setShowCreatePost(true); setDrawerOpen(false); playClick(); }}
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-semibold transition-all w-full text-left text-sidebar-foreground hover:bg-sidebar-accent/60"
          >
            <Plus className="w-5 h-5 flex-shrink-0" />
            New Post
          </button>

          <Link href="/settings">
            <a
              onClick={() => { setDrawerOpen(false); playClick(); }}
              className={cn(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-semibold transition-all",
                location === "/settings" ? "nav-active text-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/60"
              )}
            >
              <Settings className="w-5 h-5 flex-shrink-0" />
              Settings
            </a>
          </Link>

          {adminCheck?.isAdmin && (
            <Link href="/admin">
              <a
                onClick={() => { setDrawerOpen(false); playClick(); }}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-semibold transition-all border border-amber-500/20",
                  location === "/admin" ? "bg-amber-500/20 text-amber-500" : "text-amber-500/80 hover:bg-amber-500/10 hover:text-amber-500"
                )}
              >
                <Crown className="w-5 h-5 flex-shrink-0" />
                Owner Panel
              </a>
            </Link>
          )}
        </div>

        {/* Drawer bottom options */}
        <div className="px-3 pb-4 pt-2 border-t border-sidebar-border/40 space-y-1">
          <button
            onClick={handleSoundToggle}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-2xl text-xs font-semibold text-muted-foreground hover:bg-sidebar-accent/60 transition-all"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            {soundEnabled ? "Sound on" : "Sound off"}
          </button>
          <button
            onClick={() => setVibeMode(!vibeMode)}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-2xl text-xs font-semibold transition-all",
              vibeMode ? "text-primary bg-primary/10" : "text-muted-foreground hover:bg-sidebar-accent/60"
            )}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Vibe Mode {vibeMode ? "On" : "Off"}
          </button>
          <button
            onClick={() => { logout(); setDrawerOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-2xl text-xs font-semibold text-destructive/70 hover:bg-destructive/10 hover:text-destructive transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            Log out
          </button>
        </div>
      </aside>

      {/* ── DESKTOP LEFT SIDEBAR ─────────────────────────────────── */}
      <nav className="hidden md:flex flex-col w-64 flex-shrink-0 relative z-10 glass-sidebar">
        <div className="px-5 py-5 border-b border-sidebar-border/60 flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-2xl btn-primary flex items-center justify-center flex-shrink-0 cursor-pointer select-none"
            onClick={ownerTapHandler}
            title={ownerTapCount > 0 ? `${7 - ownerTapCount} more taps…` : undefined}
          >
            <Zap className="w-4.5 h-4.5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <h1
            className="text-2xl font-black rizz-gradient tracking-tight cursor-pointer select-none"
            onClick={ownerTapHandler}
          >
            Rizz
          </h1>
          <div className="flex-1" />
          <button
            onClick={handleSoundToggle}
            className="p-1.5 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            title={soundEnabled ? "Mute sounds" : "Enable sounds"}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, icon: Icon, label }) => {
            const active = href === "/" ? location === "/" : location.startsWith(href);
            const isNotif = href === "/notifications";
            return (
              <Link key={href} href={href}>
                <a
                  onClick={() => { if (isNotif) setUnreadNotifs(0); !active && playClick(); }}
                  className={cn(
                    "flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-semibold transition-all duration-200",
                    active ? "nav-active text-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground hover:translate-x-0.5"
                  )}
                >
                  <div className="relative flex-shrink-0">
                    <Icon className={cn("w-5 h-5", active && "drop-shadow-sm")} strokeWidth={active ? 2.5 : 2} />
                    {isNotif && unreadNotifs > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center shadow-md">
                        {unreadNotifs > 9 ? "9+" : unreadNotifs}
                      </span>
                    )}
                  </div>
                  {label}
                  {isNotif && unreadNotifs > 0 && (
                    <span className="ml-auto px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-black rounded-full min-w-[18px] text-center">
                      {unreadNotifs > 9 ? "9+" : unreadNotifs}
                    </span>
                  )}
                </a>
              </Link>
            );
          })}

          <button
            onClick={() => { setShowCreatePost(true); playClick(); }}
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-semibold transition-all w-full text-left text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground hover:translate-x-0.5"
          >
            <Plus className="w-5 h-5 flex-shrink-0" />
            New Post
          </button>

          <Link href="/settings">
            <a
              onClick={() => playClick()}
              className={cn(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-semibold transition-all",
                location === "/settings" ? "nav-active text-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground hover:translate-x-0.5"
              )}
            >
              <Settings className="w-5 h-5 flex-shrink-0" strokeWidth={location === "/settings" ? 2.5 : 2} />
              Settings
            </a>
          </Link>

          {adminCheck?.isAdmin && (
            <Link href="/admin">
              <a
                onClick={() => playClick()}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-semibold transition-all border border-amber-500/20",
                  location === "/admin" ? "bg-amber-500/20 text-amber-500" : "text-amber-500/80 hover:bg-amber-500/10 hover:text-amber-500 hover:translate-x-0.5"
                )}
              >
                <Crown className="w-5 h-5 flex-shrink-0" />
                Owner Panel
              </a>
            </Link>
          )}
        </div>

        {/* Theme + Vibe switcher */}
        <div className="px-3 pb-2 space-y-1">
          <button
            onClick={() => setShowTheme(!showTheme)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-2xl text-xs font-semibold text-muted-foreground hover:bg-sidebar-accent/60 transition-all"
          >
            <div
              className="w-3.5 h-3.5 rounded-full flex-shrink-0 ring-1 ring-white/20"
              style={{ background: THEME_COLORS.find((c) => c.id === color)?.gradient ?? THEME_COLORS.find((c) => c.id === color)?.hue }}
            />
            <span className="flex-1 text-left">Theme</span>
            <span className="opacity-60 capitalize">{color}</span>
          </button>

          <button
            onClick={() => setVibeMode(!vibeMode)}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-2xl text-xs font-semibold transition-all",
              vibeMode ? "text-primary bg-primary/10" : "text-muted-foreground hover:bg-sidebar-accent/60"
            )}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">Vibe Mode</span>
            <span className="opacity-60">{vibeMode ? "On" : "Off"}</span>
          </button>

          {showTheme && (
            <div className="mt-1 bg-card border border-card-border rounded-2xl p-3.5 shadow-xl fade-in">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Mode</p>
              <div className="flex gap-1 mb-3">
                {(["light", "dark", "system"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => { setMode(m); playClick(); }}
                    className={cn(
                      "flex-1 flex flex-col items-center gap-1 py-1.5 rounded-xl text-[10px] font-bold transition-all",
                      mode === m ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-accent"
                    )}
                  >
                    {m === "light" ? <Sun className="w-3.5 h-3.5" /> : m === "dark" ? <Moon className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />}
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Color</p>
              <div className="grid grid-cols-5 gap-1.5">
                {THEME_COLORS.map((tc) => (
                  <button
                    key={tc.id}
                    onClick={() => { setColor(tc.id); playClick(); }}
                    title={tc.label}
                    className={cn(
                      "w-8 h-8 rounded-full transition-all hover:scale-110 active:scale-95",
                      color === tc.id ? "ring-2 ring-offset-2 ring-offset-card scale-110 shadow-md" : ""
                    )}
                    style={{ background: tc.gradient ?? tc.hue, outlineColor: tc.hue }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User footer */}
        <div className="px-3 py-3 border-t border-sidebar-border/60">
          <div className="flex items-center gap-3 px-3 py-2 rounded-2xl hover:bg-sidebar-accent/60 transition-colors">
            <Link href="/profile/me">
              <a className="flex items-center gap-3 flex-1 min-w-0">
                <div className="relative">
                  <Avatar src={user?.profileImageUrl} name={user?.firstName || user?.id || "Me"} size="sm" />
                  {isDnd && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-red-500 border-2 border-background flex items-center justify-center">
                      <BellOff className="w-1.5 h-1.5 text-white" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-sidebar-foreground truncate">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    {customStatus ? (
                      <span className="truncate text-[11px]">{customStatus}</span>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0 inline-block" />
                        Active now
                      </>
                    )}
                  </p>
                </div>
              </a>
            </Link>
            <button
              onClick={() => logout()}
              className="p-1.5 text-muted-foreground hover:text-destructive rounded-xl hover:bg-destructive/10 transition-colors flex-shrink-0"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* ── MAIN CONTENT ─────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto relative z-10 pb-20 md:pb-0">
        {/* Mobile top bar */}
        <div className="md:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 glass-sidebar border-b border-border/40">
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 rounded-xl text-foreground hover:bg-muted/60 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1 cursor-pointer select-none" onClick={ownerTapHandler}>
            <div className="w-6 h-6 rounded-xl btn-primary flex items-center justify-center">
              <Zap className="w-3 h-3 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <span className="font-black text-lg rizz-gradient tracking-tight">Rizz</span>
          </div>
          <Link href="/reels">
            <a className={cn("p-2 rounded-xl transition-colors", location.startsWith("/reels") ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
              <Film className="w-5 h-5" />
            </a>
          </Link>
          <Link href="/notifications">
            <a onClick={() => setUnreadNotifs(0)} className={cn("relative p-2 rounded-xl transition-colors", location.startsWith("/notifications") ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
              <Bell className="w-5 h-5" />
              {unreadNotifs > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center shadow-lg animate-bounce-once">
                  {unreadNotifs > 9 ? "9+" : unreadNotifs}
                </span>
              )}
            </a>
          </Link>
          <Link href="/profile/me">
            <a>
              <Avatar src={user?.profileImageUrl} name={user?.firstName || "Me"} size="sm" />
            </a>
          </Link>
        </div>

        {children}
      </main>

      {/* ── MOBILE BOTTOM NAV — 5-item with raised centre + ────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 glass-sidebar border-t border-border/40 safe-area-bottom">
        <div className="flex items-end justify-around px-2 h-16">
          {mobileNav.slice(0, 2).map(({ href, icon: Icon, label }) => {
            const active = href === "/" ? location === "/" : location.startsWith(href);
            return (
              <Link key={href} href={href}>
                <a
                  onClick={() => !active && playClick()}
                  className={cn(
                    "flex flex-col items-center gap-0.5 px-3 py-2.5 rounded-2xl transition-all",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
                  <span className="text-[9px] font-bold">{label}</span>
                </a>
              </Link>
            );
          })}

          <div className="flex flex-col items-center" style={{ marginBottom: "12px" }}>
            <button
              onClick={() => { setShowCreatePost(true); playClick(); }}
              className="w-14 h-14 rounded-2xl btn-primary flex items-center justify-center glow-primary-sm shadow-2xl hover:scale-105 active:scale-95 transition-all"
              aria-label="New Post"
            >
              <Plus className="w-7 h-7 text-primary-foreground" strokeWidth={2.5} />
            </button>
          </div>

          {mobileNav.slice(2).map(({ href, icon: Icon, label }) => {
            const active = href === "/" ? location === "/" : location.startsWith(href);
            return (
              <Link key={href} href={href}>
                <a
                  onClick={() => !active && playClick()}
                  className={cn(
                    "flex flex-col items-center gap-0.5 px-3 py-2.5 rounded-2xl transition-all",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
                  <span className="text-[9px] font-bold">{label}</span>
                </a>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── FLOATING JIMMY AI BUTTON ────────────────────────────── */}
      <Link href="/jimmy">
        <a
          className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-40 w-12 h-12 rounded-2xl btn-primary flex items-center justify-center glow-primary-sm shadow-2xl hover:scale-110 active:scale-95 transition-all"
          title="Chat with Jimmy AI"
          onClick={() => playClick()}
        >
          <Bot className="w-6 h-6 text-primary-foreground" strokeWidth={2} />
        </a>
      </Link>

      {showCreatePost && <CreatePostModal onClose={() => setShowCreatePost(false)} />}

      {/* ── OWNER PANEL LOGIN MODAL ──────────────────────────────── */}
      {showOwnerLogin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setShowOwnerLogin(false)} />
          <div className="relative w-full max-w-sm bg-card border border-card-border rounded-3xl shadow-2xl p-6 fade-in">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
                <Crown className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-black text-foreground">Owner Panel</h2>
                <p className="text-xs text-muted-foreground">Enter your credentials to continue</p>
              </div>
              <button onClick={() => setShowOwnerLogin(false)} className="ml-auto p-1.5 rounded-xl hover:bg-muted text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Username</label>
                <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2.5">
                  <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <input
                    type="text"
                    value={ownerUser}
                    onChange={(e) => setOwnerUser(e.target.value)}
                    placeholder="Enter username"
                    autoFocus
                    autoComplete="off"
                    onKeyDown={(e) => { if (e.key === "Enter") handleOwnerLogin(); }}
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Password</label>
                <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2.5">
                  <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <input
                    type={ownerPassVisible ? "text" : "password"}
                    value={ownerPass}
                    onChange={(e) => setOwnerPass(e.target.value)}
                    placeholder="Enter password"
                    autoComplete="current-password"
                    onKeyDown={(e) => { if (e.key === "Enter") handleOwnerLogin(); }}
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                  <button onClick={() => setOwnerPassVisible(!ownerPassVisible)} className="text-muted-foreground hover:text-foreground transition-colors">
                    {ownerPassVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {ownerErr && (
                <p className="text-xs text-destructive font-semibold bg-destructive/10 px-3 py-2 rounded-xl">{ownerErr}</p>
              )}

              <button
                onClick={handleOwnerLogin}
                disabled={ownerPending || !ownerUser.trim() || !ownerPass.trim()}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-black text-sm shadow-lg hover:opacity-90 active:scale-98 transition-all disabled:opacity-50 mt-2"
              >
                {ownerPending ? "Verifying…" : "Access Owner Panel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
