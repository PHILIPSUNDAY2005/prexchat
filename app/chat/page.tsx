"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import Link from "next/link";

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

export default function Chat() {
  const [userId, setUserId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [contacts, setContacts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [activeContact, setActiveContact] = useState<null | { id: string; first_name: string }>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [contactIsTyping, setContactIsTyping] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const activeChannelRef = useRef<any>(null);
  const pollIntervalRef = useRef<any>(null);
  const typingTimeoutRef = useRef<any>(null);
  const lastTypingSentRef = useRef<number>(0);

  useEffect(() => {
    async function getUser() {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setUserId(data.user.id);
        setFirstName(data.user.user_metadata.first_name || "");
        loadContacts(data.user.id);
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
    };
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  async function loadContacts(myId: string) {
    const { data: contactRows } = await supabase
      .from("contacts")
      .select("contact_id, profiles:contact_id(id, first_name)")
      .eq("user_id", myId);

    if (!contactRows) return;

    const profiles = contactRows.map((row: any) => row.profiles);

    const contactsWithLastMessage = await Promise.all(
      profiles.map(async (contact: any) => {
        const { data: lastMsg } = await supabase
          .from("messages")
          .select("content, audio_url, created_at")
          .or(
            `and(sender_id.eq.${myId},receiver_id.eq.${contact.id}),and(sender_id.eq.${contact.id},receiver_id.eq.${myId})`
          )
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          ...contact,
          lastMessage: lastMsg?.audio_url ? "🎤 Voice note" : lastMsg?.content || "Say hi 👋",
          lastTime: lastMsg?.created_at || null,
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

  async function openChat(contact: { id: string; first_name: string }) {
    setActiveContact(contact);
    setContactIsTyping(false);

    const initialMessages = await fetchMessages(userId, contact.id);
    setMessages(initialMessages);

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
      .subscribe();

    activeChannelRef.current = channel;

    pollIntervalRef.current = setInterval(async () => {
      const freshData = await fetchMessages(userId, contact.id);
      setMessages(freshData);
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
    setActiveContact(null);
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

  if (activeContact) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
        <div className="bg-zinc-900 p-3 flex items-center gap-3">
          <button
            onClick={closeChat}
            className="text-white text-lg px-1"
          >
            ←
          </button>
          <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center font-bold text-sm flex-shrink-0">
            {activeContact.first_name?.charAt(0)}
          </div>
          <div>
            <p className="font-semibold text-sm">{activeContact.first_name}</p>
            <p className="text-xs text-zinc-400">
              {contactIsTyping ? "typing…" : "last seen recently"}
            </p>
          </div>
        </div>

        <div
          className="flex-1 p-4 flex flex-col gap-2 overflow-y-auto"
          style={{
            backgroundImage: `url("${wallpaperPattern}")`,
            backgroundRepeat: "repeat",
          }}
        >
          {messages.length === 0 && !contactIsTyping && (
            <div className="m-auto text-center text-zinc-500 text-sm">
              No messages here yet…
              <br />
              Send a message to say hi 👋
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`max-w-[70%] p-2 px-3 rounded-2xl text-sm ${
                msg.sender_id === userId
                  ? "bg-blue-500 self-end rounded-br-sm"
                  : "bg-zinc-800 self-start rounded-bl-sm"
              }`}
            >
              {msg.audio_url ? (
                <audio controls src={msg.audio_url} className="max-w-[220px]" />
              ) : (
                msg.content
              )}
            </div>
          ))}

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

      <div>
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
              <div className="w-11 h-11 rounded-full bg-blue-500 flex items-center justify-center font-bold flex-shrink-0">
                {contact.first_name?.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-semibold">{contact.first_name}</p>
                <p className="text-xs text-zinc-400 truncate max-w-[200px]">
                  {contact.lastMessage}
                </p>
              </div>
            </div>
            <span className="text-xs text-zinc-500 flex-shrink-0">
              {formatTime(contact.lastTime)}
            </span>
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