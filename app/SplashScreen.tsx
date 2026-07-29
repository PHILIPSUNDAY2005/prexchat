"use client";

import { useEffect, useState } from "react";

export default function SplashScreen() {
  const [stage, setStage] = useState<"logo" | "wordmark" | "done">("logo");

  useEffect(() => {
    const toWordmark = setTimeout(() => setStage("wordmark"), 900);
    const toDone = setTimeout(() => setStage("done"), 2600);
    return () => {
      clearTimeout(toWordmark);
      clearTimeout(toDone);
    };
  }, []);

  if (stage === "done") return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-[#0B1120] transition-opacity duration-500 ${
        stage === "wordmark" ? "opacity-100" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center">
        {/* Circle logo — shrinks and fades once wordmark stage begins */}
        <div
          className={`rounded-full bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/30 transition-all duration-700 ease-out ${
            stage === "logo"
              ? "w-24 h-24 opacity-100 scale-100"
              : "w-14 h-14 opacity-0 scale-75 mb-0"
          }`}
        >
          <span className="text-white text-3xl font-bold">P</span>
        </div>

        {/* Wordmark — fades and slides up into view */}
        <div
          className={`transition-all duration-700 ease-out ${
            stage === "wordmark"
              ? "opacity-100 translate-y-0 -mt-14"
              : "opacity-0 translate-y-3"
          }`}
        >
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Prex<span className="text-blue-500">Chat</span>
          </h1>
          <p
            className={`text-zinc-400 text-xs text-center mt-1 transition-opacity duration-700 delay-300 ${
              stage === "wordmark" ? "opacity-100" : "opacity-0"
            }`}
          >
            Chat with anyone, anywhere.
          </p>
        </div>
      </div>
    </div>
  );
}