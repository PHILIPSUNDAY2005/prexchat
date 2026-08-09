"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../supabaseClient";

type Member = {
  user_id: string;
  role: string;
  first_name: string;
  username: string;
  avatar_url: string | null;
};

type Contact = {
  id: string;
  first_name: string;
  username: string;
  avatar_url: string | null;
};

export default function GroupInfo() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;

  const [userId, setUserId] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupAvatar, setGroupAvatar] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [actionFor, setActionFor] = useState<Member | null>(null);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [availableContacts, setAvailableContacts] = useState<Contact[]>([]);
  const [message, setMessage] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    init();
  }, [groupId]);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    await loadGroup();
    await loadMembers(user.id);
  }

  async function loadGroup() {
    const { data } = await supabase
      .from("groups")
      .select("name, avatar_url")
      .eq("id", groupId)
      .single();

    if (data) {
      setGroupName(data.name);
      setGroupAvatar(data.avatar_url || "");
    }
  }

  async function loadMembers(myId: string) {
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
      setIsAdmin(formatted.some((m) => m.user_id === myId && m.role === "admin"));
    }
  }

  async function saveName() {
    if (!nameDraft.trim()) {
      setEditingName(false);
      return;
    }
    const { error } = await supabase.from("groups").update({ name: nameDraft.trim() }).eq("id", groupId);
    if (!error) {
      setGroupName(nameDraft.trim());
    } else {
      setMessage(error.message);
    }
    setEditingName(false);
  }

  async function handleAvatarSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const fileName = `${groupId}-${Date.now()}.${file.name.split(".").pop()}`;

    const { error: uploadError } = await supabase.storage.from("group-avatars").upload(fileName, file);
    if (uploadError) {
      setMessage("Upload failed: " + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("group-avatars").getPublicUrl(fileName);

    const { error: updateError } = await supabase
      .from("groups")
      .update({ avatar_url: urlData.publicUrl })
      .eq("id", groupId);

    if (updateError) {
      setMessage(updateError.message);
    } else {
      setGroupAvatar(urlData.publicUrl);
    }
    setUploading(false);
  }

  async function toggleAdmin(member: Member) {
    const newRole = member.role === "admin" ? "member" : "admin";
    const { error } = await supabase
      .from("group_members")
      .update({ role: newRole })
      .eq("group_id", groupId)
      .eq("user_id", member.user_id);

    if (error) {
      setMessage(error.message);
    } else {
      loadMembers(userId);
    }
    setActionFor(null);
  }

  async function removeMember(member: Member) {
    const { error } = await supabase
      .from("group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", member.user_id);

    if (error) {
      setMessage(error.message);
    } else {
      loadMembers(userId);
    }
    setActionFor(null);
  }

  async function leaveGroup() {
    if (!confirm("Leave this group?")) return;

    const { error } = await supabase
      .from("group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", userId);

    if (!error) {
      router.push("/chat");
    } else {
      setMessage(error.message);
    }
  }

  async function deleteGroup() {
    if (!confirm("Delete this group for everyone? This cannot be undone.")) return;

    const { error } = await supabase.from("groups").delete().eq("id", groupId);

    if (!error) {
      router.push("/chat");
    } else {
      setMessage(error.message);
    }
  }

  async function openAddMembers() {
    const { data: contactRows } = await supabase
      .from("contacts")
      .select("contact_id, profiles:contact_id(id, first_name, username, avatar_url)")
      .eq("user_id", userId);

    const memberIds = new Set(members.map((m) => m.user_id));

    if (contactRows) {
      const notInGroup = contactRows
        .map((row: any) => row.profiles)
        .filter((c: any) => c && !memberIds.has(c.id));
      setAvailableContacts(notInGroup);
    }
    setShowAddMembers(true);
  }

  async function addMember(contact: Contact) {
    const { error } = await supabase
      .from("group_members")
      .insert({ group_id: groupId, user_id: contact.id, role: "member" });

    if (!error) {
      setAvailableContacts((prev) => prev.filter((c) => c.id !== contact.id));
      loadMembers(userId);
    } else {
      setMessage(error.message);
    }
  }

  if (showAddMembers) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setShowAddMembers(false)} className="text-lg">←</button>
          <h1 className="text-xl font-bold">Add Members</h1>
        </div>

        <div className="space-y-2">
          {availableContacts.map((c) => (
            <div
              key={c.id}
              onClick={() => addMember(c)}
              className="flex items-center gap-3 p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 cursor-pointer"
            >
              <div className="w-9 h-9 rounded-full bg-zinc-600 overflow-hidden flex items-center justify-center text-sm">
                {c.avatar_url ? (
                  <img src={c.avatar_url} className="w-full h-full object-cover" />
                ) : (
                  c.first_name?.[0]?.toUpperCase()
                )}
              </div>
              <div>
                <p className="text-sm font-medium">{c.first_name}</p>
                <p className="text-xs text-zinc-400">@{c.username}</p>
              </div>
            </div>
          ))}
          {availableContacts.length === 0 && (
            <p className="text-zinc-500 text-sm">All your contacts are already in this group.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-10">
      <div className="bg-zinc-900 p-4 flex items-center gap-3">
        <button onClick={() => router.push(`/groupchat/${groupId}`)} className="text-lg">←</button>
        <h1 className="text-xl font-bold">Group Info</h1>
      </div>

      <div className="flex flex-col items-center pt-8 pb-6 border-b border-zinc-800">
        <div
          className={`relative w-28 h-28 rounded-full bg-purple-500 flex items-center justify-center text-4xl font-bold overflow-hidden ${
            isAdmin ? "cursor-pointer" : ""
          }`}
          onClick={() => isAdmin && fileInputRef.current?.click()}
        >
          {groupAvatar ? (
            <img src={groupAvatar} className="w-full h-full object-cover" />
          ) : (
            groupName?.charAt(0)?.toUpperCase()
          )}
          {isAdmin && (
            <div className="absolute bottom-0 right-0 bg-green-500 w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 border-zinc-950">
              📷
            </div>
          )}
        </div>

        {isAdmin && (
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} />
        )}

        {uploading && <p className="text-xs text-zinc-400 mt-2">Uploading…</p>}

        <div className="mt-4 text-center w-full px-8">
          {editingName ? (
            <div className="flex gap-2 justify-center">
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="bg-zinc-800 rounded-lg p-2 text-sm outline-none text-center"
              />
              <button onClick={saveName} className="text-blue-500 text-sm px-2">Save</button>
            </div>
          ) : (
            <p
              className={`text-lg font-semibold ${isAdmin ? "cursor-pointer" : ""}`}
              onClick={() => {
                if (!isAdmin) return;
                setNameDraft(groupName);
                setEditingName(true);
              }}
            >
              {groupName}
            </p>
          )}
        </div>

       {message && <p className="text-xs text-red-400 mt-2">{message}</p>}

        <div className="flex justify-center gap-8 mt-6">
          {isAdmin && (
            <button onClick={openAddMembers} className="flex flex-col items-center gap-1">
              <span className="w-11 h-11 rounded-full bg-zinc-800 flex items-center justify-center text-lg">➕</span>
              <span className="text-xs text-zinc-400">Add</span>
            </button>
          )}
          <a href="#members-section" className="flex flex-col items-center gap-1">
            <span className="w-11 h-11 rounded-full bg-zinc-800 flex items-center justify-center text-lg">👥</span>
            <span className="text-xs text-zinc-400">Members</span>
          </a>
        </div>
      </div>

      <div id="members-section" className="px-4 pt-6 pb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-zinc-300">{members.length} Members</p>
        {isAdmin && (
          <button onClick={openAddMembers} className="text-sm text-blue-400">
            + Add
          </button>
        )}
      </div>

      <div className="divide-y divide-zinc-800">
        {members.map((m) => (
          <div key={m.user_id} className="flex items-center justify-between px-4 py-3">
            <div
              className="flex items-center gap-3 flex-1 cursor-pointer"
              onClick={() => isAdmin && m.user_id !== userId && setActionFor(m)}
            >
              <div className="w-10 h-10 rounded-full bg-zinc-600 overflow-hidden flex items-center justify-center text-sm">
                {m.avatar_url ? (
                  <img src={m.avatar_url} className="w-full h-full object-cover" />
                ) : (
                  m.first_name?.[0]?.toUpperCase()
                )}
              </div>
              <div>
                <p className="text-sm">
                  {m.user_id === userId ? "You" : m.first_name}
                </p>
                {m.role === "admin" && <p className="text-xs text-blue-400">Admin</p>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {actionFor && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={() => setActionFor(null)}>
          <div
            className="bg-zinc-900 w-full rounded-t-2xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-center text-sm text-zinc-400 mb-3">{actionFor.first_name}</p>
            <button
              onClick={() => toggleAdmin(actionFor)}
              className="w-full text-left py-3 border-b border-zinc-800"
            >
              {actionFor.role === "admin" ? "Remove as admin" : "Make group admin"}
            </button>
            <button
              onClick={() => removeMember(actionFor)}
              className="w-full text-left py-3 text-red-400"
            >
              Remove from group
            </button>
          </div>
        </div>
      )}

      <div className="px-4 pt-6 space-y-3">
        <button
          onClick={leaveGroup}
          className="w-full text-left text-red-400 py-2"
        >
          Leave Group
        </button>
        {isAdmin && (
          <button
            onClick={deleteGroup}
            className="w-full text-left text-red-500 font-semibold py-2"
          >
            Delete Group
          </button>
        )}
      </div>
    </div>
  );
}