import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { saveToStorage, getFromStorage } from "./controllers/storageController.js";
import "./index.css";

// SVG Icons
const SaveIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
    </svg>
);

const EmailIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-600" viewBox="0 0 24 24" fill="currentColor">
        <path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z" />
        <path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z" />
    </svg>
);

const KeyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-600" viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3A5.25 5.25 0 0012 1.5zm-3.75 5.25a3.75 3.75 0 117.5 0v3h-7.5v-3z" clipRule="evenodd" />
    </svg>
);

const LinkIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-600" viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" d="M19.902 4.098a3.75 3.75 0 00-5.304 0l-4.5 4.5a3.75 3.75 0 001.035 6.037.75.75 0 01-.646 1.353 5.25 5.25 0 01-1.449-8.452l4.5-4.5a5.25 5.25 0 117.424 7.424l-1.757 1.757a.75.75 0 11-1.06-1.06l1.757-1.757a3.75 3.75 0 000-5.304zm-7.389 4.267a.75.75 0 011-.353 5.25 5.25 0 011.449 8.452l-4.5 4.5a5.25 5.25 0 11-7.424-7.424l1.757-1.757a.75.75 0 111.06 1.06l-1.757 1.757a3.75 3.75 0 105.304 5.304l4.5-4.5a3.75 3.75 0 00-.353-1z" clipRule="evenodd" />
    </svg>
);

function Popup() {
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [gasUrl, setGasUrl] = useState("");
  const [otpMethod, setOtpMethod] = useState("api"); // "api" or "tab"
  const [automationSpeed, setAutomationSpeed] = useState("slow"); // "fast" or "slow"
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState({ type: "info", message: "Ready to start automation" });

  useEffect(() => {
    getFromStorage(["gmailEmail", "personalPin", "gasScriptUrl", "isAutomationRunning", "otpMethod", "automationSpeed"]).then((res) => {
      if (res.gmailEmail) setEmail(res.gmailEmail);
      if (res.personalPin) setPin(res.personalPin);
      if (res.gasScriptUrl) setGasUrl(res.gasScriptUrl);
      if (res.isAutomationRunning) setIsRunning(res.isAutomationRunning);
      if (res.otpMethod) setOtpMethod(res.otpMethod || "api");
      if (res.automationSpeed) setAutomationSpeed(res.automationSpeed || "slow");
    });
  }, []);

  const handleStart = async () => {
    if (!email || !pin || (otpMethod === "api" && !gasUrl)) {
      setStatus({ type: "error", message: "Complete all fields first" });
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !tab.url.startsWith("https://auth.hiring.amazon.com/")) {
      setStatus({ type: "error", message: "Please navigate to Amazon Login first" });
      return;
    }

    await saveToStorage({ 
        gmailEmail: email, 
        personalPin: pin, 
        gasScriptUrl: gasUrl, 
        otpMethod: otpMethod,
        automationSpeed: automationSpeed,
        isAutomationRunning: true 
    });
    
    try {
        await chrome.tabs.sendMessage(tab.id, { 
            action: "START_AUTOMATION",
            gmailEmail: email,
            personalPin: pin,
            gasUrl: gasUrl,
            otpMethod: otpMethod,
            automationSpeed: automationSpeed
        });
    } catch (e) {}

    setIsRunning(true);
    setStatus({ type: "success", message: "Automation active" });
  };

  const handleStop = async () => {
    await saveToStorage({ isAutomationRunning: false });
    setIsRunning(false);
    setStatus({ type: "info", message: "Automation paused" });
  };

  const saveField = async (key, val, label) => {
    if (!val) {
        setStatus({ type: "error", message: `${label} cannot be empty` });
        return;
    }
    const storageKey = key === 'email' ? 'gmailEmail' : (key === 'pin' ? 'personalPin' : (key === 'gas' ? 'gasScriptUrl' : 'otpMethod'));
    
    if (key === 'gas') {
        setStatus({ type: "info", message: "Saving URL... Fetching email" });
        try {
            const fetchUrl = `${val}${val.includes('?') ? '&' : '?'}type=getEmail`;
            const resp = await fetch(fetchUrl);
            const data = await resp.json();
            if (data.email) {
                setEmail(data.email);
                await saveToStorage({ [storageKey]: val, gmailEmail: data.email });
                setStatus({ type: "success", message: "Config & Email saved!" });
            } else {
                await saveToStorage({ [storageKey]: val });
                setStatus({ type: "success", message: "Config saved" });
            }
        } catch (e) {
            await saveToStorage({ [storageKey]: val });
            setStatus({ type: "success", message: "Config saved (Manual email entry needed)" });
        }
    } else if (key === 'speed') {
        await saveToStorage({ automationSpeed: val });
        setStatus({ type: "success", message: "Speed preference saved" });
    } else {
        await saveToStorage({ [storageKey]: val });
        setStatus({ type: "success", message: `${label} saved` });
    }
    setTimeout(() => setStatus({ type: "info", message: isRunning ? "Automation active" : "Ready to start automation" }), 3000);
  };

  const toggleMethod = (method) => {
    if (isRunning) return;
    setOtpMethod(method);
    saveToStorage({ otpMethod: method });
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 p-6 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <img src="./assets/icons/logo.jpg" alt="Logo" className="w-10 h-10 object-contain shadow-sm rounded-lg" />
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-none bg-gradient-to-r from-blue-700 to-indigo-800 bg-clip-text text-transparent">AutomatePro</h1>
          </div>
        </div>
        <div className="flex flex-col items-end">
            <span className={`text-[10px] font-black uppercase tracking-tighter ${isRunning ? 'text-green-500' : 'text-slate-300'}`}>
                {isRunning ? '● Live' : '● Off'}
            </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-grow p-6 space-y-4">
        
        {/* OTP Collection Method Toggle */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-600 uppercase ml-1 tracking-tight">OTP Fetching Strategy</label>
          <div className="flex bg-slate-200 p-1 rounded-2xl">
            <button
              onClick={() => toggleMethod("api")}
              className={`flex-1 py-1.5 text-[10px] font-extrabold uppercase rounded-xl transition-all ${otpMethod === "api" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-600 hover:text-slate-900"}`}
            >
              API (GAS Bridge)
            </button>
            <button
              onClick={() => toggleMethod("tab")}
              className={`flex-1 py-1.5 text-[10px] font-extrabold uppercase rounded-xl transition-all ${otpMethod === "tab" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-600 hover:text-slate-900"}`}
            >
              Gmail (Opened Tab)
            </button>
          </div>
        </div>

        {/* Automation Speed Toggle */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-600 uppercase ml-1 tracking-tight">Automation Speed</label>
          <div className="flex bg-slate-200 p-1 rounded-2xl">
            <button
              onClick={() => { setAutomationSpeed("fast"); saveField('speed', 'fast'); }}
              className={`flex-1 py-1.5 text-[10px] font-extrabold uppercase rounded-xl transition-all ${automationSpeed === "fast" ? "bg-emerald-600 text-white shadow-lg" : "text-slate-600 hover:text-slate-900"}`}
            >
              Fast (Full Fill)
            </button>
            <button
              onClick={() => { setAutomationSpeed("slow"); saveField('speed', 'slow'); }}
              className={`flex-1 py-1.5 text-[10px] font-extrabold uppercase rounded-xl transition-all ${automationSpeed === "slow" ? "bg-amber-600 text-white shadow-lg" : "text-slate-600 hover:text-slate-900"}`}
            >
              Slow (Human)
            </button>
          </div>
        </div>

        {/* Email Field */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-600 uppercase ml-1 tracking-tight">Gmail Address</label>
          <div className="relative flex items-center">
            <div className="absolute left-4 z-10"><EmailIcon /></div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isRunning}
              placeholder="example@gmail.com"
              className="w-full pl-11 pr-14 py-3 bg-white border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all text-sm font-semibold shadow-sm text-slate-900 placeholder-slate-300"
            />
            <button 
              onClick={() => saveField('email', email, 'Email')}
              disabled={isRunning}
              className="absolute right-2 p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-blue-600 rounded-xl transition-all border border-slate-200 active:scale-95 disabled:hidden"
            >
              <SaveIcon />
            </button>
          </div>
        </div>

        {/* PIN Field */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-600 uppercase ml-1 tracking-tight">Personal PIN</label>
          <div className="relative flex items-center">
            <div className="absolute left-4 z-10"><KeyIcon /></div>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              disabled={isRunning}
              placeholder="••••••"
              className="w-full pl-11 pr-14 py-3 bg-white border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all text-sm font-bold shadow-sm tracking-[0.2em] text-slate-900"
            />
            <button 
              onClick={() => saveField('pin', pin, 'PIN')}
              disabled={isRunning}
              className="absolute right-2 p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-blue-600 rounded-xl transition-all border border-slate-200 active:scale-95 disabled:hidden"
            >
              <SaveIcon />
            </button>
          </div>
        </div>

        {/* GAS Fetcher URL - Hidden if Tab method is selected */}
        {otpMethod === "api" && (
          <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-300">
            <label className="text-[11px] font-bold text-slate-600 uppercase ml-1 tracking-tight">GAS URL</label>
            <div className="relative flex items-center">
              <div className="absolute left-4 z-10"><LinkIcon /></div>
              <input
                type="text"
                value={gasUrl}
                onChange={(e) => setGasUrl(e.target.value)}
                disabled={isRunning}
                placeholder="https://script.google.com/..."
                className="w-full pl-11 pr-14 py-3 bg-white border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all text-[11px] font-bold shadow-sm text-slate-900 truncate"
              />
              <button 
                onClick={() => saveField('gas', gasUrl, 'API URL')}
                disabled={isRunning}
                className="absolute right-2 p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-blue-600 rounded-xl transition-all border border-slate-200 active:scale-95 disabled:hidden"
              >
                <SaveIcon />
              </button>
            </div>
          </div>
        )}

        {/* Status Message */}
        <div className={`p-4 rounded-2xl text-[11px] font-bold uppercase tracking-tight transition-all duration-500 border overflow-hidden whitespace-nowrap overflow-ellipsis ${
          status.type === "success" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
          status.type === "error" ? "bg-rose-50 text-rose-500 border-rose-100" :
          "bg-blue-50 text-blue-500 border-blue-100 shadow-sm"
        }`}>
          {status.message}
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-6 pt-0">
        {!isRunning ? (
          <button
            onClick={handleStart}
            className="w-full group relative bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl transition-all duration-300 shadow-xl shadow-indigo-100 active:scale-[0.98] flex items-center justify-center gap-3 text-[15px]"
          >
            Launch Automation
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="w-full bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-rose-100 active:scale-[0.98] flex items-center justify-center gap-2 text-[15px]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clipRule="evenodd" />
            </svg>
            Kill Process
          </button>
        )}
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById("react-target"));
root.render(<Popup />);