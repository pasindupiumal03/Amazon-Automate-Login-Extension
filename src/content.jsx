import { humanType, humanClick, directFill } from "./utils/humanEmulation.js";

const LOGIN_URL = "https://auth.hiring.amazon.com/#/login";
let isProcessing = false;
let lockdownActive = false;
let lastUsedOtp = sessionStorage.getItem("amazon_last_used_otp") || null;

/**
 * ---------------------------------------------------------
 * GMAIL TAB MODE: Code to run on mail.google.com
 * ---------------------------------------------------------
 */
if (window.location.hostname === "mail.google.com") {
    console.log("[Auto-Login] Gmail detected. Standing by for OTP requests...");
    
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "EXTRACT_GMAIL_OTP") {
            console.log("[Auto-Login] Scanning Gmail for the absolute latest OTP...");

            let foundOtp = null;

            // 1. Priority: Inbox List Rows (Top-Most)
            const inboxRows = Array.from(document.querySelectorAll('tr[role="row"], div[role="row"]'));
            if (inboxRows.length > 0) {
                for (let i = 0; i < Math.min(inboxRows.length, 3); i++) {
                    const rowText = inboxRows[i].innerText + " " + (inboxRows[i].getAttribute('aria-label') || "");
                    const matches = rowText.match(/(?:^|[^0-9])(\d{6})(?:[^0-9]|$)/);
                    if (matches) {
                        const code = matches[1];
                        if (rowText.toLowerCase().includes("amazon") || rowText.toLowerCase().includes("job")) {
                            foundOtp = code;
                            console.log("[Auto-Login] Found code in Inbox Row:", foundOtp);
                            break;
                        }
                    }
                }
            }

            // 2. Secondary: Inside an open Thread (Bottom-Up)
            if (!foundOtp) {
                const messages = Array.from(document.querySelectorAll('div[role="listitem"]')).reverse();
                for (const msg of messages) {
                    const text = msg.innerText;
                    const matches = text.match(/(?:^|[^0-9])(\d{6})(?:[^0-9]|$)/);
                    if (matches) {
                        const code = matches[1];
                        if (text.toLowerCase().includes("amazon") || text.toLowerCase().includes("job")) {
                            foundOtp = code;
                            console.log("[Auto-Login] Found code in Thread Body:", foundOtp);
                            break;
                        }
                    }
                }
            }

            // 3. Last Resort: Absolute Last match anywhere
            if (!foundOtp) {
                const bodyText = document.body.innerText;
                const allMatches = Array.from(bodyText.matchAll(/(?:^|[^0-9])(\d{6})(?:[^0-9]|$)/g));
                if (allMatches.length > 0) {
                    foundOtp = allMatches[allMatches.length - 1][1];
                }
            }
            
            if (foundOtp) {
                sendResponse({ otp: foundOtp });
            } else {
                // Trigger Gmail inbox refresh so next poll sees latest emails
                const refreshBtn = document.querySelector('div[aria-label="Refresh"], div[data-tooltip="Refresh"]');
                if (refreshBtn) refreshBtn.click();
                sendResponse({ error: "No code found yet" });
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
 * @param {boolean} useSwitch - If true, visually switches to Gmail tab then back.
 */
async function fetchOTPFromTab(useSwitch = false) {
    return new Promise((resolve) => {
        const action = useSwitch ? "QUERY_GMAIL_TAB_WITH_SWITCH" : "QUERY_GMAIL_TAB";
        chrome.runtime.sendMessage({ action: action }, (response) => {
            if (response && response.otp) {
                resolve(response.otp);
            } else {
                console.log(`[Auto-Login] Tab fetch (${action}) failed:`, response?.error || "Unknown error");
                resolve(null);
            }
        });
    });
}

let sendCodeJustClicked = false;

/**
 * Fast OTP polling loop.
 * - Polls every 800ms with no extra delays between attempts.
 * - Triggers a Gmail refresh on every attempt (fire-and-forget, doesn't block).
 * - Max ~40s total (50 attempts × 800ms).
 */
async function fetchNewOTPFast(method, gasUrl, previousOtp) {
    const MAX_ATTEMPTS = 50;
    const POLL_INTERVAL_MS = 800;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
        if (isCaptchaVisible()) return null;

        let fetchedOtp = null;

        if (method === "tab") {
            // Sequential tab switch only on FIRST attempt for visual confirmation
            if (i === 0) {
                fetchedOtp = await fetchOTPFromTab(true); // useSwitch = true
            } else {
                fetchedOtp = await fetchOTPFromTab(false);
            }
        } else {
            fetchedOtp = await fetchOTPFromAPI(gasUrl);
        }

        if (fetchedOtp && fetchedOtp !== previousOtp) {
            console.log(`[Auto-Login] New OTP received on attempt ${i + 1}:`, fetchedOtp);
            return fetchedOtp;
        }

        console.log(`[Auto-Login] Polling... attempt ${i + 1}/${MAX_ATTEMPTS} (got: ${fetchedOtp || 'none'})`);
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }

    console.warn("[Auto-Login] OTP polling timed out.");
    return null;
}

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
    const settings = await chrome.storage.local.get(["isAutomationRunning", "gmailEmail", "personalPin", "gasScriptUrl", "otpMethod", "automationSpeed"]);
    
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

    // --- SELECTORS ---
    const emailField = document.getElementById("login") || document.querySelector('input[name="email"]');
    const pinField = document.getElementById("pin") || document.querySelector('input[name="password"]');
    const otpField = document.getElementById("input-test-id-confirmOtp") || document.querySelector('[data-test-id="input-test-id-confirmOtp"]');
    const sendCodeBtnTrigger = document.querySelector('[data-test-id="button-submit"]');
    const continueBtn = document.querySelector('[data-test-id="button-continue"]');

    // Email Step
    if (emailField && !emailField.value && settings.gmailEmail) {
        console.log(`[Auto-Login] Step: Entering Email (${settings.automationSpeed || 'slow'})...`);
        if (settings.automationSpeed === "fast") {
            await directFill(emailField, settings.gmailEmail);
        } else {
            await humanType(emailField, settings.gmailEmail);
        }
        if (continueBtn) await humanClick(continueBtn);
        isProcessing = false;
        return;
    }

    // PIN Step
    if (pinField && !pinField.value && settings.personalPin) {
        console.log(`[Auto-Login] Step: Entering PIN (${settings.automationSpeed || 'slow'})...`);
        if (settings.automationSpeed === "fast") {
            await directFill(pinField, settings.personalPin);
        } else {
            await humanType(pinField, settings.personalPin);
        }
        if (continueBtn) await humanClick(continueBtn);
        isProcessing = false;
        return;
    }

    // OTP Send Step
    if (sendCodeBtnTrigger && sendCodeBtnTrigger.textContent.includes("Send verification code")) {
        console.log("[Auto-Login] Step: Clicking Send Code. Waiting for transition...");
        await humanClick(sendCodeBtnTrigger);
        
        // Wait for the OTP screen transition in a tight loop
        let transitionFound = false;
        for (let j = 0; j < 50; j++) { // Max 10s (50 * 200ms)
            const checkOtpField = document.getElementById("input-test-id-confirmOtp") || document.querySelector('[data-test-id="input-test-id-confirmOtp"]');
            if (checkOtpField) {
                transitionFound = true;
                console.log("[Auto-Login] OTP screen detected. Executing 3s sync wait...");
                break;
            }
            await new Promise(r => setTimeout(r, 200));
        }

        if (transitionFound) {
            // Wait 3s as requested
            await new Promise(r => setTimeout(r, 3000));
            // Trigger switch logic
            const method = settings.otpMethod || "api";
            if (method === "tab") {
                console.log("[Auto-Login] Executing Visual Sync Switch...");
                const otp = await fetchNewOTPFast(method, settings.gasScriptUrl, lastUsedOtp);
                if (otp) {
                    lastUsedOtp = otp;
                    sessionStorage.setItem("amazon_last_used_otp", otp);
                    const finalOtpField = document.getElementById("input-test-id-confirmOtp") || document.querySelector('[data-test-id="input-test-id-confirmOtp"]');
                    if (finalOtpField) await directFill(finalOtpField, otp);
                    
                    const verifyBtn = document.querySelector('[data-test-id="button-test-id-verifyAccount"]') || 
                                     document.querySelector('[data-test-id="button-continue"]');
                    if (verifyBtn) await humanClick(verifyBtn);
                }
            }
        }

        sendCodeJustClicked = false;
        isProcessing = false;
        return;
    }

    // OTP Fetch/Verify Step
    if (otpField && (settings.gasScriptUrl || settings.otpMethod === "tab")) {
        console.log("[Auto-Login] Step: OTP Input Screen Detected.");
        
        // ERROR DETECTION: "Enter a valid verification code"
        const errorText = document.body.innerText;
        const isInvalidOtp = errorText.includes("Enter a valid verification code");
        
        if (isInvalidOtp) {
            console.warn("[Auto-Login] Invalid OTP detected. Clearing and re-fetching...");
            otpField.value = "";
            otpField.dispatchEvent(new Event('input', { bubbles: true }));
            lastUsedOtp = null;
            sessionStorage.removeItem("amazon_last_used_otp");
        }

        if (!otpField.value) {
            const method = settings.otpMethod || "api";

            // The 3s wait and switch are now handled in the 'Send Code' step 
            // after the transition is detected.
            if (sendCodeJustClicked) {
                sendCodeJustClicked = false;
            }

            console.log(`[Auto-Login] Starting fast OTP poll via [${method}]... (previous: ${lastUsedOtp || 'none'})`);

            const otp = await fetchNewOTPFast(method, settings.gasScriptUrl, lastUsedOtp);

            if (otp) {
                lastUsedOtp = otp;
                sessionStorage.setItem("amazon_last_used_otp", otp);
                await directFill(otpField, otp);
                
                const verifyBtn = document.querySelector('[data-test-id="button-test-id-verifyAccount"]') || 
                                 document.querySelector('[data-test-id="button-continue"]') ||
                                 document.querySelector('button[type="submit"]');
                                 
                if (verifyBtn) {
                    console.log("[Auto-Login] Clicking Verify...");
                    await humanClick(verifyBtn);
                }
            }
        } else {
            const verifyBtn = document.querySelector('[data-test-id="button-test-id-verifyAccount"]') || 
                             document.querySelector('[data-test-id="button-continue"]') ||
                             document.querySelector('button[type="submit"]');
            if (verifyBtn) await humanClick(verifyBtn);
        }
    }

    // Final Stage
    if (continueBtn && !emailField && !pinField && !otpField && !sendCodeBtnTrigger) {
        console.log("[Auto-Login] Step: Clicking Final Continue...");
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
    }, 1000); // Polling every 1 second for instant detection
}