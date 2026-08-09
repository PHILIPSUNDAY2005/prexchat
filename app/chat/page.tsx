"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import Link from "next/link";
import CallScreen from "../CallScreen";
import { getOrCreateKeyPair, exportPublicKeyBase64, importPublicKeyBase64, deriveSharedKey, encryptText, decryptText } from "../crypto";
import { startRingtone, stopRingtone } from "../ringtone";

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
const reactionEmojis = ["❤️", "😂", "😮", "😢", "🙏", "👍"];

function getReplyPreview(replyMsg: any) {
  if (!replyMsg) return "";
  if (replyMsg.deleted_for_everyone) return "🚫 This message was deleted";
  if (replyMsg.audio_url) return "🎤 Voice note";
  if (replyMsg.media_type === "video") return "🎥 Video";
  if (replyMsg.media_type === "image") return "📷 Photo";
  return replyMsg.content || "";
}

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
  const [activeCall, setActiveCall] = useState<{ type: "audio" | "video"; channelName: string; status: "calling" | "ringing" | "connected" } | null>(null);
  const [incomingCall, setIncomingCall] = useState<{ type: "audio" | "video"; channelName: string; callerName: string } | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Record<string, { emoji: string; user_id: string }[]>>({});
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [contextMenuFor, setContextMenuFor] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [swipeOffsets, setSwipeOffsets] = useState<Record<string, number>>({});
  const [myKeyPair, setMyKeyPair] = useState<CryptoKeyPair | null>(null);
  const [contactMenuFor, setContactMenuFor] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: "delete" | "clear" | "block"; contact: any } | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearchingMessages, setIsSearchingMessages] = useState(false);
  const [listFilter, setListFilter] = useState<"all" | "unread" | "groups">("all");

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
  const touchStartXRef = useRef<number>(0);
  const touchStartIdRef = useRef<string | null>(null);
  const suppressClickRef = useRef<boolean>(false);
  const listLongPressRef = useRef<any>(null);
  const relationshipsRef = useRef<Record<string, any>>({});
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const searchDebounceRef = useRef<any>(null);

  function handleMessagesScroll() {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const near = distance < 120;
    setIsNearBottom(near);
    setShowScrollButton(!near);
  }

  function scrollToBottom(smooth = true) {
    const el = messagesContainerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }

  useEffect(() => {
    async function getUser() {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setUserId(data.user.id);
        setFirstName(data.user.user_metadata.first_name || "");

        const keyPair = await getOrCreateKeyPair(data.user.id);
        setMyKeyPair(keyPair);
        const myPublicKeyB64 = await exportPublicKeyBase64(keyPair.publicKey);
        await supabase.from("profiles").update({ public_key: myPublicKeyB64 }).eq("id", data.user.id);

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

              const isMuted = relationshipsRef.current[newMsg.sender_id]?.muted;

              if (!isMuted && !isViewingThisChat && "Notification" in window && Notification.permission === "granted") {
                const senderContact = contactsRef.current.find((c) => c.id === newMsg.sender_id);
                const senderName = senderContact?.first_name || "New message";
                const preview = newMsg.is_encrypted
                  ? "New message"
                  : newMsg.call_status === "missed"
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

  useEffect(() => {
    if (isNearBottom) scrollToBottom(false);
  }, [messages.length]);

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
      .select("contact_id, profiles:contact_id(id, first_name, last_active, avatar_url, public_key)")
      .eq("user_id", myId);

    if (!contactRows) return;

    const profiles = contactRows.map((row: any) => row.profiles);

    const { data: relRows } = await supabase
      .from("chat_relationships")
      .select("contact_id, muted, blocked, deleted_at")
      .eq("user_id", myId);

    const relMap: Record<string, any> = {};
    (relRows || []).forEach((r: any) => {
      relMap[r.contact_id] = r;
    });
    relationshipsRef.current = relMap;

    const contactsWithLastMessage = await Promise.all(
      profiles.map(async (contact: any) => {
        const { data: lastMsg } = await supabase
          .from("messages")
          .select("content, audio_url, media_url, media_type, call_type, call_status, created_at, hidden_for, is_encrypted, encrypted_content, iv, deleted_for_everyone")
          .or(
            `and(sender_id.eq.${myId},receiver_id.eq.${contact.id}),and(sender_id.eq.${contact.id},receiver_id.eq.${myId})`
          )
          .order("created_at", { ascending: false })
          .limit(5);

        const visibleLastMsg = (lastMsg || []).find((m: any) => !(m.hidden_for || []).includes(myId));

        const { count: unreadCount } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("sender_id", contact.id)
          .eq("receiver_id", myId)
          .eq("seen", false);

        let preview = "Say hi 👋";

        if (visibleLastMsg?.deleted_for_everyone) {
          preview = "🚫 This message was deleted";
        } else if (visibleLastMsg?.call_status === "missed") {
          preview = `📵 Missed ${visibleLastMsg.call_type === "video" ? "video" : "voice"} call`;
        } else if (visibleLastMsg?.audio_url) {
          preview = "🎤 Voice note";
        } else if (visibleLastMsg?.media_type === "video") {
          preview = "🎥 Video";
        } else if (visibleLastMsg?.media_type === "image") {
          preview = "📷 Photo";
        } else if (visibleLastMsg?.is_encrypted) {
          if (visibleLastMsg?.encrypted_content && visibleLastMsg?.iv) {
            const sharedKey = await getSharedKeyForContact(contact.id);
            if (sharedKey) {
              try {
                preview = await decryptText(sharedKey, visibleLastMsg.encrypted_content, visibleLastMsg.iv);
              } catch {
                preview = "🔒 Unable to decrypt";
              }
            } else {
              preview = "🔒 Encrypted message";
            }
          } else {
            preview = "🔒 Encrypted message";
          }
        } else if (visibleLastMsg?.content) {
          preview = visibleLastMsg.content;
        }

        const relationship = relMap[contact.id] || { muted: false, blocked: false, deleted_at: null };

        return {
          ...contact,
          lastMessage: preview,
          lastTime: visibleLastMsg?.created_at || null,
          lastCreatedAt: visibleLastMsg?.created_at || null,
          unreadCount: unreadCount || 0,
          relationship,
        };
      })
    );

    const visible = contactsWithLastMessage.filter((c) => {
      if (!c.relationship.deleted_at) return true;
      if (!c.lastCreatedAt) return false;
      return new Date(c.lastCreatedAt) > new Date(c.relationship.deleted_at);
    });

    setContacts(visible);
  }

  async function upsertRelationship(contactId: string, updates: any) {
    const current = relationshipsRef.current[contactId] || { muted: false, blocked: false, deleted_at: null };
    const merged = { ...current, ...updates };

    await supabase
      .from("chat_relationships")
      .upsert(
        { user_id: userId, contact_id: contactId, muted: merged.muted, blocked: merged.blocked, deleted_at: merged.deleted_at },
        { onConflict: "user_id,contact_id" }
      );

    relationshipsRef.current[contactId] = merged;
    loadContacts(userId);
  }

  async function handleDeleteConversation(contact: any) {
    await upsertRelationship(contact.id, { deleted_at: new Date().toISOString() });
    setConfirmAction(null);
    setContactMenuFor(null);
  }

  async function handleClearChat(contact: any) {
    const { data } = await supabase
      .from("messages")
      .select("id, hidden_for")
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${contact.id}),and(sender_id.eq.${contact.id},receiver_id.eq.${userId})`);

    if (data) {
      for (const m of data) {
        if (!(m.hidden_for || []).includes(userId)) {
          const newHidden = [...(m.hidden_for || []), userId];
          await supabase.from("messages").update({ hidden_for: newHidden }).eq("id", m.id);
        }
      }
    }

    if (activeContact?.id === contact.id) {
      const fresh = await fetchMessages(userId, contact.id);
      setMessages(fresh);
      loadReactions(fresh);
    }

    loadContacts(userId);
    setConfirmAction(null);
    setContactMenuFor(null);
  }

  async function handleToggleBlock(contact: any) {
    const current = relationshipsRef.current[contact.id] || { blocked: false };
    await upsertRelationship(contact.id, { blocked: !current.blocked });
    setConfirmAction(null);
    setContactMenuFor(null);
  }

  async function handleToggleMute(contact: any) {
    const current = relationshipsRef.current[contact.id] || { muted: false };
    await upsertRelationship(contact.id, { muted: !current.muted });
    setContactMenuFor(null);
  }

  function startListLongPress(contactId: string) {
    listLongPressRef.current = setTimeout(() => {
      setContactMenuFor(contactId);
    }, 500);
  }

  function cancelListLongPress() {
    if (listLongPressRef.current) clearTimeout(listLongPressRef.current);
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

  async function getSharedKeyForContact(contactId: string): Promise<CryptoKey | null> {
    if (!myKeyPair) return null;
    const { data } = await supabase.from("profiles").select("public_key").eq("id", contactId).maybeSingle();
    if (!data?.public_key) return null;
    try {
      const theirPublicKey = await importPublicKeyBase64(data.public_key);
      return await deriveSharedKey(myKeyPair.privateKey, theirPublicKey);
    } catch {
      return null;
    }
  }

  async function searchMessages(term: string) {
    if (term.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearchingMessages(true);

    const { data } = await supabase
      .from("messages")
      .select("id, sender_id, receiver_id, content, encrypted_content, iv, is_encrypted, deleted_for_everyone, hidden_for, created_at")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .eq("deleted_for_everyone", false)
      .order("created_at", { ascending: false })
      .limit(300);

    const visible = (data || []).filter((m: any) => !(m.hidden_for || []).includes(userId));

    const byContact: Record<string, any[]> = {};
    visible.forEach((m: any) => {
      const otherId = m.sender_id === userId ? m.receiver_id : m.sender_id;
      if (!byContact[otherId]) byContact[otherId] = [];
      byContact[otherId].push(m);
    });

    const lowerTerm = term.toLowerCase();
    const matches: any[] = [];

    for (const contactId of Object.keys(byContact)) {
      const contact = contacts.find((c) => c.id === contactId);
      if (!contact) continue;

      const sharedKey = await getSharedKeyForContact(contactId);

      for (const m of byContact[contactId]) {
        let text = m.content;
        if (m.is_encrypted && m.encrypted_content && m.iv && sharedKey) {
          try {
            text = await decryptText(sharedKey, m.encrypted_content, m.iv);
          } catch {
            continue;
          }
        }
        if (text && text.toLowerCase().includes(lowerTerm)) {
          matches.push({ ...m, decryptedText: text, contact });
        }
      }
    }

    setSearchResults(matches);
    setIsSearchingMessages(false);
  }

  async function fetchMessages(myId: string, contactId: string) {
    const { data } = await supabase
      .from("messages")
      .select("*, reply_to:reply_to_id(id, content, encrypted_content, iv, is_encrypted, sender_id, deleted_for_everyone)")
      .or(
        `and(sender_id.eq.${myId},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${myId})`
      )
      .order("created_at", { ascending: true });

    const all = (data || []).filter((m: any) => !(m.hidden_for || []).includes(myId));

    const sharedKey = await getSharedKeyForContact(contactId);

    for (const m of all) {
      if (m.deleted_for_everyone) continue;
      if (m.is_encrypted && m.encrypted_content && m.iv && sharedKey) {
        try {
          m.content = await decryptText(sharedKey, m.encrypted_content, m.iv);
        } catch {
          m.content = "🔒 Unable to decrypt";
        }
      }
      if (m.reply_to && !m.reply_to.deleted_for_everyone && m.reply_to.is_encrypted && m.reply_to.encrypted_content && m.reply_to.iv && sharedKey) {
        try {
          m.reply_to.content = await decryptText(sharedKey, m.reply_to.encrypted_content, m.reply_to.iv);
        } catch {
          m.reply_to.content = "🔒 Unable to decrypt";
        }
      }
    }

    return all;
  }

  async function loadReactions(msgs: any[]) {
    if (msgs.length === 0) return;
    const ids = msgs.map((m) => m.id);

    const { data } = await supabase
      .from("message_reactions")
      .select("message_id, emoji, user_id")
      .in("message_id", ids);

    if (data) {
      const grouped: Record<string, { emoji: string; user_id: string }[]> = {};
      data.forEach((r: any) => {
        if (!grouped[r.message_id]) grouped[r.message_id] = [];
        grouped[r.message_id].push({ emoji: r.emoji, user_id: r.user_id });
      });
      setReactions(grouped);
    }
  }

  async function toggleReaction(messageId: string, emoji: string) {
    const existing = reactions[messageId]?.find((r) => r.user_id === userId);

    if (existing && existing.emoji === emoji) {
      await supabase
        .from("message_reactions")
        .delete()
        .eq("message_id", messageId)
        .eq("user_id", userId);
    } else {
      await supabase
        .from("message_reactions")
        .upsert(
          { message_id: messageId, user_id: userId, emoji },
          { onConflict: "message_id,user_id" }
        );
    }

    setReactionPickerFor(null);
    const freshMessages = await fetchMessages(userId, activeContact.id);
    setMessages(freshMessages);
    loadReactions(freshMessages);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function cancelSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  async function deleteForEveryone(msg: any) {
    const { error } = await supabase.rpc("delete_message_for_everyone", { msg_id: msg.id });
    if (error) {
      alert("Could not delete: " + error.message);
      return;
    }
    const fresh = await fetchMessages(userId, activeContact.id);
    setMessages(fresh);
    loadReactions(fresh);
    loadContacts(userId);
  }

  async function deleteForMeSingle(msg: any) {
    const newHidden = [...(msg.hidden_for || []), userId];
    await supabase.from("messages").update({ hidden_for: newHidden }).eq("id", msg.id);
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    loadContacts(userId);
  }

  async function deleteSelectedForMe() {
    for (const id of Array.from(selectedIds)) {
      const msg = messages.find((m) => m.id === id);
      if (msg) await deleteForMeSingle(msg);
    }
    cancelSelectMode();
  }

  function handleBubbleClick(msg: any) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (selectMode) {
      toggleSelect(msg.id);
      return;
    }
    setContextMenuFor(msg.id);
  }

  function handleBubbleContextMenu(e: React.MouseEvent, msg: any) {
    e.preventDefault();
    if (selectMode) return;
    setContextMenuFor(msg.id);
  }

  function handleTouchStart(e: React.TouchEvent, msg: any) {
    if (selectMode) return;
    touchStartXRef.current = e.touches[0].clientX;
    touchStartIdRef.current = msg.id;
  }

  function handleTouchMove(e: React.TouchEvent, msg: any) {
    if (selectMode || touchStartIdRef.current !== msg.id) return;
    const diff = e.touches[0].clientX - touchStartXRef.current;
    if (diff > 0) {
      setSwipeOffsets((prev) => ({ ...prev, [msg.id]: Math.min(diff, 80) }));
    }
  }

  function handleTouchEnd(msg: any) {
    if (selectMode) return;
    const offset = swipeOffsets[msg.id] || 0;
    if (offset > 50) {
      setReplyingTo(msg);
      setContextMenuFor(null);
      suppressClickRef.current = true;
    }
    setSwipeOffsets((prev) => ({ ...prev, [msg.id]: 0 }));
    touchStartIdRef.current = null;
  }

  async function openChat(contact: any) {
    setActiveContact(contact);
    setContactIsTyping(false);
    setShowEmojiPicker(false);
    setReplyingTo(null);
    setContextMenuFor(null);
    setSelectMode(false);
    setSelectedIds(new Set());
    setIsNearBottom(true);
    setShowScrollButton(false);

    const initialMessages = await fetchMessages(userId, contact.id);
    setMessages(initialMessages);
    loadReactions(initialMessages);

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
        async (payload) => {
          const newMsg = payload.new as any;
          const isRelevant =
            (newMsg.sender_id === userId && newMsg.receiver_id === contact.id) ||
            (newMsg.sender_id === contact.id && newMsg.receiver_id === userId);

          if (isRelevant) {
            const fresh = await fetchMessages(userId, contact.id);
            setMessages(fresh);
            loadReactions(fresh);
            loadContacts(userId);

            if (newMsg.sender_id === contact.id) {
              supabase.from("messages").update({ seen: true }).eq("id", newMsg.id);
            }
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        async (payload) => {
          const updatedMsg = payload.new as any;
          const isRelevant =
            (updatedMsg.sender_id === userId && updatedMsg.receiver_id === contact.id) ||
            (updatedMsg.sender_id === contact.id && updatedMsg.receiver_id === userId);

          if (isRelevant) {
            const fresh = await fetchMessages(userId, contact.id);
            setMessages(fresh);
            loadReactions(fresh);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        () => {
          setMessages((prev) => {
            loadReactions(prev);
            return prev;
          });
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
          startRingtone("incoming");
        }
      })
      .on("broadcast", { event: "call-accepted" }, (payload) => {
        if (payload.payload.senderId === contact.id) {
          stopRingtone();
          if (missedCallTimeoutRef.current) clearTimeout(missedCallTimeoutRef.current);
          setActiveCall((prev) => (prev ? { ...prev, status: "connected" } : prev));
        }
      })
      .on("broadcast", { event: "call-declined" }, (payload) => {
        if (payload.payload.senderId === contact.id) {
          stopRingtone();
          if (missedCallTimeoutRef.current) clearTimeout(missedCallTimeoutRef.current);
          setActiveCall(null);
        }
      })
      .on("broadcast", { event: "call-ended" }, (payload) => {
        if (payload.payload.senderId === contact.id) {
          stopRingtone();
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
      loadReactions(freshData);

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
    setReactionPickerFor(null);
    setReplyingTo(null);
    setContextMenuFor(null);
    setSelectMode(false);
    setSelectedIds(new Set());
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
    if (activeContact.relationship?.blocked) return;

    const channelName = buildCallChannelName(userId, activeContact.id);
    const recipientOnline = isOnline(activeContact.last_active);

    activeChannelRef.current.send({
      type: "broadcast",
      event: "call-invite",
      payload: { senderId: userId, callType: type, channelName },
    });

    setActiveCall({ type, channelName, status: recipientOnline ? "ringing" : "calling" });

    if (recipientOnline) {
      startRingtone("outgoing");
    }

    if (missedCallTimeoutRef.current) clearTimeout(missedCallTimeoutRef.current);
    missedCallTimeoutRef.current = setTimeout(async () => {
      stopRingtone();
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
    stopRingtone();
    if (missedCallTimeoutRef.current) clearTimeout(missedCallTimeoutRef.current);
    if (activeChannelRef.current) {
      activeChannelRef.current.send({
        type: "broadcast",
        event: "call-accepted",
        payload: { senderId: userId },
      });
    }
    setActiveCall({ type: incomingCall.type, channelName: incomingCall.channelName, status: "connected" });
    setIncomingCall(null);
  }

  function declineIncomingCall() {
    stopRingtone();
    if (activeChannelRef.current) {
      activeChannelRef.current.send({
        type: "broadcast",
        event: "call-declined",
        payload: { senderId: userId },
      });
    }
    setIncomingCall(null);
  }

  function endCall() {
    stopRingtone();
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
    if (activeContact.relationship?.blocked) return;

    const insertPayload: any = {
      sender_id: userId,
      receiver_id: activeContact.id,
      reply_to_id: replyingTo ? replyingTo.id : null,
    };

    const sharedKey = await getSharedKeyForContact(activeContact.id);

    if (sharedKey) {
      const { ciphertext, iv } = await encryptText(sharedKey, newMessage);
      insertPayload.encrypted_content = ciphertext;
      insertPayload.iv = iv;
      insertPayload.is_encrypted = true;
    } else {
      insertPayload.content = newMessage;
    }

    const { error } = await supabase.from("messages").insert(insertPayload);

    if (!error) {
      setNewMessage("");
      setReplyingTo(null);
      const fresh = await fetchMessages(userId, activeContact.id);
      setMessages(fresh);
      loadReactions(fresh);
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
      stream.getTracks().forEach((t) => t.stop());
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
    if (activeContact.relationship?.blocked) return;

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

    const { error } = await supabase.from("messages").insert({
      sender_id: userId,
      receiver_id: activeContact.id,
      audio_url: urlData.publicUrl,
      reply_to_id: replyingTo ? replyingTo.id : null,
    });

    if (!error) {
      setReplyingTo(null);
      const fresh = await fetchMessages(userId, activeContact.id);
      setMessages(fresh);
      loadReactions(fresh);
      loadContacts(userId);
    }
  }

  async function uploadOneMedia(file: File, replyId: string | null) {
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

    await supabase.from("messages").insert({
      sender_id: userId,
      receiver_id: activeContact.id,
      media_url: urlData.publicUrl,
      media_type: isVideo ? "video" : "image",
      reply_to_id: replyId,
    });
  }

  async function uploadMultipleMedia(files: FileList) {
    if (!activeContact || activeContact.relationship?.blocked) return;
    const replyId = replyingTo ? replyingTo.id : null;
    for (const file of Array.from(files)) {
      await uploadOneMedia(file, replyId);
    }
    setReplyingTo(null);
    const fresh = await fetchMessages(userId, activeContact.id);
    setMessages(fresh);
    loadReactions(fresh);
    loadContacts(userId);
  }

  if (activeCall) {
    return (
      <CallScreen
        channelName={activeCall.channelName}
        callType={activeCall.type}
        contactName={activeContact?.first_name || "Contact"}
        contactAvatar={activeContact?.avatar_url}
        initialStatusText={activeCall.status === "ringing" ? "Ringing…" : "Calling…"}
        onConnected={() => {
          stopRingtone();
          if (missedCallTimeoutRef.current) clearTimeout(missedCallTimeoutRef.current);
        }}
        onEnd={endCall}
      />
    );
  }

  if (activeContact) {
    return (
      <div className="h-screen overflow-hidden bg-zinc-950 text-white flex flex-col">
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
                className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center"
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="white" style={{ transform: "rotate(135deg)" }}>
                  <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24 11.36 11.36 0 003.57.57 1 1 0 011 1V20a1 1 0 01-1 1C10.61 21 3 13.39 3 4a1 1 0 011-1h3.49a1 1 0 011 1 11.36 11.36 0 00.57 3.57 1 1 0 01-.25 1.01l-2.2 2.21z" />
                </svg>
              </button>
              <button
                onClick={acceptIncomingCall}
                className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center"
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
                  <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24 11.36 11.36 0 003.57.57 1 1 0 011 1V20a1 1 0 01-1 1C10.61 21 3 13.39 3 4a1 1 0 011-1h3.49a1 1 0 011 1 11.36 11.36 0 00.57 3.57 1 1 0 01-.25 1.01l-2.2 2.21z" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {(reactionPickerFor || contextMenuFor) && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setReactionPickerFor(null);
              setContextMenuFor(null);
            }}
          />
        )}

        <div className="bg-zinc-900 p-3 flex items-center justify-between flex-shrink-0">
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
              <p className="text-xs text-zinc-400 flex items-center gap-1">
                {activeContact.public_key && <span title="End-to-end encrypted">🔒</span>}
                {contactIsTyping
                  ? "typing…"
                  : isOnline(activeContact.last_active)
                  ? "online"
                  : "last seen recently"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-lg pr-1">
            {!activeContact.relationship?.blocked && (
              <>
                <button onClick={() => startCall("video")} title="Video call">🎥</button>
                <button onClick={() => startCall("audio")} title="Voice call">📞</button>
              </>
            )}
          </div>
        </div>

        {activeContact.relationship?.blocked && (
          <div className="bg-red-500/10 border-b border-red-500/30 px-4 py-2 flex items-center justify-between flex-shrink-0">
            <span className="text-xs text-red-400">🚫 You blocked this contact</span>
            <button
              onClick={() => handleToggleBlock(activeContact)}
              className="text-xs text-blue-400"
            >
              Unblock
            </button>
          </div>
        )}

        {selectMode && (
          <div className="bg-zinc-900 border-b border-zinc-800 px-3 py-2 flex items-center justify-between flex-shrink-0">
            <button onClick={cancelSelectMode} className="text-sm text-zinc-300">
              Cancel
            </button>
            <span className="text-sm text-zinc-400">{selectedIds.size} selected</span>
            <button
              onClick={deleteSelectedForMe}
              disabled={selectedIds.size === 0}
              className="text-sm text-red-400 disabled:opacity-40"
            >
              Delete for me
            </button>
          </div>
        )}

        <div
          ref={messagesContainerRef}
          onScroll={handleMessagesScroll}
          className="flex-1 p-4 flex flex-col gap-2 overflow-y-auto relative min-h-0"
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
              <div key={msg.id} className="flex items-center gap-2 w-full">
                {selectMode && <div className="w-5 flex-shrink-0" />}
                <div
                  className={`flex-1 flex ${msg.sender_id === userId ? "justify-end" : "justify-start"}`}
                >
                  <div className="max-w-[75%] flex items-center gap-2 p-2 px-3 rounded-2xl text-sm bg-zinc-800/60">
                    <span className="text-red-400">📵</span>
                    <span className="text-zinc-300">
                      {msg.sender_id === userId
                        ? `Missed ${msg.call_type === "video" ? "video" : "voice"} call`
                        : `Missed ${msg.call_type === "video" ? "video" : "voice"} call from ${activeContact.first_name}`}
                    </span>
                  </div>
                </div>
              </div>
            ) : msg.deleted_for_everyone ? (
              <div key={msg.id} className="flex items-center gap-2 w-full">
                {selectMode && <div className="w-5 flex-shrink-0" />}
                <div className={`flex-1 flex ${msg.sender_id === userId ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[70%] p-2 px-3 rounded-2xl text-sm bg-zinc-800/40 text-zinc-500 italic">
                    🚫 This message was deleted
                  </div>
                </div>
              </div>
            ) : (
              <div key={msg.id} className="flex items-center gap-2 w-full">
                {selectMode && (
                  <button
                    onClick={() => toggleSelect(msg.id)}
                    className={`w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center text-[10px] ${
                      selectedIds.has(msg.id) ? "bg-blue-500 border-blue-500" : "border-zinc-500"
                    }`}
                  >
                    {selectedIds.has(msg.id) && "✓"}
                  </button>
                )}

                <div
                  className={`flex-1 flex ${msg.sender_id === userId ? "justify-end" : "justify-start"}`}
                >
                  <div className="relative max-w-[70%] flex flex-col">
                    {contextMenuFor === msg.id && (
                      <div
                        className={`absolute -top-2 z-50 bg-zinc-800 rounded-lg shadow-lg overflow-hidden text-sm w-48 ${
                          msg.sender_id === userId ? "right-0" : "left-0"
                        }`}
                        style={{ transform: "translateY(-100%)" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            setReplyingTo(msg);
                            setContextMenuFor(null);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-zinc-700"
                        >
                          ↩ Reply
                        </button>
                        <button
                          onClick={() => {
                            setSelectMode(true);
                            setSelectedIds(new Set([msg.id]));
                            setContextMenuFor(null);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-zinc-700"
                        >
                          ☑ Select
                        </button>
                        <button
                          onClick={() => {
                            setReactionPickerFor(msg.id);
                            setContextMenuFor(null);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-zinc-700"
                        >
                          ❤️ React
                        </button>
                        <button
                          onClick={() => {
                            deleteForMeSingle(msg);
                            setContextMenuFor(null);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-zinc-700 text-red-400"
                        >
                          🗑 Delete for me
                        </button>
                        {msg.sender_id === userId && (
                          <button
                            onClick={() => {
                              deleteForEveryone(msg);
                              setContextMenuFor(null);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-zinc-700 text-red-500 font-semibold"
                          >
                            🗑️ Delete for everyone
                          </button>
                        )}
                      </div>
                    )}

                    {reactionPickerFor === msg.id && (
                      <div
                        className={`absolute -top-12 z-50 bg-zinc-800 rounded-full px-2 py-1 flex gap-1 shadow-lg ${
                          msg.sender_id === userId ? "right-0" : "left-0"
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {reactionEmojis.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => toggleReaction(msg.id, emoji)}
                            className="text-xl hover:scale-125 transition-transform p-1"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="relative">
                      {(swipeOffsets[msg.id] || 0) > 10 && (
                        <span
                          className="absolute top-1/2 -translate-y-1/2 -left-7 text-lg"
                          style={{ opacity: Math.min((swipeOffsets[msg.id] || 0) / 50, 1) }}
                        >
                          ↩
                        </span>
                      )}
                      <div
                        onClick={() => handleBubbleClick(msg)}
                        onContextMenu={(e) => handleBubbleContextMenu(e, msg)}
                        onTouchStart={(e) => handleTouchStart(e, msg)}
                        onTouchMove={(e) => handleTouchMove(e, msg)}
                        onTouchEnd={() => handleTouchEnd(msg)}
                        style={{
                          transform: `translateX(${swipeOffsets[msg.id] || 0}px)`,
                          transition: swipeOffsets[msg.id] ? "none" : "transform 0.2s",
                        }}
                        className={`p-2 px-3 rounded-2xl text-sm select-none cursor-pointer ${
                          msg.sender_id === userId
                            ? "bg-blue-500 rounded-br-sm"
                            : "bg-zinc-800 rounded-bl-sm"
                        }`}
                      >
                        {msg.reply_to && (
                          <div
                            className={`mb-1 pl-2 border-l-2 rounded text-xs opacity-80 ${
                              msg.sender_id === userId ? "border-white/60" : "border-blue-400"
                            }`}
                          >
                            <p className="font-semibold">
                              {msg.reply_to.sender_id === userId ? "You" : activeContact.first_name}
                            </p>
                            <p className="truncate max-w-[200px]">{getReplyPreview(msg.reply_to)}</p>
                          </div>
                        )}

                        {msg.audio_url ? (
                          <div onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
                            <VoiceNotePlayer src={msg.audio_url} isMine={msg.sender_id === userId} />
                          </div>
                        ) : msg.media_url ? (
                          <div onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
                            {msg.media_type === "video" ? (
                              <video controls src={msg.media_url} className="max-w-[220px] rounded-lg" />
                            ) : (
                              <img src={msg.media_url} alt="Shared photo" className="max-w-[220px] rounded-lg" />
                            )}
                          </div>
                        ) : (
                          msg.content
                        )}
                      </div>
                    </div>

                    {reactions[msg.id] && reactions[msg.id].length > 0 && (
                      <div
                        className={`flex gap-1 -mt-2 bg-zinc-900 rounded-full px-1.5 py-0.5 border border-zinc-800 self-start ${
                          msg.sender_id === userId ? "self-end mr-2" : "ml-2"
                        }`}
                      >
                        {Array.from(new Set(reactions[msg.id].map((r) => r.emoji))).map((emoji) => (
                          <span key={emoji} className="text-xs">
                            {emoji}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
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

          {showScrollButton && (
            <button
              onClick={() => scrollToBottom(true)}
              className="sticky bottom-2 self-center bg-zinc-800 border border-zinc-700 w-9 h-9 rounded-full flex items-center justify-center shadow-lg z-30"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M12 4v16M12 20l-6-6M12 20l6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>

        {replyingTo && (
          <div className="bg-zinc-800 border-t border-zinc-700 px-3 py-2 flex items-center gap-2 flex-shrink-0">
            <div className="flex-1 border-l-4 border-blue-500 pl-2 min-w-0">
              <p className="text-xs font-semibold text-blue-400">
                {replyingTo.sender_id === userId ? "You" : activeContact.first_name}
              </p>
              <p className="text-xs text-zinc-300 truncate">{getReplyPreview(replyingTo)}</p>
            </div>
            <button onClick={() => setReplyingTo(null)} className="text-zinc-400 text-lg px-2 flex-shrink-0">
              ✕
            </button>
          </div>
        )}

        <div className="p-2 bg-zinc-900 flex items-center gap-2 flex-shrink-0">
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
            placeholder={activeContact.relationship?.blocked ? "You blocked this contact" : "Message"}
            disabled={activeContact.relationship?.blocked}
            className="flex-1 p-3 rounded-full text-sm outline-none bg-zinc-800 text-white disabled:opacity-50"
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
              {isRecording ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                  <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          )}
        </div>

        {showEmojiPicker && (
          <div className="bg-zinc-900 border-t border-zinc-800 p-3 grid grid-cols-8 gap-2 flex-shrink-0">
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

  const filteredContacts = contacts
    .filter((c) => c.first_name?.toLowerCase().includes(search.toLowerCase()))
    .filter((c) => {
      if (listFilter === "unread") return c.unreadCount > 0;
      if (listFilter === "groups") return false;
      return true;
    });

  const filteredGroups = listFilter === "unread" ? [] : groups;

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
          onChange={(e) => {
            const value = e.target.value;
            setSearch(value);
            if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
            searchDebounceRef.current = setTimeout(() => searchMessages(value), 400);
          }}
          placeholder="Search chats and messages"
          className="w-full p-2 rounded-lg text-sm outline-none bg-zinc-800 text-white"
        />
      </div>

      {search.trim().length < 2 && (
        <div className="flex gap-2 px-3 pb-2">
          {(["all", "unread", "groups"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setListFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                listFilter === f ? "bg-green-600 text-white" : "bg-zinc-800 text-zinc-300"
              }`}
            >
              {f === "all" ? "All" : f === "unread" ? "Unread" : "Groups"}
            </button>
          ))}
        </div>
      )}

      {search.trim().length >= 2 && (
        <div>
          <p className="text-xs text-zinc-500 px-4 pt-2 pb-1">
            {isSearchingMessages ? "Searching messages…" : `Messages (${searchResults.length})`}
          </p>
          {searchResults.map((m) => (
            <div
              key={m.id}
              onClick={() => {
                setSearch("");
                setSearchResults([]);
                openChat(m.contact);
              }}
              className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 hover:bg-zinc-900 cursor-pointer"
            >
              <div className="w-11 h-11 rounded-full bg-blue-500 overflow-hidden flex items-center justify-center font-bold flex-shrink-0">
                {m.contact.avatar_url ? (
                  <img src={m.contact.avatar_url} className="w-full h-full object-cover" />
                ) : (
                  m.contact.first_name?.charAt(0)
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{m.contact.first_name}</p>
                <p className="text-xs text-zinc-400 truncate">{m.decryptedText}</p>
              </div>
            </div>
          ))}
          {!isSearchingMessages && searchResults.length === 0 && (
            <p className="text-zinc-500 text-sm px-4 pb-2">No messages found.</p>
          )}
        </div>
      )}

      {filteredGroups.length > 0 && search.trim().length < 2 && (
        <div>
          <p className="text-xs text-zinc-500 px-4 pt-2 pb-1">Groups</p>
          {filteredGroups.map((group) => (
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

      <div className={search.trim().length >= 2 || listFilter === "groups" ? "hidden" : ""}>
        {filteredGroups.length > 0 && (
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
            onContextMenu={(e) => {
              e.preventDefault();
              setContactMenuFor(contact.id);
            }}
            onMouseDown={() => startListLongPress(contact.id)}
            onMouseUp={cancelListLongPress}
            onMouseLeave={cancelListLongPress}
            onTouchStart={() => startListLongPress(contact.id)}
            onTouchEnd={cancelListLongPress}
            className="relative flex items-center justify-between px-4 py-3 border-b border-zinc-800 hover:bg-zinc-900 cursor-pointer select-none"
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
                <p className="text-sm font-semibold flex items-center gap-1">
                  {contact.first_name}
                  {contact.relationship?.muted && <span className="text-xs">🔕</span>}
                  {contact.relationship?.blocked && <span className="text-xs">🚫</span>}
                </p>
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

            {contactMenuFor === contact.id && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={(e) => {
                    e.stopPropagation();
                    setContactMenuFor(null);
                  }}
                />
                <div
                  className="absolute right-4 top-full mt-1 z-50 bg-zinc-800 rounded-lg shadow-lg overflow-hidden text-sm w-44"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => setConfirmAction({ type: "delete", contact })}
                    className="w-full text-left px-4 py-2 hover:bg-zinc-700"
                  >
                    🗑️ Delete
                  </button>
                  <button
                    onClick={() => setConfirmAction({ type: "block", contact })}
                    className="w-full text-left px-4 py-2 hover:bg-zinc-700"
                  >
                    {contact.relationship?.blocked ? "✅ Unblock" : "🚫 Block"}
                  </button>
                  <button
                    onClick={() => setConfirmAction({ type: "clear", contact })}
                    className="w-full text-left px-4 py-2 hover:bg-zinc-700"
                  >
                    🧹 Clear chat
                  </button>
                  <button
                    onClick={() => handleToggleMute(contact)}
                    className="w-full text-left px-4 py-2 hover:bg-zinc-700"
                  >
                    {contact.relationship?.muted ? "🔔 Unmute" : "🔕 Mute"}
                  </button>
                </div>
              </>
            )}
          </div>
        ))}

        {confirmAction && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-6">
            <div className="bg-zinc-900 rounded-xl p-5 w-full max-w-sm">
              <h3 className="font-semibold text-white mb-2">
                {confirmAction.type === "delete" && "Delete conversation?"}
                {confirmAction.type === "clear" && "Clear chat?"}
                {confirmAction.type === "block" &&
                  (confirmAction.contact.relationship?.blocked ? "Unblock this user?" : "Block this user?")}
              </h3>
              <p className="text-sm text-zinc-400 mb-4">
                {confirmAction.type === "delete" &&
                  "This removes the conversation from your chat list. It won't affect the other person's chats."}
                {confirmAction.type === "clear" &&
                  "This removes the messages from this conversation on your side only. The other person will still see them."}
                {confirmAction.type === "block" &&
                  (confirmAction.contact.relationship?.blocked
                    ? "They'll be able to message and call you again."
                    : "They won't be able to send you messages or calls. This won't affect your other conversations.")}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirmAction(null)}
                  className="px-4 py-2 text-sm text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (confirmAction.type === "delete") handleDeleteConversation(confirmAction.contact);
                    if (confirmAction.type === "clear") handleClearChat(confirmAction.contact);
                    if (confirmAction.type === "block") handleToggleBlock(confirmAction.contact);
                  }}
                  className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 rounded-lg text-white"
                >
                  {confirmAction.type === "block" && confirmAction.contact.relationship?.blocked ? "Unblock" : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        )}
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