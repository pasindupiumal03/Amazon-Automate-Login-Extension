import { humanType, humanClick } from "./utils/humanEmulation.js";
import { solveCaptcha } from "./services/captchaSolver.js";

const LOGIN_URL = "https://auth.hiring.amazon.com/#/login";
let isProcessing = false;

/**
 * Specialized solver for Amazon's AWS WAF Grid Captcha (Canvas-based)
 */
async function handleAwsWafCaptcha(captchaElement) {
    console.log("[Auto-Login] Detected AWS WAF Captcha...");
    
    // We need to wait a moment for the canvas to actually draw images
    await new Promise(r => setTimeout(r, 2000));

    const root = captchaElement.shadowRoot;
    if (!root) {
        console.log("[Auto-Login] No Shadow Root found on captcha element.");
        return;
    }

    // 1. Extract the task (e.g. "clocks")
    // The task is often in an <em> tag inside a <div>
    const taskEm = root.querySelector("em");
    if (!taskEm) {
        console.log("[Auto-Login] Captcha Task (em tag) not found.");
        return;
    }
    const task = `Select all ${taskEm.textContent.trim()}`;
    console.log(`[Auto-Login] Task: ${task}`);

    // 2. Extract the grid image from Canvas
    const canvas = root.querySelector("canvas");
    if (!canvas) {
        console.log("[Auto-Login] Canvas not found.");
        return;
    }

    let imageData;
    try {
        imageData = canvas.toDataURL("image/jpeg", 0.8);
    } catch (e) {
        console.log("[Auto-Login] Could not extract canvas data (likely CORS). Attempting fallback...");
        // Fallback strategy: NopeCHA API with sitekey/URL if extraction fails
        return;
    }
    
    // 3. Request Solve from NopeCHA
    const result = await solveCaptcha('image', {
        task: task,
        images: [imageData],
        grid: '3x3' 
    });

    if (!result) {
        console.log("[Auto-Login] NopeCHA solve returned no result.");
        return;
    }

    // result can be an array of indices [0, 2, 4] or a single index
    const indices = Array.isArray(result) ? result : [result];
    console.log(`[Auto-Login] Solving indices: ${indices}`);

    // 4. Click the buttons based on result indices
    const buttons = root.querySelectorAll("button[type='button']");
    // Some buttons (1-9) are inside the canvas or after it
    // Let's filter for just the grid buttons (usually they have text 1-9 or are in sequence)
    
    for (const index of indices) {
        // Map 0-8 to the correct button. 
        // In your HTML, buttons 1-9 are within the canvas tag.
        // Index 0 in NopeCHA = button text '1'
        const targetBtn = Array.from(buttons).find(b => b.textContent.trim() === (index + 1).toString());
        
        if (targetBtn) {
            console.log(`[Auto-Login] Matching button ${index + 1} found. Clicking...`);
            await humanClick(targetBtn);
        } else if (buttons[index]) {
            console.log(`[Auto-Login] Clicking button at index ${index}.`);
            await humanClick(buttons[index]);
        }
    }

    // 5. Click Confirm
    await new Promise(r => setTimeout(r, 800));
    const confirmBtn = root.querySelector("#amzn-btn-verify-internal") || root.querySelector(".btn-primary");
    if (confirmBtn) {
        await humanClick(confirmBtn);
        console.log("[Auto-Login] Captcha Verified.");
    }
}

// Main Automation logic
async function runAutoLogin() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const settings = await chrome.storage.local.get(["isAutomationRunning", "gmailEmail", "personalPin"]);
    if (!settings.isAutomationRunning) {
        isProcessing = false;
        return;
    }

    // --- CAPTCHA DETECTION (Priority) ---
    const wafCaptcha = document.querySelector("awswaf-captcha");
    if (wafCaptcha && wafCaptcha.shadowRoot) {
        console.log("[Auto-Login] AWS WAF Captcha found in current frame.");
        if (!wafCaptcha.dataset.solvingStarted) {
            wafCaptcha.dataset.solvingStarted = "true";
            await handleAwsWafCaptcha(wafCaptcha);
            // Reset solving state after a long timeout in case it failed
            setTimeout(() => { wafCaptcha.dataset.solvingStarted = ""; }, 30000);
        }
        isProcessing = false;
        return;
    }

    // Only run form logic if NOT on Amazon's main hiring URL (since we match more domains for iframes)
    if (!window.location.href.includes("auth.hiring.amazon.com")) {
        isProcessing = false;
        return;
    }

    // --- FORM PHASES ---
    const emailInput = document.getElementById("login");
    const pinInput = document.getElementById("pin");
    const sendCodeBtn = document.querySelector('[data-test-id="button-submit"]');
    const isSendCodeScreen = sendCodeBtn && (sendCodeBtn.textContent.includes("Send verification code") || sendCodeBtn.textContent.includes("code"));

    if (emailInput && !emailInput.value && settings.gmailEmail) {
        await humanType(emailInput, settings.gmailEmail);
        const continueBtn = document.querySelector('[data-test-id="button-continue"]');
        if (continueBtn) await humanClick(continueBtn);
        isProcessing = false;
        return;
    }

    if (pinInput && !pinInput.value && settings.personalPin) {
        await humanType(pinInput, settings.personalPin);
        const continueBtn = document.querySelector('[data-test-id="button-continue"]');
        if (continueBtn) await humanClick(continueBtn);
        isProcessing = false;
        return;
    }

    if (isSendCodeScreen) {
        await humanClick(sendCodeBtn);
        isProcessing = false;
        return;
    }

    isProcessing = false;
  } catch (error) {
    console.error("[Auto-Login] Loop Error:", error);
    isProcessing = false;
  }
}

// Global Message Listener
chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "START_AUTOMATION") runAutoLogin();
});

// Start checking
setInterval(runAutoLogin, 3000);
console.log("[Auto-Login] Content script active in frame:", window.location.hostname);