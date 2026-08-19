"use client";

import { useEffect, useRef, useState } from "react";

interface CallScreenProps {
  channelName: string;
  callType: "audio" | "video";
  contactName: string;
  contactAvatar?: string;
  initialStatusText?: string;
  onConnected?: () => void;
  onEnd: () => void;
}

export default function CallScreen({
  channelName,
  callType,
  contactName,
  contactAvatar,
  initialStatusText,
  onConnected,
  onEnd,
}: CallScreenProps) {
  const [status, setStatus] = useState(initialStatusText || "Connecting…");
  const [remoteJoined, setRemoteJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [cameraSwitchError, setCameraSwitchError] = useState("");

  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<any>(null);
  const localTracksRef = useRef<any[]>([]);
  const timerRef = useRef<any>(null);
  const agoraRTCRef = useRef<any>(null);
  const hasConnectedRef = useRef(false);

  function formatDuration(total: number) {
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  function markConnected() {
    if (hasConnectedRef.current) return;
    hasConnectedRef.current = true;
    setRemoteJoined(true);
    setStatus("Connected");
    onConnected?.();
  }

  useEffect(() => {
    let cancelled = false;

    async function startCall() {
      const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
      agoraRTCRef.current = AgoraRTC;
      const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID as string;

      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      clientRef.current = client;

      client.on("user-published", async (user: any, mediaType: any) => {
        await client.subscribe(user, mediaType);
        if (mediaType === "video") {
          markConnected();
          setTimeout(() => {
            if (remoteVideoRef.current) {
              user.videoTrack.play(remoteVideoRef.current);
            }
          }, 100);
        }
        if (mediaType === "audio") {
          markConnected();
          user.audioTrack.play();
        }
      });

      client.on("user-unpublished", () => {
        setRemoteJoined(false);
      });

      client.on("connection-state-change", (curState: string, _prevState: string, reason: string) => {
        if (curState === "RECONNECTING") {
          setStatus("Reconnecting…");
        } else if (curState === "CONNECTED") {
          if (hasConnectedRef.current) setStatus("Connected");
        } else if (curState === "DISCONNECTED" && reason !== "LEAVE") {
          setStatus("Connection lost — trying to reconnect…");
        }
      });

      client.on("token-privilege-will-expire", async () => {
        try {
          const res = await fetch(`/api/agora-token?channel=${channelName}`);
          const { token } = await res.json();
          await client.renewToken(token);
        } catch (err) {
          console.log("Token renewal failed", err);
        }
      });

      try {
        const tokenRes = await fetch(`/api/agora-token?channel=${channelName}`);
        const { token } = await tokenRes.json();

        await client.join(appId, channelName, token, 0);

        const tracks: any[] = [];
        const micTrack = await AgoraRTC.createMicrophoneAudioTrack();
        tracks.push(micTrack);

        if (callType === "video") {
          const camTrack = await AgoraRTC.createCameraVideoTrack({
            facingMode: "user",
          });
          tracks.push(camTrack);
          if (localVideoRef.current && !cancelled) {
            camTrack.play(localVideoRef.current);
          }
        }

        localTracksRef.current = tracks;
        await client.publish(tracks);
      } catch (err: any) {
        if (!cancelled) setStatus("Could not connect: " + err.message);
      }
    }

    startCall();

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      localTracksRef.current.forEach((t) => {
        t.stop();
        t.close();
      });
      if (clientRef.current) {
        clientRef.current.leave();
      }
    };
  }, [channelName, callType]);

  useEffect(() => {
    if (remoteJoined) {
      timerRef.current = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [remoteJoined]);

  function toggleMute() {
    const audioTrack = localTracksRef.current.find((t) => t.trackMediaType === "audio");
    if (audioTrack) {
      audioTrack.setEnabled(muted);
      setMuted(!muted);
    }
  }

  function toggleCamera() {
    const videoTrack = localTracksRef.current.find((t) => t.trackMediaType === "video");
    if (videoTrack) {
      videoTrack.setEnabled(cameraOff);
      setCameraOff(!cameraOff);
    }
  }
  async function switchCamera() {
    const oldVideoTrack = localTracksRef.current.find((t) => t.trackMediaType === "video");
    if (!oldVideoTrack || !agoraRTCRef.current || !clientRef.current) return;

    const newFacing = facingMode === "user" ? "environment" : "user";

    try {
      const newVideoTrack = await agoraRTCRef.current.createCameraVideoTrack({ facingMode: newFacing });

      await clientRef.current.unpublish(oldVideoTrack);
      oldVideoTrack.stop();
      oldVideoTrack.close();

      localTracksRef.current = localTracksRef.current.filter((t) => t.trackMediaType !== "video");
      localTracksRef.current.push(newVideoTrack);

      if (localVideoRef.current) {
        newVideoTrack.play(localVideoRef.current);
      }

      await clientRef.current.publish(newVideoTrack);

      setFacingMode(newFacing);
    } catch (err) {
      console.log("Camera switch failed", err);
      setCameraSwitchError("Could not switch camera on this device.");
      setTimeout(() => setCameraSwitchError(""), 3000);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#0B1120] flex flex-col items-center justify-center text-white overflow-hidden">
      {callType === "video" && (
        <div className="absolute inset-0">
          <div ref={remoteVideoRef} className="w-full h-full bg-zinc-900" />
          <div
            ref={localVideoRef}
            className="absolute bottom-28 right-4 w-28 h-40 rounded-xl overflow-hidden bg-zinc-800 border border-zinc-700"
            style={{ transform: facingMode === "user" ? "scaleX(-1)" : "scaleX(1)" }}
          />
        </div>
      )}

      <div className="absolute top-10 left-0 right-0 text-center z-10">
        <p className="font-semibold text-lg">{contactName}</p>
        <p className="text-zinc-400 text-xs flex items-center justify-center gap-1">
          🔒 {remoteJoined ? formatDuration(seconds) : status}
        </p>
        {cameraSwitchError && (
          <p className="text-yellow-400 text-xs mt-1">{cameraSwitchError}</p>
        )}
      </div>

      {(!remoteJoined || callType === "audio") && (
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-28 h-28 rounded-full bg-blue-500 overflow-hidden flex items-center justify-center font-bold text-3xl mb-3">
            {contactAvatar ? (
              <img src={contactAvatar} className="w-full h-full object-cover" />
            ) : (
              contactName?.charAt(0)
            )}
          </div>
          {callType === "audio" && (
            <p className="text-zinc-400 text-sm">
              {remoteJoined ? formatDuration(seconds) : status}
            </p>
          )}
        </div>
      )}

      <div className="absolute bottom-8 flex gap-5 z-10 flex-wrap justify-center px-6">
        <button
          onClick={toggleMute}
          className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center text-xl"
        >
          {muted ? "🔇" : "🎙️"}
        </button>

        {callType === "video" && (
          <>
            <button
              onClick={toggleCamera}
              className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center text-xl"
            >
              {cameraOff ? "🚫" : "📷"}
            </button>
            <button
              onClick={switchCamera}
              className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center text-xl"
              title="Switch camera"
            >
              🔄
            </button>
          </>
        )}

        <button
          onClick={onEnd}
          className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white" style={{ transform: "rotate(135deg)" }}>
            <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24 11.36 11.36 0 003.57.57 1 1 0 011 1V20a1 1 0 01-1 1C10.61 21 3 13.39 3 4a1 1 0 011-1h3.49a1 1 0 011 1 11.36 11.36 0 00.57 3.57 1 1 0 01-.25 1.01l-2.2 2.21z" />
          </svg>
        </button>
      </div>
    </div>
  );
}