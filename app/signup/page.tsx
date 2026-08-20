"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "../supabaseClient";
import ChatBackground from "../ChatBackground";

export default function Signup() {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [verificationSent, setVerificationSent] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  function validate() {
    if (!fullName || !username || !email || !password || !confirmPassword) {
      return "Please fill in all fields.";
    }
    if (password.length < 8) {
      return "Password must be at least 8 characters.";
    }
    if (password !== confirmPassword) {
      return "Passwords do not match.";
    }
    if (!agreed) {
      return "Please agree to the Terms & Privacy Policy.";
    }
    return "";
  }

  async function handleSignup() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setLoading(true);

    const { error: signUpError } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: {
          first_name: fullName,
          username: username.toLowerCase(),
        },
      },
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
    } else {
      setVerificationSent(true);
    }
  }

  async function handleResend() {
    setResendMessage("Sending…");
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: email,
    });
    setResendMessage(resendError ? resendError.message : "Verification email resent!");
  }

  const inputClass =
    "w-full p-3 rounded-lg text-sm outline-none bg-white text-black placeholder-zinc-500 border border-zinc-300 focus:border-blue-500";
  const labelClass = "block text-sm text-zinc-300 mb-1 mt-4";

  if (verificationSent) {
    return (
      <div className="relative flex items-center justify-center min-h-screen overflow-hidden bg-[#0B1120] px-6">
        <ChatBackground />
        <div className="relative z-10 bg-zinc-900 p-6 rounded-xl shadow-lg w-full max-w-sm text-center">
          <h1 className="text-2xl font-bold text-white mb-1">
            ChitChat<span className="text-blue-500">NG</span>
          </h1>
          <p className="text-zinc-300 text-sm mt-4">
            We've sent a verification email. Please check your inbox to verify your account.
          </p>
          <button onClick={handleResend} className="mt-4 text-blue-500 text-sm hover:underline">
            Resend Verification Email
          </button>
          {resendMessage && <p className="text-zinc-400 text-xs mt-2">{resendMessage}</p>}
          <p className="text-zinc-400 text-xs mt-4">
            <Link href="/login" className="text-blue-500 font-semibold hover:underline">
              Back to Log in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex items-center justify-center min-h-screen overflow-hidden bg-[#0B1120] px-6 py-10">
      <ChatBackground />

      <div className="relative z-10 bg-zinc-900 p-6 rounded-xl shadow-lg w-full max-w-sm">
        <h1 className="text-2xl font-bold text-white mb-1 text-center">
          ChitChat<span className="text-blue-500">NG</span>
        </h1>
        <p className="text-zinc-400 text-sm mb-2 text-center">Create a new account</p>

        <label className={labelClass}>Full Name</label>
        <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} />

        <label className={labelClass}>Username</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. philip123"
          className={inputClass}
        />

        <label className={labelClass}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={inputClass}
        />

        <label className={labelClass}>Password</label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className={`${inputClass} pr-14`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-medium"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>

        <label className={labelClass}>Confirm Password</label>
        <div className="relative">
          <input
            type={showConfirmPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter your password"
            className={`${inputClass} pr-14`}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-medium"
          >
            {showConfirmPassword ? "Hide" : "Show"}
          </button>
        </div>

        <label className="flex items-start gap-2 mt-4 text-left">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" />
          <span className="text-xs text-zinc-400">I agree to the Terms & Privacy Policy</span>
        </label>

        {error && <p className="text-red-400 text-xs mt-3">{error}</p>}

        <button
          onClick={handleSignup}
          disabled={loading}
          className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white p-3 rounded-lg text-sm font-medium mt-4 flex items-center justify-center gap-2"
        >
          {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          {loading ? "Creating account…" : "Sign Up"}
        </button>

        <p className="text-zinc-400 text-xs mt-4 text-center">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-500 font-semibold hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}