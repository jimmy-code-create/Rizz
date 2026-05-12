import { useEffect, useRef, useState, useCallback } from "react";
import {
  PhoneOff, Mic, MicOff, Video, VideoOff, Phone,
  Monitor, Volume2, VolumeX, RotateCcw, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/Avatar";

interface CallModalProps {
  conversationId: number;
  otherUser: { id: string; displayName?: string | null; username?: string; avatarUrl?: string | null };
  callType: "voice" | "video";
  mode: "caller" | "callee";
  incomingOffer?: { sdp: string; type: RTCSdpType; callerName: string; callType: "voice" | "video" };
  onClose: () => void;
  callDeclined?: boolean;
}

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }];

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function CallModal({ conversationId, otherUser, callType: initialCallType, mode, incomingOffer, onClose, callDeclined }: CallModalProps) {
  const [status, setStatus] = useState<"ringing" | "connecting" | "connected" | "ended">(mode === "callee" ? "ringing" : "connecting");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(initialCallType === "video");
  const [speakerOn, setSpeakerOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [frontCamera, setFrontCamera] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [callType] = useState(incomingOffer?.callType ?? initialCallType);
  const didConnect = useRef(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const candidatePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const answerPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCandidateTs = useRef(0);
  const savedRef = useRef(false);

  const saveCallMessage = useCallback(async (wasConnected: boolean) => {
    if (savedRef.current) return;
    savedRef.current = true;
    try {
      await fetch("/api/calls/end", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, callType, wasConnected }),
      });
    } catch { }
  }, [conversationId, callType]);

  const stopAll = useCallback(() => {
    if (candidatePollRef.current) clearInterval(candidatePollRef.current);
    if (answerPollRef.current) clearInterval(answerPollRef.current);
    if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
  }, []);

  const sendCandidate = useCallback(async (candidate: RTCIceCandidate) => {
    await fetch(`/api/calls/candidate`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, candidate: candidate.candidate, sdpMid: candidate.sdpMid, sdpMLineIndex: candidate.sdpMLineIndex }),
    });
  }, [conversationId]);

  const pollCandidates = useCallback(() => {
    candidatePollRef.current = setInterval(async () => {
      const r = await fetch(`/api/calls/candidates/${conversationId}?after=${lastCandidateTs.current}`, { credentials: "include" });
      const { candidates } = await r.json();
      for (const c of candidates) {
        if (c.timestamp > lastCandidateTs.current) lastCandidateTs.current = c.timestamp;
        try { await pcRef.current?.addIceCandidate(new RTCIceCandidate({ candidate: c.candidate, sdpMid: c.sdpMid, sdpMLineIndex: c.sdpMLineIndex })); } catch { }
      }
    }, 1500);
  }, [conversationId]);

  const startCall = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: callType === "video" });
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;
    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    pc.ontrack = (e) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
      setStatus("connected");
      didConnect.current = true;
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    };
    pc.onicecandidate = (e) => { if (e.candidate) sendCandidate(e.candidate); };
    pc.onconnectionstatechange = () => {
      if ((pc.connectionState === "disconnected" || pc.connectionState === "failed") && didConnect.current) {
        hangUp();
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await fetch("/api/calls/offer", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, sdp: offer.sdp, type: offer.type, callType }),
    });

    pollCandidates();

    answerPollRef.current = setInterval(async () => {
      const r = await fetch(`/api/calls/answer/${conversationId}`, { credentials: "include" });
      const { answer } = await r.json();
      if (answer && pc.signalingState === "have-local-offer") {
        await pc.setRemoteDescription(new RTCSessionDescription({ type: answer.type, sdp: answer.sdp }));
        if (answerPollRef.current) clearInterval(answerPollRef.current);
      }
    }, 1500);

    ringTimeoutRef.current = setTimeout(() => {
      if (!didConnect.current) {
        hangUp();
      }
    }, 50000);
  }, [callType, conversationId, sendCandidate, pollCandidates]);

  const acceptCall = useCallback(async () => {
    if (!incomingOffer) return;
    setStatus("connecting");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: callType === "video" });
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;
    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    pc.ontrack = (e) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
      setStatus("connected");
      didConnect.current = true;
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    };
    pc.onicecandidate = (e) => { if (e.candidate) sendCandidate(e.candidate); };

    await pc.setRemoteDescription(new RTCSessionDescription({ type: incomingOffer.type, sdp: incomingOffer.sdp }));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await fetch("/api/calls/answer", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, sdp: answer.sdp, type: answer.type }),
    });

    pollCandidates();
  }, [callType, conversationId, incomingOffer, sendCandidate, pollCandidates]);

  const hangUp = useCallback(async () => {
    stopAll();
    await fetch(`/api/calls/offer/${conversationId}`, { method: "DELETE", credentials: "include" });
    if (mode === "caller") {
      await saveCallMessage(didConnect.current);
    } else if (mode === "callee" && didConnect.current) {
      await saveCallMessage(true);
    }
    setStatus("ended");
    setTimeout(onClose, 900);
  }, [stopAll, conversationId, onClose, mode, saveCallMessage]);

  useEffect(() => {
    if (mode === "caller") startCall();
    return () => stopAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (callDeclined && mode === "caller" && !didConnect.current) {
      hangUp();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callDeclined]);

  const toggleMic = () => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setMicOn(p => !p);
  };

  const toggleCam = () => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setCamOn(p => !p);
  };

  const toggleSpeaker = () => {
    setSpeakerOn(p => !p);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = speakerOn;
    }
  };

  const toggleScreenShare = async () => {
    if (screenSharing) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      setScreenSharing(false);
      const videoTrack = localStreamRef.current?.getVideoTracks()[0];
      if (videoTrack && pcRef.current) {
        const sender = pcRef.current.getSenders().find(s => s.track?.kind === "video");
        if (sender && videoTrack) sender.replaceTrack(videoTrack);
      }
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];
        if (screenTrack && pcRef.current) {
          const sender = pcRef.current.getSenders().find(s => s.track?.kind === "video");
          if (sender) sender.replaceTrack(screenTrack);
          screenTrack.onended = () => {
            setScreenSharing(false);
            screenStreamRef.current = null;
          };
        }
        setScreenSharing(true);
      } catch { }
    }
  };

  const flipCamera = async () => {
    const next = !frontCamera;
    setFrontCamera(next);
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: next ? "user" : "environment" },
      });
      const newVideoTrack = newStream.getVideoTracks()[0];
      if (pcRef.current && newVideoTrack) {
        const sender = pcRef.current.getSenders().find(s => s.track?.kind === "video");
        if (sender) sender.replaceTrack(newVideoTrack);
      }
      localStreamRef.current?.getVideoTracks().forEach(t => t.stop());
      localStreamRef.current = newStream;
      if (localVideoRef.current) localVideoRef.current.srcObject = newStream;
      if (!micOn) newStream.getAudioTracks().forEach(t => { t.enabled = false; });
    } catch { }
  };

  const isRinging = status === "ringing";

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/95 backdrop-blur-xl">
      {/* Remote video */}
      {callType === "video" && (
        <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover opacity-75" />
      )}

      <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-sm px-6 text-white text-center">
        {/* Avatar with animated ring */}
        <div className={cn(
          "rounded-full p-1 transition-all duration-500",
          status === "connected" ? "ring-4 ring-green-500/60 ring-offset-4 ring-offset-black/50" :
          isRinging ? "ring-4 ring-primary/60 ring-offset-4 ring-offset-black/50 animate-pulse" :
          "ring-4 ring-white/20 ring-offset-4 ring-offset-black/50"
        )}>
          <Avatar src={otherUser?.avatarUrl} name={otherUser?.displayName || otherUser?.username || "User"} size="xl" />
        </div>

        {/* Name + status */}
        <div>
          <p className="text-2xl font-black tracking-tight">{otherUser?.displayName || otherUser?.username}</p>
          <p className="text-sm text-white/60 mt-1 flex items-center justify-center gap-1.5">
            {status === "ringing" && <span className="animate-pulse">📞 Incoming {callType} call…</span>}
            {status === "connecting" && <span>Connecting…</span>}
            {status === "connected" && (
              <>
                <Clock className="w-3 h-3" />
                <span>{formatDuration(elapsed)}</span>
              </>
            )}
            {status === "ended" && <span>Call ended</span>}
          </p>
          <p className="text-xs text-white/40 mt-0.5 uppercase tracking-widest">
            {callType === "video" ? "📹 Video" : "🎙 Voice"}
          </p>
        </div>

        {/* Local video PiP */}
        {callType === "video" && status !== "ringing" && (
          <div className="absolute top-0 right-0 w-28 h-36 rounded-2xl overflow-hidden border-2 border-white/20 bg-black shadow-2xl">
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            {screenSharing && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <Monitor className="w-6 h-6 text-white" />
              </div>
            )}
          </div>
        )}

        {/* Ringing buttons */}
        {isRinging ? (
          <div className="flex items-center gap-8 mt-2">
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={hangUp}
                className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-2xl transition-all active:scale-90"
              >
                <PhoneOff className="w-7 h-7" />
              </button>
              <span className="text-xs text-white/50">Decline</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={acceptCall}
                className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center shadow-2xl transition-all active:scale-90 animate-bounce"
              >
                <Phone className="w-7 h-7" />
              </button>
              <span className="text-xs text-white/50">Accept</span>
            </div>
          </div>
        ) : (
          <>
            {/* Secondary controls row */}
            <div className="flex items-center justify-center gap-4 w-full">
              {/* Speaker */}
              <div className="flex flex-col items-center gap-1.5">
                <button
                  onClick={toggleSpeaker}
                  className={cn("w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90",
                    speakerOn ? "bg-white/15 hover:bg-white/25" : "bg-red-500/80 hover:bg-red-500"
                  )}
                >
                  {speakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                </button>
                <span className="text-[10px] text-white/50">{speakerOn ? "Speaker" : "Muted"}</span>
              </div>

              {/* Screen share — video calls only */}
              {callType === "video" && (
                <div className="flex flex-col items-center gap-1.5">
                  <button
                    onClick={toggleScreenShare}
                    className={cn("w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90",
                      screenSharing ? "bg-primary hover:bg-primary/80" : "bg-white/15 hover:bg-white/25"
                    )}
                  >
                    <Monitor className="w-5 h-5" />
                  </button>
                  <span className="text-[10px] text-white/50">{screenSharing ? "Sharing" : "Screen"}</span>
                </div>
              )}

              {/* Camera flip — video calls only */}
              {callType === "video" && (
                <div className="flex flex-col items-center gap-1.5">
                  <button
                    onClick={flipCamera}
                    className="w-12 h-12 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-all active:scale-90"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>
                  <span className="text-[10px] text-white/50">Flip</span>
                </div>
              )}
            </div>

            {/* Primary controls row */}
            <div className="flex items-center justify-center gap-5 w-full">
              {/* Mic */}
              <div className="flex flex-col items-center gap-1.5">
                <button
                  onClick={toggleMic}
                  className={cn("w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90",
                    micOn ? "bg-white/20 hover:bg-white/30" : "bg-red-500 hover:bg-red-600"
                  )}
                >
                  {micOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                </button>
                <span className="text-[10px] text-white/50">{micOn ? "Mic" : "Muted"}</span>
              </div>

              {/* Hang up */}
              <div className="flex flex-col items-center gap-1.5">
                <button
                  onClick={hangUp}
                  className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-2xl transition-all active:scale-90"
                >
                  <PhoneOff className="w-7 h-7" />
                </button>
                <span className="text-[10px] text-white/50">End</span>
              </div>

              {/* Camera toggle */}
              {callType === "video" && (
                <div className="flex flex-col items-center gap-1.5">
                  <button
                    onClick={toggleCam}
                    className={cn("w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90",
                      camOn ? "bg-white/20 hover:bg-white/30" : "bg-red-500 hover:bg-red-600"
                    )}
                  >
                    {camOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                  </button>
                  <span className="text-[10px] text-white/50">{camOn ? "Camera" : "Off"}</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
