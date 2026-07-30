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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1120]">
      <div className="flex flex-col items-center">
        <div
          className={`rounded-full bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/30 transition-all duration-700 ease-out ${
            stage === "logo"
              ? "w-24 h-24 opacity-100 scale-100"
              : "w-14 h-14 opacity-0 scale-75 mb-0"
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10">
            <path
              d="M4 12c0-4.4 3.6-8 8-8s8 3.6 8 8-3.6 8-8 8c-1.1 0-2.1-.2-3-.6L4 21l1.4-4.8C4.5 14.9 4 13.5 4 12z"
              fill="white"
            />
            <circle cx="9" cy="12" r="1.2" fill="#3B82F6" />
            <circle cx="12" cy="12" r="1.2" fill="#3B82F6" />
            <circle cx="15" cy="12" r="1.2" fill="#3B82F6" />
          </svg>
        </div>

        <div
          className={`transition-all duration-700 ease-out ${
            stage === "wordmark"
              ? "opacity-100 translate-y-0 -mt-14"
              : "opacity-0 translate-y-3"
          }`}
        >
          <h1 className="text-3xl font-bold text-white tracking-tight text-center">
            ChitChat<span className="text-blue-500">NG</span>
          </h1>
          <p
            className={`text-zinc-400 text-xs text-center mt-1 transition-opacity duration-700 delay-300 ${
              stage === "wordmark" ? "opacity-100" : "opacity-0"
            }`}
          >
            Every gist, every day.
          </p>
        </div>
      </div>
    </div>
  );
}