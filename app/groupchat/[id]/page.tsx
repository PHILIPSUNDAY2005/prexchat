"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../supabaseClient";

type Message = {
  id: string;
  group_id: string;
  sender_id: string;
  content: string | null;
  audio_url: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  sender_name?: string;
};

type Member = {
  user_id: string;
  role: string;
  first_name: string;
  username: string;
  avatar_url: string | null;
};

export default function GroupChat() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;

  const [groupName, setGroupName] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [userId, setUserId] = useState("");
  const [showMembers, setShowMembers] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    init();
  }, [groupId]);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: group } = await supabase
      .from("groups")
      .select("name")
      .eq("id", groupId)
      .single();
    if (group) setGroupName(group.name);

    await loadMessages();
    await loadMembers();

    const channel = supabase
      .channel(`group-${groupId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${groupId}` },
        () => loadMessages()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  async function loadMessages() {
    const { data } = await supabase
      .from("group_messages")
      .select("*, profiles:sender_id(first_name)")
      .eq("group_id", groupId)
      .order("created_at", { ascending: true });

    if (data) {
      const formatted = data.map((m: any) => ({
        ...m,
        sender_name: m.profiles?.first_name || "Unknown",
      }));
      setMessages(formatted);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }

  async function loadMembers() {
    const { data } = await supabase
      .from("group_members")
      .select("user_id, role, profiles:user_id(first_name, username, avatar_url)")
      .eq("group_id", groupId);

    if (data) {
      const formatted = data.map((m: any) => ({
        user_id: m.user_id,
        role: m.role,
        first_name: m.profiles?.first_name || "Unknown",
        username: m.profiles?.username || "",
        avatar_url: m.profiles?.avatar_url || null,
      }));
      setMembers(formatted);
    }
  }

  async function sendMessage() {
    if (!newMessage.trim()) return;

    await supabase.from("group_messages").insert({
      group_id: groupId,
      sender_id: userId,
      content: newMessage.trim(),
    });

    setNewMessage("");
    loadMessages();
  }

  return (
    <div className="flex flex-col h-screen bg-[#0B1120] text-white">
      <div className="flex items-center justify-between p-3 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <button onClick={() => router.push("/chat")} className="text-zinc-400">
            ←
          </button>
          <p className="font-semibold">{groupName}</p>
        </div>
        <button onClick={() => setShowMembers(!showMembers)} className="text-xs text-blue-400">
          {members.length} members
        </button>
      </div>

      {showMembers && (
        <div className="bg-zinc-900 border-b border-zinc-800 p-3 max-h-48 overflow-y-auto">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center gap-2 py-1">
              <div className="w-7 h-7 rounded-full bg-zinc-600 overflow-hidden flex items-center justify-center text-xs">
                {m.avatar_url ? (
                  <img src={m.avatar_url} className="w-full h-full object-cover" />
                ) : (
                  m.first_name?.[0]?.toUpperCase()
                )}
              </div>
              <p className="text-xs">
                {m.first_name} {m.role === "admin" && <span className="text-blue-400">(admin)</span>}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col max-w-[75%] ${
              m.sender_id === userId ? "ml-auto items-end" : "items-start"
            }`}
          >
            {m.sender_id !== userId && (
              <p className="text-[10px] text-zinc-500 mb-0.5">{m.sender_name}</p>
            )}
            <div
              className={`px-3 py-2 rounded-lg text-sm ${
                m.sender_id === userId ? "bg-blue-600" : "bg-zinc-800"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-2 p-3 bg-zinc-900 border-t border-zinc-800">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Type a message..."
          className="flex-1 p-2 rounded-lg text-sm outline-none text-black"
        />
        <button onClick={() => router.push(`/groupinfo/${groupId}`)} className="text-xs text-blue-400">
          {members.length} members
        </button>
      </div>
    </div>
  );
}