import { humanType, humanClick } from "./utils/humanEmulation.js";

const LOGIN_URL = "https://auth.hiring.amazon.com/#/login";
let isProcessing = false; // Guard to prevent multiple simultaneous loops

/**
 * Fetches the latest OTP from the Google Apps Script bridge.
 */
async function fetchOTP(gasUrl) {
    if (!gasUrl) return null;
    try {
        console.log("[Auto-Login] Fetching OTP from GAS...");
        const response = await fetch(gasUrl);
        const data = await response.json();
        if (data.otp) {
            console.log("[Auto-Login] OTP Received:", data.otp);
            return data.otp;
        } else {
            console.log("[Auto-Login] OTP not available yet:", data.error || "Unknown error");
            return null;
        }
    } catch (err) {
        console.error("[Auto-Login] Failed to fetch OTP:", err);
        return null;
    }
}

// Automation logic
async function runAutoLogin() {
  if (isProcessing) return;
  isProcessing = true;

    try {
    const settings = await chrome.storage.local.get(["isAutomationRunning", "gmailEmail", "personalPin", "gasScriptUrl"]);
    
    if (!settings.isAutomationRunning) {
        isProcessing = false;
        return;
    }

  // Check current URL (including fragment)
  if (!window.location.href.includes("#/login")) {
      isProcessing = false;
      return;
  }

  console.log("[Auto-Login] Checking for login fields...");
  
  // 1. Handle Email Phase
  const emailInput = document.getElementById("login");
  if (emailInput && !emailInput.value && settings.gmailEmail) {
    console.log("[Auto-Login] Email field found. Starting typing...");
    await humanType(emailInput, settings.gmailEmail);
    const continueBtn = document.querySelector('[data-test-id="button-continue"]');
    if (continueBtn) await humanClick(continueBtn);
    isProcessing = false;
    return;
  }

  // 2. Handle PIN Phase
  const pinInput = document.getElementById("pin");
  if (pinInput && !pinInput.value && settings.personalPin) {
      console.log("[Auto-Login] PIN field found. Starting typing...");
      await humanType(pinInput, settings.personalPin);
      const continueBtn = document.querySelector('[data-test-id="button-continue"]');
      if (continueBtn) await humanClick(continueBtn);
      isProcessing = false;
      return;
  }

  // 3. Handle 'Send verification code' Phase
  const sendCodeBtn = document.querySelector('[data-test-id="button-submit"]');
  const isSendCodeScreen = sendCodeBtn && sendCodeBtn.textContent.includes("Send verification code");
  
  if (isSendCodeScreen) {
      console.log("[Auto-Login] 'Send verification code' button found. Clicking...");
      await humanClick(sendCodeBtn);
      isProcessing = false;
      return;
  }

  // 4. Handle OTP Phase
  const otpInput = document.getElementById("input-test-id-confirmOtp");
  if (otpInput && !otpInput.value && settings.gasScriptUrl) {
      console.log("[Auto-Login] OTP screen detected. Polling for code...");
      
      // Attempt to fetch OTP multiple times with a delay
      let otp = null;
      for (let i = 0; i < 15; i++) { // Try for ~45 seconds
          otp = await fetchOTP(settings.gasScriptUrl);
          if (otp) break;
          await new Promise(r => setTimeout(r, 3000));
      }

      if (otp) {
          await humanType(otpInput, otp);
          const verifyBtn = document.querySelector('[data-test-id="button-test-id-verifyAccount"]');
          if (verifyBtn) {
              await humanClick(verifyBtn);
              console.log("[Auto-Login] OTP verified successfully.");
          }
      } else {
          console.log("[Auto-Login] Could not retrieve OTP after multiple attempts.");
      }
      isProcessing = false;
      return;
  }

  // 5. Handle Final Continue Phase
  const finalContinueBtn = document.querySelector('[data-test-id="button-continue"]');
  if (finalContinueBtn && !emailInput && !pinInput && !otpInput && !sendCodeBtn) {
      console.log("[Auto-Login] Final 'Continue' button found. Clicking...");
      await humanClick(finalContinueBtn);
      isProcessing = false;
      return;
  }

  isProcessing = false; // Release lock
} catch (error) {
  console.error("[Auto-Login] Error in automation loop:", error);
  isProcessing = false; // Release lock on error
}
}

// ---------------------------------------------------------
// RE-START TRIGGER ON MESSAGE
// ---------------------------------------------------------
chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "START_AUTOMATION") {
        console.log("[Auto-Login] Start message received from Popup.");
        runAutoLogin();
    }
});

// Run automation on page load and periodically
window.addEventListener("load", () => {
  setTimeout(runAutoLogin, 2500);
});

// Periodic check for interaction signals
setInterval(() => {
    if (window.location.href.includes("#/login")) {
         const emailInput = document.getElementById("login");
         const pinInput = document.getElementById("pin");
         const otpInput = document.getElementById("input-test-id-confirmOtp");
         const sendCodeBtn = document.querySelector('[data-test-id="button-submit"]');
         const finalContinueBtn = document.querySelector('[data-test-id="button-continue"]');
         
         const isSendCodeScreen = sendCodeBtn && sendCodeBtn.textContent.includes("Send verification code");
         
         const shouldTriggerEmail = emailInput && !emailInput.dataset.automationProcessed && !emailInput.value;
         const shouldTriggerPin = pinInput && !pinInput.dataset.automationProcessed && !pinInput.value;
         const shouldTriggerSendCode = isSendCodeScreen && !sendCodeBtn.dataset.automationProcessed;
         const shouldTriggerOtp = otpInput && !otpInput.dataset.automationProcessed && !otpInput.value;
         
         // Only trigger final continue if it's not the email/pin phase
         const shouldTriggerFinalContinue = finalContinueBtn && 
                                           !finalContinueBtn.dataset.automationProcessed && 
                                           !emailInput && !pinInput;

         if (shouldTriggerEmail || shouldTriggerPin || shouldTriggerSendCode || shouldTriggerOtp || shouldTriggerFinalContinue) {
             console.log("[Auto-Login] Interaction detected. Triggering automation...");
             if (emailInput) emailInput.dataset.automationProcessed = "true";
             if (pinInput) pinInput.dataset.automationProcessed = "true";
             if (sendCodeBtn) sendCodeBtn.dataset.automationProcessed = "true";
             if (otpInput) otpInput.dataset.automationProcessed = "true";
             if (finalContinueBtn) finalContinueBtn.dataset.automationProcessed = "true";
             runAutoLogin();
         }
    }
}, 3000);