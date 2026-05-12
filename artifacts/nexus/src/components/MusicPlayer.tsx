import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  Music, X, ChevronUp, ChevronDown, Search, Play, Pause,
  SkipForward, SkipBack, Volume2, VolumeX, ExternalLink, Loader2, Shuffle
} from "lucide-react";

interface Track {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  genre: string;
  youtubeId: string;
}

const GENRES = ["All", "Pop", "Hip-Hop", "Lo-fi", "EDM", "R&B", "Rock", "Jazz", "Anime", "Gaming"];

const CURATED_TRACKS: Track[] = [
  { id: "1",  title: "Blinding Lights",       artist: "The Weeknd",               thumbnail: "https://img.youtube.com/vi/4NRXx6U8ekw/mqdefault.jpg", genre: "Pop",    youtubeId: "4NRXx6U8ekw" },
  { id: "2",  title: "As It Was",             artist: "Harry Styles",             thumbnail: "https://img.youtube.com/vi/H5v3kku4y6Q/mqdefault.jpg", genre: "Pop",    youtubeId: "H5v3kku4y6Q" },
  { id: "3",  title: "Flowers",               artist: "Miley Cyrus",              thumbnail: "https://img.youtube.com/vi/G7KNmW9a75Y/mqdefault.jpg", genre: "Pop",    youtubeId: "G7KNmW9a75Y" },
  { id: "4",  title: "Espresso",              artist: "Sabrina Carpenter",        thumbnail: "https://img.youtube.com/vi/eVli-tstM5E/mqdefault.jpg", genre: "Pop",    youtubeId: "eVli-tstM5E" },
  { id: "5",  title: "APT.",                  artist: "ROSÉ & Bruno Mars",        thumbnail: "https://img.youtube.com/vi/ekr2nIex040/mqdefault.jpg", genre: "Pop",    youtubeId: "ekr2nIex040" },
  { id: "6",  title: "Not Like Us",           artist: "Kendrick Lamar",           thumbnail: "https://img.youtube.com/vi/T6eK-2OreHY/mqdefault.jpg", genre: "Hip-Hop",youtubeId: "T6eK-2OreHY" },
  { id: "7",  title: "Luther",                artist: "Kendrick Lamar & SZA",     thumbnail: "https://img.youtube.com/vi/fefAgEpJm38/mqdefault.jpg", genre: "Hip-Hop",youtubeId: "fefAgEpJm38" },
  { id: "8",  title: "HUMBLE.",               artist: "Kendrick Lamar",           thumbnail: "https://img.youtube.com/vi/tvTRZJ-4EyI/mqdefault.jpg", genre: "Hip-Hop",youtubeId: "tvTRZJ-4EyI" },
  { id: "9",  title: "All Falls Down",        artist: "Alan Walker",              thumbnail: "https://img.youtube.com/vi/4DidpzRJSqg/mqdefault.jpg", genre: "EDM",    youtubeId: "4DidpzRJSqg" },
  { id: "10", title: "Faded",                 artist: "Alan Walker",              thumbnail: "https://img.youtube.com/vi/60ItHLz5WEA/mqdefault.jpg", genre: "EDM",    youtubeId: "60ItHLz5WEA" },
  { id: "11", title: "Levels",                artist: "Avicii",                   thumbnail: "https://img.youtube.com/vi/cDqgthveMmQ/mqdefault.jpg", genre: "EDM",    youtubeId: "cDqgthveMmQ" },
  { id: "12", title: "Lo-fi Hip Hop Radio",   artist: "Lofi Girl",                thumbnail: "https://img.youtube.com/vi/jfKfPfyJRdk/mqdefault.jpg", genre: "Lo-fi",  youtubeId: "jfKfPfyJRdk" },
  { id: "13", title: "Chill Lo-fi Beats",     artist: "ChilledCow",               thumbnail: "https://img.youtube.com/vi/5qap5aO4i9A/mqdefault.jpg", genre: "Lo-fi",  youtubeId: "5qap5aO4i9A" },
  { id: "14", title: "Snowfall",              artist: "Øneheart & reidenshi",     thumbnail: "https://img.youtube.com/vi/4GlBTdeTDGs/mqdefault.jpg", genre: "Lo-fi",  youtubeId: "4GlBTdeTDGs" },
  { id: "15", title: "Good Days",             artist: "SZA",                      thumbnail: "https://img.youtube.com/vi/lLnopOJoMlE/mqdefault.jpg", genre: "R&B",    youtubeId: "lLnopOJoMlE" },
  { id: "16", title: "Kill Bill",             artist: "SZA",                      thumbnail: "https://img.youtube.com/vi/qGmHDRSHCsU/mqdefault.jpg", genre: "R&B",    youtubeId: "qGmHDRSHCsU" },
  { id: "17", title: "Essence",               artist: "WizKid ft. Tems",          thumbnail: "https://img.youtube.com/vi/F4t5sNiGS6A/mqdefault.jpg", genre: "R&B",    youtubeId: "F4t5sNiGS6A" },
  { id: "18", title: "Enemy",                 artist: "Imagine Dragons × Arcane", thumbnail: "https://img.youtube.com/vi/D9G1VOjN_84/mqdefault.jpg", genre: "Gaming", youtubeId: "D9G1VOjN_84" },
  { id: "19", title: "Legends Never Die",     artist: "League of Legends",        thumbnail: "https://img.youtube.com/vi/iEwxABWOik4/mqdefault.jpg", genre: "Gaming", youtubeId: "iEwxABWOik4" },
  { id: "20", title: "Montero",               artist: "Lil Nas X",                thumbnail: "https://img.youtube.com/vi/6swmTBVI83k/mqdefault.jpg", genre: "Pop",    youtubeId: "6swmTBVI83k" },
  { id: "21", title: "Cruel Summer",          artist: "Taylor Swift",             thumbnail: "https://img.youtube.com/vi/ic8j13piAhQ/mqdefault.jpg", genre: "Pop",    youtubeId: "ic8j13piAhQ" },
  { id: "22", title: "STAY",                  artist: "Kid LAROI & Justin Bieber",thumbnail: "https://img.youtube.com/vi/kTJczUoc26U/mqdefault.jpg", genre: "Pop",    youtubeId: "kTJczUoc26U" },
  { id: "23", title: "Bohemian Rhapsody",     artist: "Queen",                    thumbnail: "https://img.youtube.com/vi/fJ9rUzIMcZQ/mqdefault.jpg", genre: "Rock",   youtubeId: "fJ9rUzIMcZQ" },
  { id: "24", title: "November Rain",         artist: "Guns N' Roses",            thumbnail: "https://img.youtube.com/vi/8SbUC-UaAxE/mqdefault.jpg", genre: "Rock",   youtubeId: "8SbUC-UaAxE" },
  { id: "25", title: "Fly Me to the Moon",    artist: "Frank Sinatra",            thumbnail: "https://img.youtube.com/vi/ZEcqHA7dbwM/mqdefault.jpg", genre: "Jazz",   youtubeId: "ZEcqHA7dbwM" },
  { id: "26", title: "Springtime",            artist: "Nujabes",                  thumbnail: "https://img.youtube.com/vi/7sTQ2LFbNkU/mqdefault.jpg", genre: "Jazz",   youtubeId: "7sTQ2LFbNkU" },
  { id: "27", title: "Gurenge",               artist: "LiSA — Demon Slayer",      thumbnail: "https://img.youtube.com/vi/CwkzK-F0Y4E/mqdefault.jpg", genre: "Anime",  youtubeId: "CwkzK-F0Y4E" },
  { id: "28", title: "Unravel",               artist: "TK — Tokyo Ghoul",         thumbnail: "https://img.youtube.com/vi/Kx1HCnHqFsw/mqdefault.jpg", genre: "Anime",  youtubeId: "Kx1HCnHqFsw" },
  { id: "29", title: "Shinzou wo Sasageyo",   artist: "Attack on Titan",          thumbnail: "https://img.youtube.com/vi/YLMuXnZNqSo/mqdefault.jpg", genre: "Anime",  youtubeId: "YLMuXnZNqSo" },
  { id: "30", title: "A Cruel Angel's Thesis",artist: "Evangelion",               thumbnail: "https://img.youtube.com/vi/HzS5hEp_pI8/mqdefault.jpg", genre: "Anime",  youtubeId: "HzS5hEp_pI8" },
];

export function MusicPlayer() {
  const [open, setOpen]               = useState(false);
  const [expanded, setExpanded]       = useState(false);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [playing, setPlaying]         = useState(false);
  const [muted, setMuted]             = useState(false);
  const [shuffle, setShuffle]         = useState(false);
  const [genre, setGenre]             = useState("All");
  const [search, setSearch]           = useState("");
  const [ytSearch, setYtSearch]       = useState("");
  const [ytResults, setYtResults]     = useState<Track[]>([]);
  const [searching, setSearching]     = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const filtered = CURATED_TRACKS.filter(t =>
    (genre === "All" || t.genre === genre) &&
    (!search || t.title.toLowerCase().includes(search.toLowerCase()) || t.artist.toLowerCase().includes(search.toLowerCase()))
  );

  const allDisplayed = ytResults.length > 0 ? ytResults : filtered;

  const play = (track: Track) => {
    setCurrentTrack(track);
    setPlaying(true);
    setExpanded(false);
  };

  const skipTo = (dir: 1 | -1) => {
    if (!currentTrack) return;
    const list = allDisplayed;
    if (shuffle) {
      const next = list[Math.floor(Math.random() * list.length)];
      if (next) play(next);
      return;
    }
    const idx = list.findIndex(t => t.id === currentTrack.id);
    const next = list[(idx + dir + list.length) % list.length];
    if (next) play(next);
  };

  const searchYouTube = async () => {
    if (!ytSearch.trim()) return;
    setSearching(true);
    try {
      const curated = CURATED_TRACKS.filter(t =>
        t.title.toLowerCase().includes(ytSearch.toLowerCase()) ||
        t.artist.toLowerCase().includes(ytSearch.toLowerCase())
      );
      setYtResults(curated.length > 0 ? curated : []);
    } finally {
      setSearching(false);
    }
  };

  const embedUrl = currentTrack
    ? `https://www.youtube-nocookie.com/embed/${currentTrack.youtubeId}?autoplay=${playing ? 1 : 0}&mute=${muted ? 1 : 0}&controls=0&rel=0&modestbranding=1&enablejsapi=1`
    : "";

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          "fixed bottom-24 right-4 z-40 w-12 h-12 rounded-2xl shadow-xl flex items-center justify-center transition-all duration-200",
          "bg-gradient-to-br from-primary via-primary to-purple-600 text-white hover:scale-110 active:scale-95",
          open && "scale-110 ring-2 ring-primary/40 glow-primary-sm"
        )}
        aria-label="Music Player"
      >
        <Music className="w-5 h-5" />
        {currentTrack && playing && (
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-400 border-2 border-background shadow-sm" style={{ boxShadow: "0 0 8px rgba(74,222,128,0.7)" }} />
        )}
      </button>

      {/* Player panel */}
      {open && (
        <div
          className={cn(
            "fixed right-4 z-50 rounded-3xl shadow-2xl overflow-hidden pop-in transition-all duration-300",
            "bg-card/95 border border-border backdrop-blur-2xl",
            expanded ? "bottom-20 w-80 max-h-[82vh] flex flex-col" : "bottom-20 w-80"
          )}
          style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06) inset" }}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/40 flex-shrink-0"
            style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.08), hsl(280 80% 60% / 0.06))" }}>
            <div className="w-7 h-7 rounded-xl btn-primary flex items-center justify-center flex-shrink-0">
              <Music className="w-3.5 h-3.5 text-white" />
            </div>
            <p className="font-black text-foreground text-sm flex-1">Rizz Music</p>
            <div className="flex items-center gap-0.5">
              <button onClick={() => setExpanded(e => !e)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all" title={expanded ? "Collapse" : "Browse tracks"}>
                {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => setOpen(false)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Hidden YouTube iframe */}
          {currentTrack && (
            <iframe
              ref={iframeRef}
              key={currentTrack.youtubeId}
              src={embedUrl}
              className="absolute opacity-0 pointer-events-none"
              style={{ width: 0, height: 0 }}
              allow="autoplay"
              title="music"
            />
          )}

          {/* Now playing */}
          <div className={cn("px-4 py-3", expanded ? "border-b border-border/40 flex-shrink-0" : "")}>
            {currentTrack ? (
              <div className="flex items-center gap-3 mb-3">
                <div className="relative flex-shrink-0">
                  <img src={currentTrack.thumbnail} alt="" className="w-12 h-12 rounded-xl object-cover shadow-md" />
                  {/* Equalizer overlay */}
                  <div className="absolute inset-0 rounded-xl bg-black/30 flex items-center justify-center">
                    <div className={cn("flex gap-0.5 items-end h-4", !playing && "opacity-30")}>
                      {[3, 5, 4, 6, 3].map((h, i) => (
                        <div
                          key={i}
                          className="w-[3px] bg-white rounded-full"
                          style={{
                            height: `${h * 2}px`,
                            animation: playing ? `music-bar ${0.4 + i * 0.12}s ease-in-out infinite alternate` : "none",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm text-foreground truncate leading-tight">{currentTrack.title}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{currentTrack.artist}</p>
                  <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 bg-primary/12 text-primary rounded-full font-black">{currentTrack.genre}</span>
                </div>
                <a href={`https://www.youtube.com/watch?v=${currentTrack.youtubeId}`} target="_blank" rel="noopener noreferrer"
                  className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all flex-shrink-0">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            ) : (
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/15 to-purple-500/10 flex items-center justify-center flex-shrink-0 border border-primary/15">
                  <Music className="w-5 h-5 text-primary/60" />
                </div>
                <div>
                  <p className="text-sm font-black text-foreground">Ready to play</p>
                  <p className="text-xs text-muted-foreground">Pick a track below ↓</p>
                </div>
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setShuffle(s => !s)}
                className={cn("p-2 rounded-xl transition-all", shuffle ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted")}
                title="Shuffle"
              >
                <Shuffle className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => skipTo(-1)} className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all">
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPlaying(p => !p)}
                className="w-11 h-11 rounded-2xl btn-primary flex items-center justify-center shadow-lg glow-primary-sm hover:scale-105 active:scale-95"
              >
                {playing
                  ? <Pause className="w-4.5 h-4.5 text-white" />
                  : <Play className="w-4.5 h-4.5 text-white ml-0.5" />}
              </button>
              <button onClick={() => skipTo(1)} className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all">
                <SkipForward className="w-4 h-4" />
              </button>
              <button
                onClick={() => setMuted(m => !m)}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all"
              >
                {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Expanded library */}
          {expanded && (
            <div className="flex flex-col flex-1 min-h-0">
              {/* Search bar */}
              <div className="px-3 pt-3 pb-2 border-b border-border/40 flex-shrink-0">
                <div className="flex gap-1.5">
                  <div className="flex-1 flex items-center gap-2 bg-muted/60 border border-border/40 rounded-xl px-3 py-2 focus-within:border-primary/40 transition-all">
                    <Search className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    <input
                      value={ytSearch}
                      onChange={e => setYtSearch(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") searchYouTube(); }}
                      placeholder="Search library…"
                      className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                    />
                  </div>
                  <button onClick={searchYouTube} disabled={searching}
                    className="px-3 py-2 btn-primary text-primary-foreground rounded-xl text-xs font-black disabled:opacity-50 hover:scale-105 active:scale-95 transition-all">
                    {searching ? <Loader2 className="w-3 h-3 animate-spin" /> : "Go"}
                  </button>
                </div>
                {ytResults.length > 0 && (
                  <button onClick={() => { setYtResults([]); setYtSearch(""); }}
                    className="text-[10px] text-primary hover:underline mt-1.5 ml-1 font-semibold">
                    ← Back to library
                  </button>
                )}
              </div>

              {/* Genre pills */}
              {ytResults.length === 0 && (
                <div className="flex gap-1 px-3 py-2.5 overflow-x-auto no-scrollbar flex-shrink-0 border-b border-border/40">
                  <div className="flex items-center gap-1.5 bg-muted/60 border border-border/30 rounded-xl px-2.5 py-1 flex-shrink-0">
                    <Search className="w-2.5 h-2.5 text-muted-foreground" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter…"
                      className="w-14 bg-transparent text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none" />
                  </div>
                  {GENRES.map(g => (
                    <button key={g} onClick={() => { setGenre(g); setSearch(""); }}
                      className={cn(
                        "px-2.5 py-1 rounded-xl text-[10px] font-bold whitespace-nowrap flex-shrink-0 transition-all",
                        genre === g ? "btn-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}>
                      {g}
                    </button>
                  ))}
                </div>
              )}

              {/* Track list */}
              <div className="overflow-y-auto flex-1 no-scrollbar">
                {allDisplayed.map(track => (
                  <button key={track.id} onClick={() => play(track)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-muted/50 transition-all text-left border-l-2",
                      currentTrack?.id === track.id
                        ? "bg-primary/5 border-primary"
                        : "border-transparent"
                    )}>
                    <div className="relative flex-shrink-0 w-9 h-9 rounded-xl overflow-hidden">
                      <img src={track.thumbnail} alt="" className="w-full h-full object-cover" />
                      {currentTrack?.id === track.id && playing && (
                        <div className="absolute inset-0 bg-primary/25 flex items-center justify-center">
                          <div className="flex gap-0.5 items-end h-3">
                            {[2, 4, 3].map((h, i) => (
                              <div key={i} className="w-[2px] bg-white rounded-full"
                                style={{ height: `${h * 2}px`, animation: `music-bar ${0.5 + i * 0.1}s ease-in-out infinite alternate` }} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs font-bold truncate", currentTrack?.id === track.id ? "text-primary" : "text-foreground")}>
                        {track.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">{track.artist}</p>
                    </div>
                    <span className="text-[9px] text-muted-foreground/60 font-semibold flex-shrink-0">{track.genre}</span>
                  </button>
                ))}
                {allDisplayed.length === 0 && (
                  <div className="py-10 text-center">
                    <p className="text-3xl mb-2">🎵</p>
                    <p className="text-sm text-muted-foreground font-semibold">No tracks found</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes music-bar {
          from { transform: scaleY(0.5); opacity: 0.7; }
          to   { transform: scaleY(1.3); opacity: 1; }
        }
      `}</style>
    </>
  );
}
