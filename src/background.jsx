/**
 * AUTOMATEPRO: BACKGROUND SERVICE WORKER
 * Handles cross-tab communication for Gmail OTP extraction.
 */

// ---------------------------------------------------------
// GMAIL SESSION KEEPALIVE using chrome.alarms (MV3-safe)
// setInterval is unreliable in MV3 service workers because
// the worker goes idle and gets killed between events.
// chrome.alarms persists across service worker sleep/wake cycles.
// ---------------------------------------------------------
const GMAIL_KEEPALIVE_ALARM = "gmail-session-keepalive";
const GMAIL_REFRESH_MINUTES = 15; // Change back to 15 for production

function reloadAllGmailTabs() {
    chrome.tabs.query({ url: "*://mail.google.com/*" }, (tabs) => {
        if (tabs.length === 0) {
            console.log("[Auto-Login] Keepalive: No Gmail tabs open, skipping.");
            return;
        }
        tabs.forEach((tab) => {
            console.log(`[Auto-Login] Keepalive: Reloading Gmail tab ${tab.id} (${tab.url})...`);
            chrome.tabs.reload(tab.id);
        });
    });
}

/**
 * Session Lifecycle Handlers
 * Ensures the automation is turned OFF when the profile is restarted.
 * Also (re)creates the keepalive alarm on install/startup.
 */
chrome.runtime.onInstalled.addListener(() => {
    console.log("[Auto-Login] Extension installed/updated. Resetting session...");
    chrome.storage.local.set({ isAutomationRunning: false });

    // Create the alarm (clears any existing one first to avoid duplicates)
    chrome.alarms.clear(GMAIL_KEEPALIVE_ALARM, () => {
        chrome.alarms.create(GMAIL_KEEPALIVE_ALARM, {
            delayInMinutes: GMAIL_REFRESH_MINUTES,
            periodInMinutes: GMAIL_REFRESH_MINUTES,
        });
        console.log(`[Auto-Login] Keepalive alarm set: every ${GMAIL_REFRESH_MINUTES} minute(s).`);
    });
});

chrome.runtime.onStartup.addListener(() => {
    console.log("[Auto-Login] Profile started. Resetting automation state...");
    chrome.storage.local.set({ isAutomationRunning: false });

    // Re-create the alarm on browser startup (alarms survive restarts but good to ensure)
    chrome.alarms.clear(GMAIL_KEEPALIVE_ALARM, () => {
        chrome.alarms.create(GMAIL_KEEPALIVE_ALARM, {
            delayInMinutes: GMAIL_REFRESH_MINUTES,
            periodInMinutes: GMAIL_REFRESH_MINUTES,
        });
        console.log(`[Auto-Login] Keepalive alarm re-set on startup: every ${GMAIL_REFRESH_MINUTES} minute(s).`);
    });
});

/**
 * Alarm Handler — fires the Gmail tab reload on schedule.
 */
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === GMAIL_KEEPALIVE_ALARM) {
        console.log("[Auto-Login] Keepalive alarm fired. Reloading Gmail tabs...");
        reloadAllGmailTabs();
    }
});

/**
 * Message Handler
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    // Manual/on-demand Gmail tab refresh (triggered by content.js during OTP polling)
    if (request.action === "REFRESH_GMAIL_TAB") {
        chrome.tabs.query({ url: "*://mail.google.com/*" }, (tabs) => {
            if (tabs.length === 0) return;
            tabs.forEach((tab) => {
                // Use the inbox refresh button via content script instead of a full tab reload
                // so we don't disrupt an open email thread mid-poll.
                chrome.tabs.sendMessage(tab.id, { action: "EXTRACT_GMAIL_OTP" }, () => {
                    // Fire-and-forget: we just want the content script's fallback refresh to trigger
                    void chrome.runtime.lastError;
                });
            });
        });
        return false;
    }

    if (request.action === "QUERY_GMAIL_TAB_WITH_SWITCH") {
        console.log("[Auto-Login] Starting sequential tab-switch fetch (Instant Switch)...");
        const amazonTabId = sender.tab.id;

        // 1. Find and Activate Gmail (INSTANTLY)
        chrome.tabs.query({ url: "*://mail.google.com/*" }, (tabs) => {
            if (tabs.length === 0) {
                sendResponse({ error: "Gmail tab not open" });
                return;
            }
            const gmailTab = tabs[0];
            chrome.tabs.update(gmailTab.id, { active: true }, () => {
               
                // 2. Wait 1 second in Gmail for sync
                setTimeout(() => {
                    chrome.tabs.sendMessage(gmailTab.id, { action: "EXTRACT_GMAIL_OTP" }, (res) => {
                        if (res && res.otp) {
                            console.log("[Auto-Login] OTP Extracted. Switching back...");
                            // 3. Switch back to Amazon
                            chrome.tabs.update(amazonTabId, { active: true }, () => {
                                sendResponse({ otp: res.otp });
                            });
                        } else {
                            // Switch back anyway even if failed
                            chrome.tabs.update(amazonTabId, { active: true }, () => {
                                sendResponse({ error: "No code found after switch" });
                            });
                        }
                    });
                }, 1000);
            });
        });

        return true;
    }

    if (request.action === "QUERY_GMAIL_TAB") {
        console.log("[Auto-Login] Searching for an active Gmail tab...");
        
        chrome.tabs.query({ url: "*://mail.google.com/*" }, (tabs) => {
            if (tabs.length === 0) {
                console.log("[Auto-Login] No Gmail tabs found.");
                sendResponse({ error: "Gmail tab not open" });
                return;
            }

            const queryNextTab = (index) => {
                if (index >= tabs.length) {
                    sendResponse({ error: "Code not found in any open Gmail tabs" });
                    return;
                }

                const targetTab = tabs[index];
                chrome.tabs.sendMessage(targetTab.id, { action: "EXTRACT_GMAIL_OTP" }, (res) => {
                    if (res && res.otp) {
                        console.log(`[Auto-Login] OTP found in Gmail tab: ${targetTab.id}`);
                        sendResponse({ otp: res.otp });
                    } else {
                        queryNextTab(index + 1);
                    }
                });
            };

            queryNextTab(0);
        });
        
        return true; // Keep message channel open for async response
    }
});