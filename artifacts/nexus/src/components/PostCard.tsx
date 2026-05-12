import { useState, useRef, useCallback } from "react";
import { Heart, MessageCircle, Bookmark, Share2, MoreHorizontal, Trash2, Smile, Flag, Tag, Copy, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { EmojiPicker } from "@/components/EmojiPicker";
import { cn, formatRelativeTime, renderWithEmojisAndTags } from "@/lib/utils";
import { useLikePost, useUnlikePost, useSavePost, useUnsavePost, useDeletePost, useGetPostComments, useCreateComment } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { Post } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { useSound } from "@/hooks/use-sound";

interface PostCardProps {
  post: Post;
  onDeleted?: () => void;
  onTagClick?: (tag: string) => void;
}

const QUICK_REACTIONS = ["❤️", "🔥", "😂", "🥰", "👑", "💯", "✨", "🤩"];

export function PostCard({ post, onDeleted, onTagClick }: PostCardProps) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [showCommentEmoji, setShowCommentEmoji] = useState(false);
  const [localLiked, setLocalLiked] = useState<boolean | null>(null);
  const [localLikeCount, setLocalLikeCount] = useState<number | null>(null);
  const [heartBurst, setHeartBurst] = useState(false);
  const [copied, setCopied] = useState(false);
  const lastTapRef = useRef(0);
  const commentRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { playLike, playUnlike, playComment, playSave, playClick } = useSound();

  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportSent, setReportSent] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["/api/feed"] });
    qc.invalidateQueries({ queryKey: [`/api/posts/${post.id}`] });
    qc.invalidateQueries({ queryKey: ["/api/posts"] });
    if (post.author?.id) qc.invalidateQueries({ queryKey: [`/api/users/${post.author.id}/posts`] });
  };

  const { mutate: like }    = useLikePost({ mutation: { onSuccess: invalidate } });
  const { mutate: unlike }  = useUnlikePost({ mutation: { onSuccess: invalidate } });
  const { mutate: save }    = useSavePost({ mutation: { onSuccess: invalidate } });
  const { mutate: unsave }  = useUnsavePost({ mutation: { onSuccess: invalidate } });
  const { mutate: deletePost } = useDeletePost({ mutation: { onSuccess: () => { invalidate(); onDeleted?.(); } } });
  const { mutate: addComment, isPending: commenting } = useCreateComment({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: [`/api/posts/${post.id}/comments`] });
        setCommentText("");
        playComment();
      },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: comments } = useGetPostComments(post.id, { query: { enabled: showComments } as any });

  const isOwner    = user?.id === post.author?.id;
  const liked      = localLiked !== null ? localLiked : (post.isLiked ?? false);
  const likeCount  = localLikeCount !== null ? localLikeCount : (post.likeCount ?? 0);
  const saved      = post.isSaved ?? false;

  const handleLike = useCallback(() => {
    const wasLiked = liked;
    setLocalLiked(!wasLiked);
    setLocalLikeCount(likeCount + (wasLiked ? -1 : 1));
    if (wasLiked) {
      unlike({ postId: post.id });
      playUnlike();
    } else {
      like({ postId: post.id });
      playLike();
      setHeartBurst(true);
      setTimeout(() => setHeartBurst(false), 650);
    }
  }, [liked, likeCount, like, unlike, playLike, playUnlike, post.id]);

  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 350) {
      if (!liked) handleLike();
    }
    lastTapRef.current = now;
  }, [liked, handleLike]);

  const handleSave = () => {
    if (saved) unsave({ postId: post.id });
    else { save({ postId: post.id }); playSave(); }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/posts/${post.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: "Check this post on Rizz", url }); } catch { /* dismissed */ }
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
    playClick();
  };

  const insertCommentEmoji = (emoji: string) => {
    const el = commentRef.current;
    if (!el) { setCommentText((c) => c + emoji); setShowCommentEmoji(false); return; }
    const start = el.selectionStart ?? commentText.length;
    const end   = el.selectionEnd   ?? commentText.length;
    const next  = commentText.slice(0, start) + emoji + commentText.slice(end);
    setCommentText(next);
    setShowCommentEmoji(false);
    setTimeout(() => { el.focus(); el.setSelectionRange(start + emoji.length, start + emoji.length); }, 0);
  };

  const handleTagClick = (tag: string) => {
    if (onTagClick) onTagClick(tag);
    else navigate(`/hashtag/${encodeURIComponent(tag)}`);
  };

  return (
    <>
    <article className="rizz-card rizz-card-fancy slide-up overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 pb-3">
        <Link href={`/profile/${post.author?.id}`}>
          <a className="relative">
            <Avatar
              src={post.author?.avatarUrl}
              name={post.author?.displayName || post.author?.username || "User"}
              size="md"
            />
          </a>
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link href={`/profile/${post.author?.id}`}>
              <a className="font-black text-foreground hover:text-primary transition-colors text-sm">
                {post.author?.displayName || post.author?.username}
              </a>
            </Link>
            {post.author?.isVerified && (
              <VerifiedBadge size="sm" />
            )}
            {(post.author as (typeof post.author & { topBadge?: { icon: string; name: string; rarity: string } | null }))?.topBadge && (() => {
              const tb = (post.author as (typeof post.author & { topBadge?: { icon: string; name: string; rarity: string } | null }))?.topBadge!;
              const isImg = tb.icon.startsWith("/") || tb.icon.startsWith("http");
              return isImg ? (
                <img src={tb.icon} alt={tb.name} title={tb.name} className="w-5 h-5 rounded-md object-cover flex-shrink-0 shadow-sm" />
              ) : (
                <span className="text-sm leading-none flex-shrink-0" title={tb.name}>{tb.icon}</span>
              );
            })()}
          </div>
          <p className="text-[11px] text-muted-foreground">
            @{post.author?.username}
            <span className="mx-1 opacity-40">·</span>
            {formatRelativeTime(post.createdAt)}
          </p>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 hover:bg-muted/80 rounded-xl text-muted-foreground hover:text-foreground transition-all hover:scale-110 active:scale-95"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {showMenu && (
            <div
              className="absolute right-0 top-9 bg-popover border border-popover-border rounded-2xl shadow-2xl z-20 py-1.5 w-48 fade-in overflow-hidden"
              onClick={() => setShowMenu(false)}
            >
              {isOwner && (
                <button
                  onClick={() => deletePost({ postId: post.id })}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-destructive hover:bg-destructive/8 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete post
                </button>
              )}
              <button
                onClick={handleShare}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" /> {copied ? "Copied!" : "Share post"}
              </button>
              <button
                onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/posts/${post.id}`); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
              >
                <Copy className="w-3.5 h-3.5" /> Copy link
              </button>
              {!isOwner && (
                <button
                  onClick={() => { setShowReport(true); setReportSent(false); setReportReason(""); }}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-amber-600 hover:bg-amber-500/8 transition-colors"
                >
                  <Flag className="w-3.5 h-3.5" /> Report post
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Text content */}
      {post.content && (
        <div className="px-4 pb-3">
          <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
            {renderWithEmojisAndTags(post.content, handleTagClick)}
          </p>
        </div>
      )}

      {/* Media — image or video */}
      {post.mediaUrl && (() => {
        const url = post.mediaUrl;
        const isVid = url.startsWith("data:video/") || url.startsWith("[video]") ||
          /\.(mp4|webm|ogg|mov|avi)(\?|$)/i.test(url);
        const src = url.startsWith("[video]") ? url.replace("[video]", "") : url;
        return (
          <div className="relative cursor-pointer select-none group" onClick={!isVid ? handleDoubleTap : undefined}>
            {isVid ? (
              <video
                src={src}
                className="w-full max-h-[560px] object-cover bg-black"
                controls
                playsInline
                preload="metadata"
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <img
                src={src}
                alt=""
                className="w-full max-h-[560px] object-cover transition-all duration-300 group-hover:brightness-[0.96]"
                loading="lazy"
              />
            )}
            <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
            {heartBurst && !isVid && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative">
                  <Heart className="w-24 h-24 text-red-400 fill-red-400 heart-burst drop-shadow-2xl" />
                  <div className="absolute inset-0 blur-2xl bg-red-400/40 rounded-full scale-150" />
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="px-4 pt-3 pb-1 flex flex-wrap gap-1.5">
          {post.tags.map((tag) => (
            <button key={tag} onClick={() => handleTagClick(tag)} className="tag-pill">
              <Tag className="w-2.5 h-2.5 opacity-70" />#{tag}
            </button>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-0.5 px-3 py-2.5 border-t border-border/30 mt-1">
        {/* Like */}
        <button
          onClick={handleLike}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 rounded-2xl text-sm font-bold transition-all",
            "active:scale-90",
            liked
              ? "text-red-500 bg-red-500/10"
              : "text-muted-foreground hover:text-red-500 hover:bg-red-500/8"
          )}
        >
          <Heart className={cn("w-4 h-4 transition-all duration-200", liked && "fill-current scale-110")} />
          <span className="font-black tabular-nums">{likeCount}</span>
        </button>

        {/* Comment */}
        <button
          onClick={() => { setShowComments(!showComments); playClick(); setTimeout(() => commentRef.current?.focus(), 100); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-sm font-bold text-muted-foreground hover:text-primary hover:bg-primary/8 transition-all"
        >
          <MessageCircle className="w-4 h-4" />
          <span className="font-black tabular-nums">{post.commentCount ?? 0}</span>
        </button>

        {/* Quick reactions */}
        <div className="relative">
          <button
            onClick={() => { setShowReactions(!showReactions); playClick(); }}
            className={cn(
              "p-2 rounded-2xl transition-all",
              showReactions
                ? "text-primary bg-primary/10 scale-110"
                : "text-muted-foreground hover:text-primary hover:bg-primary/8"
            )}
          >
            <Smile className="w-4 h-4" />
          </button>
          {showReactions && (
            <div className="absolute bottom-full mb-2 left-0 bg-popover border border-popover-border rounded-2xl shadow-2xl p-2 flex gap-1 z-20 pop-in">
              {QUICK_REACTIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    addComment({ postId: post.id, data: { content: r } });
                    setShowReactions(false);
                    playComment();
                  }}
                  className="w-9 h-9 text-lg flex items-center justify-center rounded-xl hover:bg-muted hover:scale-125 transition-all active:scale-90"
                >
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Share */}
        <button
          onClick={handleShare}
          className="p-2 rounded-2xl text-muted-foreground hover:text-primary hover:bg-primary/8 transition-all"
          title={copied ? "Copied!" : "Share"}
        >
          {copied
            ? <span className="text-xs font-black text-green-500">✓</span>
            : <Share2 className="w-4 h-4" />}
        </button>

        <div className="flex-1" />

        {/* View full post */}
        <Link href={`/post/${post.id}`}>
          <a className="p-2 rounded-2xl text-muted-foreground hover:text-primary hover:bg-primary/8 transition-all" title="View post">
            <MessageCircle className="w-4 h-4" />
          </a>
        </Link>

        {/* Save */}
        <button
          onClick={handleSave}
          className={cn(
            "p-2 rounded-2xl transition-all active:scale-90",
            saved
              ? "text-primary bg-primary/10 scale-105"
              : "text-muted-foreground hover:text-primary hover:bg-primary/8"
          )}
        >
          <Bookmark className={cn("w-4 h-4 transition-all duration-200", saved && "fill-current")} />
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="border-t border-border/30 px-4 pb-4 pt-3 space-y-3 fade-in">
          {/* Input */}
          <div className="flex gap-2.5">
            <Avatar src={user?.profileImageUrl} name={user?.firstName || "Me"} size="sm" />
            <div className="flex-1 flex items-center gap-2 bg-muted/60 rounded-2xl px-3 py-2.5 border border-border/40 focus-within:border-primary/40 focus-within:bg-background/60 transition-all input-premium">
              <input
                ref={commentRef}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && commentText.trim()) {
                    e.preventDefault();
                    addComment({ postId: post.id, data: { content: commentText.trim() } });
                  }
                }}
                placeholder="Add a comment…"
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <div className="relative flex-shrink-0">
                <button onClick={() => setShowCommentEmoji(!showCommentEmoji)} className="text-muted-foreground hover:text-primary transition-colors p-0.5">
                  <Smile className="w-4 h-4" />
                </button>
                {showCommentEmoji && (
                  <EmojiPicker onSelect={insertCommentEmoji} onClose={() => setShowCommentEmoji(false)} position="top" />
                )}
              </div>
              <button
                onClick={() => { if (commentText.trim()) addComment({ postId: post.id, data: { content: commentText.trim() } }); }}
                disabled={!commentText.trim() || commenting}
                className="text-xs font-black text-primary disabled:text-muted-foreground transition-all hover:opacity-75 flex-shrink-0"
              >
                Post
              </button>
            </div>
          </div>

          {/* Comment list */}
          {comments?.comments?.map((comment) => (
            <div key={comment.id} className="flex gap-2.5 slide-up">
              <Avatar src={comment.author?.avatarUrl} name={comment.author?.displayName || "User"} size="sm" />
              <div className="flex-1 bg-muted/50 rounded-2xl px-3.5 py-2.5 border border-border/20">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-xs font-black text-foreground">{comment.author?.displayName || comment.author?.username}</p>
                  <p className="text-[10px] text-muted-foreground">{formatRelativeTime(comment.createdAt)}</p>
                </div>
                <p className="text-sm text-foreground leading-snug">{renderWithEmojisAndTags(comment.content ?? "", handleTagClick)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </article>

    {/* Report dialog */}
    {showReport && (
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" onClick={() => setShowReport(false)}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div className="relative bg-card border border-card-border rounded-3xl shadow-2xl w-full max-w-sm p-5 pop-in" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-foreground text-base">Report post</h3>
            <button onClick={() => setShowReport(false)} className="p-1.5 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          {reportSent ? (
            <div className="text-center py-4">
              <p className="text-3xl mb-2">✅</p>
              <p className="font-black text-foreground text-sm">Report submitted</p>
              <p className="text-xs text-muted-foreground mt-1">Thank you. We'll review this post.</p>
              <button onClick={() => setShowReport(false)} className="mt-4 px-5 py-2 btn-primary text-primary-foreground rounded-2xl text-sm font-black">Done</button>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-3">Why are you reporting this post?</p>
              <div className="space-y-1.5 mb-4">
                {["Spam or misleading", "Hate speech or harassment", "Violence or dangerous content", "Nudity or sexual content", "Intellectual property violation", "Other"].map((reason) => (
                  <button
                    key={reason}
                    onClick={() => setReportReason(reason)}
                    className={cn(
                      "w-full text-left px-4 py-2.5 rounded-2xl text-sm transition-all border",
                      reportReason === reason
                        ? "border-primary bg-primary/8 text-foreground font-semibold"
                        : "border-border bg-muted/40 text-foreground hover:border-primary/40 hover:bg-muted"
                    )}
                  >
                    {reason}
                  </button>
                ))}
              </div>
              <button
                disabled={!reportReason}
                onClick={async () => {
                  if (!reportReason) return;
                  try {
                    await fetch(`/api/posts/${post.id}/report`, {
                      method: "POST",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ reason: reportReason }),
                    });
                  } catch { /* silently fail */ }
                  setReportSent(true);
                }}
                className={cn(
                  "w-full py-3 rounded-2xl text-sm font-black transition-all",
                  reportReason ? "bg-amber-500 text-white hover:bg-amber-600" : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                Submit Report
              </button>
            </>
          )}
        </div>
      </div>
    )}
  </>
  );
}

