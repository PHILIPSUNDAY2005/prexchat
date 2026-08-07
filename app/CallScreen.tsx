"use client";

import { useEffect, useRef, useState } from "react";

interface CallScreenProps {
  channelName: string;
  callType: "audio" | "video";
  contactName: string;
  contactAvatar?: string;
  onEnd: () => void;
}

export default function CallScreen({ channelName, callType, contactName, contactAvatar, onEnd }: CallScreenProps) {
  const [status, setStatus] = useState("Connecting…");
  const [remoteJoined, setRemoteJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<any>(null);
  const localTracksRef = useRef<any[]>([]);
  const timerRef = useRef<any>(null);
  const agoraRTCRef = useRef<any>(null);

  function formatDuration(total: number) {
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
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
    const videoTrack = localTracksRef.current.find((t) => t.trackMediaType === "video");
    if (!videoTrack) return;

    const newFacing = facingMode === "user" ? "environment" : "user";
    try {
      await videoTrack.setDevice(undefined, { facingMode: newFacing } as any);
    } catch {
      try {
        const devices = await agoraRTCRef.current.getCameras();
        if (devices.length > 1) {
          const currentId = videoTrack.getTrackLabel?.();
          const nextDevice = devices.find((d: any) => d.label !== currentId) || devices[1] || devices[0];
          await videoTrack.setDevice(nextDevice.deviceId);
        }
      } catch (err) {
        console.log("Camera switch not supported on this device");
      }
    }
    setFacingMode(newFacing);
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#0B1120] flex flex-col items-center justify-center text-white overflow-hidden">
      {callType === "video" && (
        <div className="absolute inset-0">
          <div ref={remoteVideoRef} className="w-full h-full bg-zinc-900" />
          <div
            ref={localVideoRef}
            className="absolute bottom-28 right-4 w-28 h-40 rounded-xl overflow-hidden bg-zinc-800 border border-zinc-700"
          />
        </div>
      )}

      <div className="absolute top-10 left-0 right-0 text-center z-10">
        <p className="font-semibold text-lg">{contactName}</p>
        <p className="text-zinc-400 text-xs flex items-center justify-center gap-1">
          🔒 {remoteJoined ? formatDuration(seconds) : status}
        </p>
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
          className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center text-xl"
        >
          📴
        </button>
      </div>
    </div>
  );
}