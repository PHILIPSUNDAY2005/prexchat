"use client";

import { useEffect, useRef, useState } from "react";

interface CallScreenProps {
  channelName: string;
  callType: "audio" | "video";
  contactName: string;
  onEnd: () => void;
}

export default function CallScreen({ channelName, callType, contactName, onEnd }: CallScreenProps) {
  const [status, setStatus] = useState("Connecting…");
  const [remoteJoined, setRemoteJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);

  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<any>(null);
  const localTracksRef = useRef<any[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function startCall() {
      const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
      const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID as string;

      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      clientRef.current = client;

      client.on("user-published", async (user: any, mediaType: any) => {
        await client.subscribe(user, mediaType);
        if (mediaType === "video") {
          setRemoteJoined(true);
          setStatus("Connected");
          setTimeout(() => {
            if (remoteVideoRef.current) {
              user.videoTrack.play(remoteVideoRef.current);
            }
          }, 100);
        }
        if (mediaType === "audio") {
          setRemoteJoined(true);
          setStatus("Connected");
          user.audioTrack.play();
        }
      });

      client.on("user-unpublished", () => {
        setRemoteJoined(false);
      });

      try {
        await client.join(appId, channelName, null, null);

        const tracks: any[] = [];
        const micTrack = await AgoraRTC.createMicrophoneAudioTrack();
        tracks.push(micTrack);

        if (callType === "video") {
          const camTrack = await AgoraRTC.createCameraVideoTrack();
          tracks.push(camTrack);
          if (localVideoRef.current && !cancelled) {
            camTrack.play(localVideoRef.current);
          }
        }

        localTracksRef.current = tracks;
        await client.publish(tracks);

        if (!cancelled) {
          setStatus(callType === "video" ? "Waiting for answer…" : "Calling…");
        }
      } catch (err: any) {
        setStatus("Could not connect: " + err.message);
      }
    }

    startCall();

    return () => {
      cancelled = true;
      localTracksRef.current.forEach((t) => {
        t.stop();
        t.close();
      });
      if (clientRef.current) {
        clientRef.current.leave();
      }
    };
  }, [channelName, callType]);

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

  return (
    <div className="fixed inset-0 z-50 bg-[#0B1120] flex flex-col items-center justify-center text-white">
      {callType === "video" && (
        <div className="absolute inset-0">
          <div ref={remoteVideoRef} className="w-full h-full bg-zinc-900" />
          <div
            ref={localVideoRef}
            className="absolute bottom-24 right-4 w-28 h-40 rounded-xl overflow-hidden bg-zinc-800 border border-zinc-700"
          />
        </div>
      )}

      {(!remoteJoined || callType === "audio") && (
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-24 h-24 rounded-full bg-blue-500 flex items-center justify-center font-bold text-3xl mb-4">
            {contactName?.charAt(0)}
          </div>
          <h2 className="text-xl font-semibold">{contactName}</h2>
          <p className="text-zinc-400 text-sm mt-1">{status}</p>
        </div>
      )}

      <div className="absolute bottom-8 flex gap-6 z-10">
        <button
          onClick={toggleMute}
          className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center text-xl"
        >
          {muted ? "🔇" : "🎙️"}
        </button>

        {callType === "video" && (
          <button
            onClick={toggleCamera}
            className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center text-xl"
          >
            {cameraOff ? "🚫" : "📷"}
          </button>
        )}

        <button
          onClick={onEnd}
          className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center text-xl"
        >
          📴
        </button>
      </div>
    </div>
  );
}