import { humanType, humanClick, directFill } from "./utils/humanEmulation.js";

const LOGIN_URL = "https://auth.hiring.amazon.com/#/login";
let isProcessing = false; // Guard to prevent multiple simultaneous loops
let lockdownActive = false; // Emergency stop if captcha is detected

/**
 * ---------------------------------------------------------
 * GMAIL TAB MODE: Code to run on mail.google.com
 * ---------------------------------------------------------
 */
if (window.location.hostname === "mail.google.com") {
    console.log("[Auto-Login] Gmail detected. Standing by for OTP requests...");
    
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "EXTRACT_GMAIL_OTP") {
            console.log("[Auto-Login] Received OTP extraction request...");
            
            // Priority 1: Search only within the active message body (Gmail's message content class)
            // This avoids fetching numbers from the sidebar, subject lines, or other emails.
            const messageBodies = Array.from(document.querySelectorAll('div.ii.gt, div[role="main"]'));
            let foundOtp = null;

            for (const body of messageBodies) {
                const text = body.innerText;
                // Look specifically for 6 digits near 'verification' or 'Amazon Jobs'
                const contextualMatch = text.match(/(?:verification|code|amazon|jobs).*?\b(\d{6})\b/is);
                if (contextualMatch) {
                    foundOtp = contextualMatch[1];
                    break;
                }
            }

            // Priority 2: Fallback to searching the entire body with contextual regex
            if (!foundOtp) {
                const bodyText = document.body.innerText;
                const contextualMatch = bodyText.match(/(?:verification|code|amazon|jobs).*?\b(\d{6})\b/is);
                if (contextualMatch) {
                    foundOtp = contextualMatch[1];
                }
            }

            // Priority 3: Last resort - just find the last 6-digit sequence found
            if (!foundOtp) {
                const otpMatch = document.body.innerText.match(/\b\d{6}\b/g);
                if (otpMatch) foundOtp = otpMatch[otpMatch.length - 1];
            }
            
            if (foundOtp) {
                console.log("[Auto-Login] Extracting verified OTP:", foundOtp);
                sendResponse({ otp: foundOtp });
            } else {
                sendResponse({ error: "No Amazon verification code found in Gmail tab" });
            }
        }
        return true; 
    });
}

/**
 * ---------------------------------------------------------
 * AMAZON MODE: Logic for auth.hiring.amazon.com
 * ---------------------------------------------------------
 */

/**
 * Deep search for any kind of Captcha (including inside Shadow DOM)
 */
function isCaptchaVisible() {
    const indicators = [
        'iframe[src*="recaptcha"]', 'iframe[src*="arkose"]', 
        'iframe[src*="funcaptcha"]', 'iframe[src*="captcha"]',
        '.g-recaptcha', '#captcha-container', '.captcha-modal',
        '[id*="captcha"]', '[class*="captcha"]', '[id*="recaptcha"]'
    ];
    
    for (const selector of indicators) {
        const el = document.querySelector(selector);
        if (el && el.offsetParent !== null) return true;
    }

    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
        if (el.shadowRoot) {
            for (const selector of indicators) {
                const inner = el.shadowRoot.querySelector(selector);
                if (inner && inner.offsetParent !== null) return true;
            }
        }
    }

    const txt = document.body.innerText.toLowerCase();
    if (txt.includes("verify you are human") || txt.includes("solve the captcha")) {
        return true;
    }

    return false;
}

/**
 * Fetches the latest OTP from the Google Apps Script bridge.
 */
async function fetchOTPFromAPI(gasUrl) {
    if (!gasUrl) return null;
    try {
        const response = await fetch(`${gasUrl}${gasUrl.includes('?') ? '&' : '?'}t=${Date.now()}`);
        const data = await response.json();
        return data.otp || null;
    } catch (err) {
        return null;
    }
}

/**
 * Fetches the latest OTP by messaging the background to query a Gmail tab.
 */
async function fetchOTPFromTab() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: "QUERY_GMAIL_TAB" }, (response) => {
            if (response && response.otp) {
                resolve(response.otp);
            } else {
                console.log("[Auto-Login] Tab fetch failed:", response?.error || "Unknown error");
                resolve(null);
            }
        });
    });
}

// Automation logic
async function runAutoLogin() {
  if (lockdownActive || isProcessing) return;

  if (isCaptchaVisible()) {
      console.warn("[Auto-Login] CAPTCHA DETECTED - Entering Lockdown Mode.");
      lockdownActive = true;
      setTimeout(() => { lockdownActive = false; }, 15000);
      return;
  }

  isProcessing = true;

    try {
    const settings = await chrome.storage.local.get(["isAutomationRunning", "gmailEmail", "personalPin", "gasScriptUrl", "otpMethod"]);
    
    if (!settings.isAutomationRunning) {
        isProcessing = false;
        return;
    }

    // --- RE-LOGIN DETECTION ---
    if (!window.location.href.includes("#/login")) {
        const signInBtn = Array.from(document.querySelectorAll('button, a')).find(el => {
            const txt = el.textContent.toLowerCase();
            return txt === "sign in" || txt === "log in";
        });
        
        if (signInBtn) {
            await humanClick(signInBtn);
            isProcessing = false;
            return;
        }
        isProcessing = false;
        return;
    }

    const emailField = document.getElementById("login");
    const pinField = document.getElementById("pin");
    const otpField = document.getElementById("input-test-id-confirmOtp");
    const sendCodeBtnTrigger = document.querySelector('[data-test-id="button-submit"]');
    const continueBtn = document.querySelector('[data-test-id="button-continue"]');

    // Email Step
    if (emailField && !emailField.value && settings.gmailEmail) {
        await humanType(emailField, settings.gmailEmail);
        if (continueBtn) await humanClick(continueBtn);
        isProcessing = false;
        return;
    }

    // PIN Step
    if (pinField && !pinField.value && settings.personalPin) {
        await humanType(pinField, settings.personalPin);
        if (continueBtn) await humanClick(continueBtn);
        isProcessing = false;
        return;
    }

    // OTP Send Step
    if (sendCodeBtnTrigger && sendCodeBtnTrigger.textContent.includes("Send verification code")) {
        await humanClick(sendCodeBtnTrigger);
        isProcessing = false;
        return;
    }

    // OTP Fetch/Verify Step
    if (otpField && (settings.gasScriptUrl || settings.otpMethod === "tab")) {
        if (!otpField.value) {
            let otp = null;
            const method = settings.otpMethod || "api";
            console.log(`[Auto-Login] Polling for OTP using ${method} method...`);
            
            for (let i = 0; i < 20; i++) {
                if (isCaptchaVisible()) { lockdownActive = true; isProcessing = false; return; }
                
                if (method === "tab") {
                    otp = await fetchOTPFromTab();
                } else {
                    otp = await fetchOTPFromAPI(settings.gasScriptUrl);
                }
                
                if (otp) break;
                await new Promise(r => setTimeout(r, 3000));
            }

            if (otp) {
                await directFill(otpField, otp);
                const verifyBtn = document.querySelector('[data-test-id="button-test-id-verifyAccount"]') || 
                                 document.querySelector('[data-test-id="button-continue"]');
                if (verifyBtn) await humanClick(verifyBtn);
            }
        } else {
            const verifyBtn = document.querySelector('[data-test-id="button-test-id-verifyAccount"]') || 
                                 document.querySelector('[data-test-id="button-continue"]');
            if (verifyBtn) await humanClick(verifyBtn);
        }
    }

    // Final Stage
    if (continueBtn && !emailField && !pinField && !otpField && !sendCodeBtnTrigger) {
        await humanClick(continueBtn);
    }

  isProcessing = false; 
} catch (error) {
  isProcessing = false;
}
}

// ---------------------------------------------------------
// RE-START TRIGGER ON MESSAGE
chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "START_AUTOMATION") {
        lockdownActive = false;
        runAutoLogin();
    }
});

// Run logic only on the Amazon portal
if (window.location.hostname === "auth.hiring.amazon.com") {
    setTimeout(() => {
        runAutoLogin();
    }, 2500);

    setInterval(() => {
        if (!lockdownActive && !isProcessing) {
            runAutoLogin();
        }
    }, 5000);
}