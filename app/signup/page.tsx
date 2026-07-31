"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../supabaseClient";
import ChatBackground from "../ChatBackground";

export default function Signup() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [username, setUsername] = useState("");
  const [gender, setGender] = useState("");
  const [dob, setDob] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const [showCodeInput, setShowCodeInput] = useState(false);
  const [code, setCode] = useState("");

  async function handleSignup() {
    if (!firstName || !username || !gender || !dob || !email || !password) {
      setMessage("Please fill in all fields!");
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          first_name: firstName,
          username: username.toLowerCase(),
          gender: gender,
          date_of_birth: dob,
        },
      },
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Check your email for a 6-digit code.");
      setShowCodeInput(true);
    }
  }

  async function handleVerify() {
    if (!code) {
      setMessage("Please enter the code!");
      return;
    }

    const { error } = await supabase.auth.verifyOtp({
      email: email,
      token: code,
      type: "signup",
    });

    if (error) {
      setMessage(error.message);
    } else {
      router.push("/chat");
    }
  }

  return (
    <div className="relative flex items-center justify-center min-h-screen overflow-hidden bg-[#0B1120]">
      <ChatBackground />

      <div className="relative z-10 bg-zinc-900 p-6 rounded-xl shadow-lg w-80 text-center">
        <h1 className="text-2xl font-bold text-white mb-1">
          ChitChat<span className="text-blue-500">NG</span>
        </h1>

        {!showCodeInput ? (
          <>
            <p className="text-zinc-400 text-sm mb-4">Create a new account</p>

            <label className="block text-left text-xs text-zinc-300 mt-3 mb-1">First Name</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full p-2 rounded-lg text-sm outline-none"
            />

            <label className="block text-left text-xs text-zinc-300 mt-3 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. philip123"
              className="w-full p-2 rounded-lg text-sm outline-none"
            />

            <label className="block text-left text-xs text-zinc-300 mt-3 mb-1">Gender</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full p-2 rounded-lg text-sm outline-none"
            >
              <option value="">Select Gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>

            <label className="block text-left text-xs text-zinc-300 mt-3 mb-1">Date of Birth</label>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              min="1940-01-01"
              className="w-full p-2 rounded-lg text-sm outline-none"
            />

            <label className="block text-left text-xs text-zinc-300 mt-3 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 rounded-lg text-sm outline-none"
            />

            <label className="block text-left text-xs text-zinc-300 mt-3 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 rounded-lg text-sm outline-none"
            />

            <button
              onClick={handleSignup}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-lg text-sm mt-4"
            >
              Sign Up
            </button>
          </>
        ) : (
          <>
            <p className="text-zinc-400 text-sm mb-4">Enter the code sent to your email</p>

            <label className="block text-left text-xs text-zinc-300 mt-3 mb-1">Confirmation Code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full p-2 rounded-lg text-sm outline-none"
            />

            <button
              onClick={handleVerify}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-lg text-sm mt-4"
            >
              Confirm
            </button>
          </>
        )}

        {message && (
          <p className="text-zinc-300 text-xs mt-3">{message}</p>
        )}

        <p className="text-zinc-400 text-xs mt-4">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-500 font-semibold hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}