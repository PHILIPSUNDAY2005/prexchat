"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import Link from "next/link";
import CallScreen from "../CallScreen";

function VoiceNotePlayer({ src, isMine }: { src: string; isMine: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const bars = [6, 12, 18, 10, 14, 20, 9, 16, 22, 8, 13, 19, 7, 15, 21, 11, 17, 9, 14, 6];

  function formatDuration(seconds: number) {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  function togglePlay() {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  }

  const progress = duration ? currentTime / duration : 0;
  const playedBars = Math.round(progress * bars.length);

  return (
    <div className="flex items-center gap-2 min-w-[190px]">
      <audio
        ref={audioRef}
        src={src}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />
      <button
        onClick={togglePlay}
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isMine ? "bg-white/20" : "bg-blue-500"
        }`}
      >
        {isPlaying ? "⏸" : "▶"}
      </button>
      <div className="flex items-end gap-[2px] h-5">
        {bars.map((h, i) => (
          <div
            key={i}
            className={`w-[3px] rounded-full ${
              i < playedBars ? "bg-white" : isMine ? "bg-white/40" : "bg-zinc-500"
            }`}
            style={{ height: `${h}px` }}
          />
        ))}
      </div>
      <span className="text-[10px] opacity-80 flex-shrink-0">
        {formatDuration(isPlaying || currentTime > 0 ? currentTime : duration)}
      </span>
    </div>
  );
}

const wallpaperPattern = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'>
  <g fill='none' stroke='#ffffff' stroke-opacity='0.05' stroke-width='2'>
    <path d='M20 30 h30 v20 h-20 l-8 8 v-8 h-2 z' />
    <path d='M150 40 c-10 -10 -25 -10 -30 5 c-5 -15 -20 -15 -30 -5 c-10 10 0 25 30 45 c30 -20 40 -35 30 -45 z' />
    <path d='M90 140 l5 12 12 2 -9 8 2 12 -10 -6 -10 6 2 -12 -9 -8 12 -2 z' />
    <path d='M170 150 h25 v16 h-16 l-6 6 v-6 h-3 z' />
  </g>
</svg>
`)}`;

const commonEmojis = ["😂", "❤️", "👍", "🔥", "😭", "🙏", "😍", "😅", "🎉", "💯", "😩", "👀", "😊", "🤣", "😢", "🙌"];

export default function Chat() {
  const [userId, setUserId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [contacts, setContacts] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [activeContact, setActiveContact] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [contactIsTyping, setContactIsTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [myWallpaper, setMyWallpaper] = useState("");
  const [activeCall, setActiveCall] = useState<{ type: "audio" | "video"; channelName: string } | null>(null);
  const [incomingCall, setIncomingCall] = useState<{ type: "audio" | "video"; channelName: string; callerName: string } | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const activeChannelRef = useRef<any>(null);
  const pollIntervalRef = useRef<any>(null);
  const typingTimeoutRef = useRef<any>(null);
  const lastTypingSentRef = useRef<number>(0);
  const heartbeatRef = useRef<any>(null);
  const globalChannelRef = useRef<any>(null);
  const activeContactRef = useRef<any>(null);
  const contactsRef = useRef<any[]>([]);
  const missedCallTimeoutRef = useRef<any>(null);

  useEffect(() => {
    async function getUser() {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setUserId(data.user.id);
        setFirstName(data.user.user_metadata.first_name || "");
        loadContacts(data.user.id);
        loadGroups(data.user.id);

        const { data: myProfile } = await supabase
          .from("profiles")
          .select("wallpaper_url")
          .eq("id", data.user.id)
          .maybeSingle();

        if (myProfile?.wallpaper_url) {
          setMyWallpaper(myProfile.wallpaper_url);
        }

        await supabase
          .from("profiles")
          .update({ last_active: new Date().toISOString() })
          .eq("id", data.user.id);

        heartbeatRef.current = setInterval(async () => {
          await supabase
            .from("profiles")
            .update({ last_active: new Date().toISOString() })
            .eq("id", data.user.id);
        }, 30000);

        if ("Notification" in window && Notification.permission === "default") {
          Notification.requestPermission();
        }

        const globalChannel = supabase
          .channel(`global-messages-${data.user.id}`)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "messages", filter: `receiver_id=eq.${data.user.id}` },
            (payload) => {
              const newMsg = payload.new as any;
              const isViewingThisChat =
                document.visibilityState === "visible" &&
                activeContactRef.current?.id === newMsg.sender_id;

              if (!isViewingThisChat && "Notification" in window && Notification.permission === "granted") {
                const senderContact = contactsRef.current.find((c) => c.id === newMsg.sender_id);
                const senderName = senderContact?.first_name || "New message";
                const preview = newMsg.call_status === "missed"
                  ? `Missed ${newMsg.call_type === "video" ? "video" : "voice"} call`
                  : newMsg.audio_url
                  ? "🎤 Voice note"
                  : newMsg.media_url
                  ? "📷 Photo/Video"
                  : newMsg.content || "New message";

                new Notification(senderName, { body: preview });
              }
            }
          )
          .subscribe();

        globalChannelRef.current = globalChannel;
      }
    }
    getUser();

    return () => {
      if (activeChannelRef.current) {
        supabase.removeChannel(activeChannelRef.current);
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      if (globalChannelRef.current) {
        supabase.removeChannel(globalChannelRef.current);
      }
      if (missedCallTimeoutRef.current) {
        clearTimeout(missedCallTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    activeContactRef.current = activeContact;
  }, [activeContact]);

  useEffect(() => {
    contactsRef.current = contacts;
  }, [contacts]);

  async function loadGroups(myId: string) {
    const { data } = await supabase
      .from("group_members")
      .select("group_id, groups:group_id(id, name)")
      .eq("user_id", myId);

    if (data) {
      const list = data.map((row: any) => row.groups).filter(Boolean);
      setGroups(list);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  async function loadContacts(myId: string) {
    const { data: contactRows } = await supabase
      .from("contacts")
      .select("contact_id, profiles:contact_id(id, first_name, last_active, avatar_url)")
      .eq("user_id", myId);

    if (!contactRows) return;

    const profiles = contactRows.map((row: any) => row.profiles);

    const contactsWithLastMessage = await Promise.all(
      profiles.map(async (contact: any) => {
        const { data: lastMsg } = await supabase
          .from("messages")
          .select("content, audio_url, media_url, media_type, call_type, call_status, created_at")
          .or(
            `and(sender_id.eq.${myId},receiver_id.eq.${contact.id}),and(sender_id.eq.${contact.id},receiver_id.eq.${myId})`
          )
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const { count: unreadCount } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("sender_id", contact.id)
          .eq("receiver_id", myId)
          .eq("seen", false);

        let preview = lastMsg?.content || "Say hi 👋";
        if (lastMsg?.call_status === "missed") {
          preview = `📵 Missed ${lastMsg.call_type === "video" ? "video" : "voice"} call`;
        } else if (lastMsg?.audio_url) preview = "🎤 Voice note";
        else if (lastMsg?.media_type === "video") preview = "🎥 Video";
        else if (lastMsg?.media_type === "image") preview = "📷 Photo";

        return {
          ...contact,
          lastMessage: preview,
          lastTime: lastMsg?.created_at || null,
          unreadCount: unreadCount || 0,
        };
      })
    );

    setContacts(contactsWithLastMessage);
  }

  function formatTime(timestamp: string | null) {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function isOnline(lastActive: string | null) {
    if (!lastActive) return false;
    return Date.now() - new Date(lastActive).getTime() < 60000;
  }

  async function fetchMessages(myId: string, contactId: string) {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(
        `and(sender_id.eq.${myId},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${myId})`
      )
      .order("created_at", { ascending: true });

    return data || [];
  }

  async function openChat(contact: any) {
    setActiveContact(contact);
    setContactIsTyping(false);
    setShowEmojiPicker(false);

    const initialMessages = await fetchMessages(userId, contact.id);
    setMessages(initialMessages);

    await supabase
      .from("messages")
      .update({ seen: true })
      .eq("sender_id", contact.id)
      .eq("receiver_id", userId)
      .eq("seen", false);

    if (activeChannelRef.current) {
      supabase.removeChannel(activeChannelRef.current);
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    const roomName = [userId, contact.id].sort().join("-");

    const channel = supabase
      .channel(`chat-${roomName}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const newMsg = payload.new as any;
          const isRelevant =
            (newMsg.sender_id === userId && newMsg.receiver_id === contact.id) ||
            (newMsg.sender_id === contact.id && newMsg.receiver_id === userId);

          if (isRelevant) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            loadContacts(userId);

            if (newMsg.sender_id === contact.id) {
              supabase.from("messages").update({ seen: true }).eq("id", newMsg.id);
            }
          }
        }
      )
      .on("broadcast", { event: "typing" }, (payload) => {
        if (payload.payload.senderId === contact.id) {
          setContactIsTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => {
            setContactIsTyping(false);
          }, 2500);
        }
      })
      .on("broadcast", { event: "call-invite" }, (payload) => {
        if (payload.payload.senderId === contact.id) {
          setIncomingCall({
            type: payload.payload.callType,
            channelName: payload.payload.channelName,
            callerName: contact.first_name,
          });
        }
      })
      .on("broadcast", { event: "call-ended" }, (payload) => {
        if (payload.payload.senderId === contact.id) {
          if (missedCallTimeoutRef.current) clearTimeout(missedCallTimeoutRef.current);
          setActiveCall(null);
          setIncomingCall(null);
        }
      })
      .subscribe();

    activeChannelRef.current = channel;

    pollIntervalRef.current = setInterval(async () => {
      const freshData = await fetchMessages(userId, contact.id);
      setMessages(freshData);

      const { data: freshProfile } = await supabase
        .from("profiles")
        .select("last_active")
        .eq("id", contact.id)
        .maybeSingle();

      if (freshProfile) {
        setActiveContact((prev: any) =>
          prev ? { ...prev, last_active: freshProfile.last_active } : prev
        );
      }
    }, 3000);
  }

  function closeChat() {
    if (activeChannelRef.current) {
      supabase.removeChannel(activeChannelRef.current);
      activeChannelRef.current = null;
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setContactIsTyping(false);
    setShowEmojiPicker(false);
    setActiveContact(null);
    loadContacts(userId);
  }

  function handleTyping(value: string) {
    setNewMessage(value);

    if (!activeChannelRef.current) return;

    const now = Date.now();
    if (now - lastTypingSentRef.current > 1000) {
      lastTypingSentRef.current = now;
      activeChannelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: { senderId: userId },
      });
    }
  }

  function buildCallChannelName(idA: string, idB: string) {
    const clean = (id: string) => id.replace(/-/g, "").slice(0, 16);
    const sorted = [idA, idB].sort();
    return `call${clean(sorted[0])}${clean(sorted[1])}`;
  }

  function startCall(type: "audio" | "video") {
    if (!activeContact || !activeChannelRef.current) return;

    const channelName = buildCallChannelName(userId, activeContact.id);

    activeChannelRef.current.send({
      type: "broadcast",
      event: "call-invite",
      payload: { senderId: userId, callType: type, channelName },
    });

    setActiveCall({ type, channelName });

    if (missedCallTimeoutRef.current) clearTimeout(missedCallTimeoutRef.current);
    missedCallTimeoutRef.current = setTimeout(async () => {
      await supabase.from("messages").insert({
        sender_id: userId,
        receiver_id: activeContact.id,
        call_type: type,
        call_status: "missed",
      });
      loadContacts(userId);

      if (activeChannelRef.current) {
        activeChannelRef.current.send({
          type: "broadcast",
          event: "call-ended",
          payload: { senderId: userId },
        });
      }
      setActiveCall(null);
    }, 30000);
  }

  function acceptIncomingCall() {
    if (!incomingCall) return;
    if (missedCallTimeoutRef.current) clearTimeout(missedCallTimeoutRef.current);
    setActiveCall({ type: incomingCall.type, channelName: incomingCall.channelName });
    setIncomingCall(null);
  }

  function declineIncomingCall() {
    setIncomingCall(null);
  }

  function endCall() {
    if (missedCallTimeoutRef.current) clearTimeout(missedCallTimeoutRef.current);
    if (activeChannelRef.current) {
      activeChannelRef.current.send({
        type: "broadcast",
        event: "call-ended",
        payload: { senderId: userId },
      });
    }
    setActiveCall(null);
  }

  async function sendMessage() {
    if (!newMessage || !activeContact) return;

    const { data, error } = await supabase
      .from("messages")
      .insert({
        sender_id: userId,
        receiver_id: activeContact.id,
        content: newMessage,
      })
      .select()
      .single();

    if (!error && data) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev;
        return [...prev, data];
      });
      setNewMessage("");
      loadContacts(userId);
    }
  }

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;
    audioChunksRef.current = [];

    recorder.ondataavailable = (e) => {
      audioChunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      await uploadVoiceNote(audioBlob);
    };

    recorder.start();
    setIsRecording(true);
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }

  async function uploadVoiceNote(audioBlob: Blob) {
    if (!activeContact) return;

    const fileName = `${userId}-${Date.now()}.webm`;

    const { error: uploadError } = await supabase.storage
      .from("voice-notes")
      .upload(fileName, audioBlob);

    if (uploadError) {
      alert("Upload failed: " + uploadError.message);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("voice-notes")
      .getPublicUrl(fileName);

    const { data, error } = await supabase
      .from("messages")
      .insert({
        sender_id: userId,
        receiver_id: activeContact.id,
        audio_url: urlData.publicUrl,
      })
      .select()
      .single();

    if (!error && data) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev;
        return [...prev, data];
      });
      loadContacts(userId);
    }
  }

  async function uploadOneMedia(file: File) {
    if (!activeContact) return;

    const isVideo = file.type.startsWith("video");
    const fileExt = file.name.split(".").pop();
    const fileName = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("chat-media")
      .upload(fileName, file);

    if (uploadError) {
      alert("Upload failed: " + uploadError.message);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("chat-media")
      .getPublicUrl(fileName);

    const { data, error } = await supabase
      .from("messages")
      .insert({
        sender_id: userId,
        receiver_id: activeContact.id,
        media_url: urlData.publicUrl,
        media_type: isVideo ? "video" : "image",
      })
      .select()
      .single();

    if (!error && data) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev;
        return [...prev, data];
      });
    }
  }

  async function uploadMultipleMedia(files: FileList) {
    for (const file of Array.from(files)) {
      await uploadOneMedia(file);
    }
    loadContacts(userId);
  }

  if (activeCall) {
    return (
      <CallScreen
        channelName={activeCall.channelName}
        callType={activeCall.type}
        contactName={activeContact?.first_name || "Contact"}
        contactAvatar={activeContact?.avatar_url}
        onEnd={endCall}
      />
    );
  }

  if (activeContact) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
        {viewingPhoto && (
          <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
            onClick={() => setViewingPhoto(null)}
          >
            <img src={viewingPhoto} className="max-w-[90%] max-h-[80%] rounded-lg object-contain" />
          </div>
        )}

        {incomingCall && (
          <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-blue-500 flex items-center justify-center font-bold text-3xl mb-4">
              {incomingCall.callerName?.charAt(0)}
            </div>
            <h2 className="text-xl font-semibold text-white">{incomingCall.callerName}</h2>
            <p className="text-zinc-400 text-sm mt-1">
              Incoming {incomingCall.type === "video" ? "video" : "voice"} call…
            </p>
            <div className="flex gap-8 mt-8">
              <button
                onClick={declineIncomingCall}
                className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-2xl"
              >
                📴
              </button>
              <button
                onClick={acceptIncomingCall}
                className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center text-2xl"
              >
                📞
              </button>
            </div>
          </div>
        )}

        <div className="bg-zinc-900 p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={closeChat} className="text-white text-lg px-1">
              ←
            </button>
            <div
              className="relative flex-shrink-0 cursor-pointer"
              onClick={() => activeContact.avatar_url && setViewingPhoto(activeContact.avatar_url)}
            >
              <div className="w-9 h-9 rounded-full bg-blue-500 overflow-hidden flex items-center justify-center font-bold text-sm">
                {activeContact.avatar_url ? (
                  <img src={activeContact.avatar_url} className="w-full h-full object-cover" />
                ) : (
                  activeContact.first_name?.charAt(0)
                )}
              </div>
              {isOnline(activeContact.last_active) && (
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-zinc-900 rounded-full" />
              )}
            </div>
            <div>
              <p className="font-semibold text-sm">{activeContact.first_name}</p>
              <p className="text-xs text-zinc-400">
                {contactIsTyping
                  ? "typing…"
                  : isOnline(activeContact.last_active)
                  ? "online"
                  : "last seen recently"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-lg pr-1">
            <button onClick={() => startCall("video")} title="Video call">🎥</button>
            <button onClick={() => startCall("audio")} title="Voice call">📞</button>
          </div>
        </div>

        <div
          className="flex-1 p-4 flex flex-col gap-2 overflow-y-auto"
          style={
            myWallpaper
              ? {
                  backgroundImage: `url("${myWallpaper}")`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : {
                  backgroundImage: `url("${wallpaperPattern}")`,
                  backgroundRepeat: "repeat",
                }
          }
        >
          {messages.length === 0 && !contactIsTyping && (
            <div className="m-auto text-center text-zinc-500 text-sm">
              No messages here yet…
              <br />
              Send a message to say hi 👋
            </div>
          )}

          {messages.map((msg) =>
            msg.call_status === "missed" ? (
              <div
                key={msg.id}
                className={`max-w-[75%] flex items-center gap-2 p-2 px-3 rounded-2xl text-sm ${
                  msg.sender_id === userId
                    ? "bg-zinc-800/60 self-end rounded-br-sm"
                    : "bg-zinc-800/60 self-start rounded-bl-sm"
                }`}
              >
                <span className="text-red-400">📵</span>
                <span className="text-zinc-300">
                  {msg.sender_id === userId
                    ? `Missed ${msg.call_type === "video" ? "video" : "voice"} call`
                    : `Missed ${msg.call_type === "video" ? "video" : "voice"} call from ${activeContact.first_name}`}
                </span>
              </div>
            ) : (
              <div
                key={msg.id}
                className={`max-w-[70%] p-2 px-3 rounded-2xl text-sm ${
                  msg.sender_id === userId
                    ? "bg-blue-500 self-end rounded-br-sm"
                    : "bg-zinc-800 self-start rounded-bl-sm"
                }`}
              >
                {msg.audio_url ? (
                  <VoiceNotePlayer src={msg.audio_url} isMine={msg.sender_id === userId} />
                ) : msg.media_url ? (
                  msg.media_type === "video" ? (
                    <video controls src={msg.media_url} className="max-w-[220px] rounded-lg" />
                  ) : (
                    <img src={msg.media_url} alt="Shared photo" className="max-w-[220px] rounded-lg" />
                  )
                ) : (
                  msg.content
                )}
              </div>
            )
          )}

          {contactIsTyping && (
            <div className="bg-zinc-800 self-start rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
              <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" />
            </div>
          )}
        </div>

        <div className="p-2 bg-zinc-900 flex items-center gap-2">
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            id="media-input"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                uploadMultipleMedia(e.target.files);
              }
              e.target.value = "";
            }}
          />
          <label
            htmlFor="media-input"
            className="text-xl cursor-pointer w-10 h-10 flex items-center justify-center flex-shrink-0"
          >
            📎
          </label>
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="text-xl w-10 h-10 flex items-center justify-center flex-shrink-0"
          >
            😊
          </button>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => handleTyping(e.target.value)}
            placeholder="Message"
            className="flex-1 p-3 rounded-full text-sm outline-none bg-zinc-800 text-white"
          />

          {newMessage ? (
            <button
              onClick={sendMessage}
              className="bg-blue-500 hover:bg-blue-600 text-white w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            >
              ➤
            </button>
          ) : (
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                isRecording ? "bg-red-500" : "bg-blue-500 hover:bg-blue-600"
              } text-white`}
            >
              🎤
            </button>
          )}
        </div>

        {showEmojiPicker && (
          <div className="bg-zinc-900 border-t border-zinc-800 p-3 grid grid-cols-8 gap-2">
            {commonEmojis.map((emoji, i) => (
              <button
                key={i}
                onClick={() => {
                  setNewMessage((prev) => prev + emoji);
                  setShowEmojiPicker(false);
                }}
                className="text-2xl hover:scale-125 transition-transform"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const filteredContacts = contacts.filter((c) =>
    c.first_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-16">
      <div className="bg-zinc-900 p-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">
          ChitChat<span className="text-blue-500">NG</span>
        </h1>
        <div className="flex items-center gap-3">
          <Link href="/creategroup" className="text-lg" title="New Group">
            ➕
          </Link>
          <span className="text-sm text-zinc-400">Hi, {firstName}</span>
          <button
            onClick={handleLogout}
            className="text-xs text-red-400 hover:text-red-300"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="p-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search chats"
          className="w-full p-2 rounded-lg text-sm outline-none bg-zinc-800 text-white"
        />
      </div>

      {groups.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 px-4 pt-2 pb-1">Groups</p>
          {groups.map((group) => (
            <Link
              key={group.id}
              href={`/groupchat/${group.id}`}
              className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 hover:bg-zinc-900 cursor-pointer"
            >
              <div className="w-11 h-11 rounded-full bg-purple-500 flex items-center justify-center font-bold flex-shrink-0">
                {group.name?.charAt(0)?.toUpperCase()}
              </div>
              <p className="text-sm font-semibold">{group.name}</p>
            </Link>
          ))}
        </div>
      )}

      <div>
        {groups.length > 0 && (
          <p className="text-xs text-zinc-500 px-4 pt-3 pb-1">Chats</p>
        )}
        {filteredContacts.length === 0 && (
          <p className="text-zinc-500 text-sm p-4">
            No contacts yet — go to the Contacts tab to add someone by username.
          </p>
        )}

        {filteredContacts.map((contact) => (
          <div
            key={contact.id}
            onClick={() => openChat(contact)}
            className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 hover:bg-zinc-900 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="relative flex-shrink-0">
                <div className="w-11 h-11 rounded-full bg-blue-500 overflow-hidden flex items-center justify-center font-bold">
                  {contact.avatar_url ? (
                    <img src={contact.avatar_url} className="w-full h-full object-cover" />
                  ) : (
                    contact.first_name?.charAt(0)
                  )}
                </div>
                {isOnline(contact.last_active) && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-zinc-950 rounded-full" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold">{contact.first_name}</p>
                <p className="text-xs text-zinc-400 truncate max-w-[200px]">
                  {contact.lastMessage}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span className="text-xs text-zinc-500">
                {formatTime(contact.lastTime)}
              </span>
              {contact.unreadCount > 0 && (
                <span className="bg-green-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {contact.unreadCount}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 flex justify-around py-2">
        <Link href="/chat" className="flex flex-col items-center text-xs text-blue-500">
          <span className="text-lg">💬</span>
          Chats
        </Link>
        <Link href="/contacts" className="flex flex-col items-center text-xs text-zinc-400">
          <span className="text-lg">👥</span>
          Contacts
        </Link>
        <Link href="/settings" className="flex flex-col items-center text-xs text-zinc-400">
          <span className="text-lg">⚙️</span>
          Settings
        </Link>
        <Link href="/profile" className="flex flex-col items-center text-xs text-zinc-400">
          <span className="text-lg">👤</span>
          Profile
        </Link>
      </div>
    </div>
  );
}