import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { saveToStorage, getFromStorage } from "./controllers/storageController.js";
import "./index.css";

const LOGIN_URL = "https://auth.hiring.amazon.com/#/login";

function Popup() {
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [gasUrl, setGasUrl] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState({ type: "info", message: "Ready to start" });
  const [isFirstTime, setIsFirstTime] = useState(true);

  useEffect(() => {
    // Load saved credentials and status on mount
    getFromStorage(["gmailEmail", "personalPin", "gasScriptUrl", "isAutomationRunning"]).then((res) => {
      if (res.gmailEmail) setEmail(res.gmailEmail);
      if (res.personalPin) setPin(res.personalPin);
      if (res.gasScriptUrl) setGasUrl(res.gasScriptUrl);
      if (res.isAutomationRunning) setIsRunning(res.isAutomationRunning);
      if (res.gmailEmail && res.personalPin) setIsFirstTime(false);
    });
  }, []);

  const handleStart = async () => {
    if (!email || !pin) {
      setStatus({ type: "error", message: "Please enter both Email and PIN" });
      return;
    }

    // Check URL
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url.startsWith("https://auth.hiring.amazon.com/")) {
        setStatus({ type: "error", message: "Please navigate to the Amazon Login page first" });
        return;
    }

    // Since the login URL has a hash, we check if it is included
    if (!tab.url.includes("#/login")) {
        setStatus({ type: "error", message: "Not on the login page (#/login)" });
        return;
    }

    await saveToStorage({ 
        gmailEmail: email, 
        personalPin: pin, 
        gasScriptUrl: gasUrl,
        isAutomationRunning: true 
    });
    
    // Notify the current tab to start automation immediately
    try {
        await chrome.tabs.sendMessage(tab.id, { 
            action: "START_AUTOMATION",
            gmailEmail: email,
            personalPin: pin,
            gasUrl: gasUrl
        });
    } catch (e) {
        console.log("Could not send START_AUTOMATION message. Content script might not be loaded yet.");
    }

    setIsRunning(true);
    setIsFirstTime(false);
    setStatus({ type: "success", message: "Automation Started!" });
  };

  const handleStop = async () => {
    await saveToStorage({ isAutomationRunning: false });
    setIsRunning(false);
    setStatus({ type: "info", message: "Automation Stopped" });
  };

  return (
    <div className="w-full h-full bg-white flex flex-col font-sans">
      <div className="p-8 pb-10 flex items-center gap-4 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-b-3xl shadow-lg mb-8">
        <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white font-bold text-2xl border border-white/30 shadow-inner">A</div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Auto-Login</h1>
          <p className="text-xs text-blue-100 font-medium tracking-widest uppercase opacity-80">Amazon Recruitment Tool</p>
        </div>
      </div>

      <div className="px-8 space-y-6 flex-grow">
        <div className="space-y-2">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Connect Gmail</label>
          <div className="relative group">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isRunning}
              placeholder="example@gmail.com"
              className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-[15px] text-gray-800 placeholder-gray-400 font-medium"
            />
            <div className="absolute inset-0 rounded-2xl pointer-events-none border border-transparent group-hover:border-gray-200 transition-colors"></div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Access PIN</label>
          <div className="relative group">
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              disabled={isRunning}
              placeholder="••••••"
              className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-[15px] text-gray-800 placeholder-gray-400 font-bold tracking-widest"
            />
            <div className="absolute inset-0 rounded-2xl pointer-events-none border border-transparent group-hover:border-gray-200 transition-colors"></div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Gmail Fetcher URL (GAS)</label>
          <div className="relative group">
            <input
              type="text"
              value={gasUrl}
              onChange={(e) => setGasUrl(e.target.value)}
              disabled={isRunning}
              placeholder="https://script.google.com/macros/s/..."
              className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-[12px] text-gray-800 placeholder-gray-400"
            />
            <div className="absolute inset-0 rounded-2xl pointer-events-none border border-transparent group-hover:border-gray-200 transition-colors"></div>
          </div>
        </div>

        {status.message && (
          <div className={`p-4 rounded-2xl text-sm font-semibold flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 ${
            status.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
            status.type === "error" ? "bg-rose-50 text-rose-700 border border-rose-100" :
            "bg-blue-50 text-blue-700 border border-blue-100"
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              status.type === "success" ? "bg-emerald-500" : 
              status.type === "error" ? "bg-rose-500" : 
              "bg-blue-500 animate-pulse"
            }`}></div>
            {status.message}
          </div>
        )}
      </div>

      <div className="p-8 pt-4 flex flex-col gap-4">
        {!isRunning ? (
          <button
            onClick={handleStart}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-blue-500/20 active:scale-95 flex items-center justify-center gap-3 text-lg"
          >
            Start Session
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="w-full bg-white border-2 border-gray-100 hover:border-gray-200 text-gray-600 hover:text-rose-500 font-bold py-4 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-3 text-lg shadow-sm"
          >
            Stop Automation
          </button>
        )}

        <div className="flex justify-between items-center text-[11px] text-gray-400 font-bold uppercase tracking-tighter pt-4 border-t border-gray-50">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isRunning ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-gray-200"}`}></span>
            {isRunning ? "Engine Active" : "Engine Standby"}
          </div>
          <div className="bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">Release V1.0</div>
        </div>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById("react-target"));
root.render(<Popup />);