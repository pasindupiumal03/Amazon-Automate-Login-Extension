import { humanType, humanClick } from "./utils/humanEmulation.js";

const LOGIN_URL = "https://auth.hiring.amazon.com/#/login";
let isProcessing = false; // Guard to prevent multiple simultaneous loops
let lockdownActive = false; // Emergency stop if captcha is detected

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
async function fetchOTP(gasUrl) {
    if (!gasUrl) return null;
    try {
        const response = await fetch(`${gasUrl}${gasUrl.includes('?') ? '&' : '?'}t=${Date.now()}`);
        const data = await response.json();
        return data.otp || null;
    } catch (err) {
        return null;
    }
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
    const settings = await chrome.storage.local.get(["isAutomationRunning", "gmailEmail", "personalPin", "gasScriptUrl"]);
    
    if (!settings.isAutomationRunning) {
        isProcessing = false;
        return;
    }

    // --- RE-LOGIN DETECTION ---
    // If we are not on the login hash, but we see a Sign In button, click it to start the flow
    if (!window.location.href.includes("#/login")) {
        const signInBtn = Array.from(document.querySelectorAll('button, a')).find(el => {
            const txt = el.textContent.toLowerCase();
            return txt === "sign in" || txt === "log in";
        });
        
        if (signInBtn) {
            console.log("[Auto-Login] Detected session logout. Clicking Sign In to restart flow...");
            await humanClick(signInBtn);
            isProcessing = false;
            return;
        }
        
        // If we're not on the login page and no sign-in button, just exit
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
    if (otpField && settings.gasScriptUrl) {
        if (!otpField.value) {
            let otp = null;
            for (let i = 0; i < 20; i++) {
                if (isCaptchaVisible()) { lockdownActive = true; isProcessing = false; return; }
                otp = await fetchOTP(settings.gasScriptUrl);
                if (otp) break;
                await new Promise(r => setTimeout(r, 3000));
            }
            if (otp) {
                await humanType(otpField, otp);
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

    // Final Final Step
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

// Initial start delay
setTimeout(() => {
    runAutoLogin();
}, 2500);

// Heartbeat to catch page changes or redirects
setInterval(() => {
    if (!lockdownActive && !isProcessing) {
        runAutoLogin();
    }
}, 5000);