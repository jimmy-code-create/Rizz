import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { useState, useEffect, useRef } from "react";
import { usePushNotifications } from "@/hooks/use-push";
import { usePresenceHeartbeat } from "@/hooks/use-presence";

import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import FeedPage from "@/pages/feed";
import ProfilePage from "@/pages/profile";
import SearchPage from "@/pages/search";
import NotificationsPage from "@/pages/notifications";
import BadgesPage from "@/pages/badges";
import DMsPage from "@/pages/dms";
import ServersPage from "@/pages/servers";
import SettingsPage from "@/pages/settings";
import OnboardingPage from "@/pages/onboarding";
import AdminPage from "@/pages/admin";
import JimmyPage from "@/pages/jimmy";
import BookmarksPage from "@/pages/bookmarks";
import ReelsPage from "@/pages/reels";
import FollowingPage from "@/pages/following";
import PostDetailPage from "@/pages/post-detail";
import HashtagPage from "@/pages/hashtag";
import LeaderboardPage from "@/pages/leaderboard";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const explicitlyCompleted = useRef(false);

  const lsKey = user ? `rizz_ob_${user.id}` : null;

  const { data: profile } = useQuery({
    queryKey: ["/api/users/me"],
    queryFn: () => fetch("/api/users/me", { credentials: "include" }).then(r => r.ok ? r.json() : null) as Promise<{ onboardingCompleted?: boolean } | null>,
    enabled: !!user,
  });

  useEffect(() => {
    if (explicitlyCompleted.current) return;
    if (!user) { setOnboardingDone(true); return; }
    // localStorage fast-path: once a user completed onboarding, never ask again
    if (lsKey && localStorage.getItem(lsKey) === "1") {
      explicitlyCompleted.current = true;
      setOnboardingDone(true);
      return;
    }
    if (profile === undefined) return;
    if (profile === null) { setOnboardingDone(false); return; }
    if (profile.onboardingCompleted) {
      // Persist to localStorage so refreshes are instant
      if (lsKey) localStorage.setItem(lsKey, "1");
      setOnboardingDone(true);
    } else {
      setOnboardingDone(false);
    }
  }, [user, profile, lsKey]);

  const handleComplete = () => {
    explicitlyCompleted.current = true;
    if (lsKey) localStorage.setItem(lsKey, "1");
    setOnboardingDone(true);
  };

  if (onboardingDone === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!onboardingDone) {
    return <OnboardingPage onComplete={handleComplete} />;
  }

  return <>{children}</>;
}

function AppInit() {
  usePushNotifications();
  usePresenceHeartbeat();
  return null;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <OnboardingGate>
      {children}
    </OnboardingGate>
  );
}

function Router() {
  return (
    <AuthGate>
      <Switch>
        <Route path="/" component={FeedPage} />
        <Route path="/search" component={SearchPage} />
        <Route path="/notifications" component={NotificationsPage} />
        <Route path="/badges" component={BadgesPage} />
        <Route path="/dms" component={DMsPage} />
        <Route path="/servers" component={ServersPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/admin" component={AdminPage} />
        <Route path="/jimmy" component={JimmyPage} />
        <Route path="/bookmarks" component={BookmarksPage} />
        <Route path="/reels" component={ReelsPage} />
        <Route path="/following/:id" component={FollowingPage} />
        <Route path="/following" component={FollowingPage} />
        <Route path="/profile/me" component={() => <ProfilePage />} />
        <Route path="/profile/:id" component={ProfilePage} />
        <Route path="/post/:id" component={PostDetailPage} />
        <Route path="/hashtag/:tag" component={HashtagPage} />
        <Route path="/leaderboard" component={LeaderboardPage} />
        <Route component={NotFound} />
      </Switch>
    </AuthGate>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AppInit />
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
