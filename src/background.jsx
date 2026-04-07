/**
 * AUTOMATEPRO: BACKGROUND SERVICE WORKER
 * Handles cross-tab communication for Gmail OTP extraction.
 */

/**
 * Session Lifecycle Handlers
 * Ensures the automation is turned OFF when the profile is restarted.
 */
chrome.runtime.onInstalled.addListener(() => {
    console.log("[Auto-Login] Extension installed/updated. Resetting session...");
    chrome.storage.local.set({ isAutomationRunning: false });
});

chrome.runtime.onStartup.addListener(() => {
    console.log("[Auto-Login] Profile started. Resetting automation state...");
    chrome.storage.local.set({ isAutomationRunning: false });
});

/**
 * Message Handler
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "QUERY_GMAIL_TAB") {
        console.log("[Auto-Login] Searching for an active Gmail tab...");
        
        // Find all Gmail tabs
        chrome.tabs.query({ url: "*://mail.google.com/*" }, (tabs) => {
            if (tabs.length === 0) {
                console.log("[Auto-Login] No Gmail tabs found.");
                sendResponse({ error: "Gmail tab not open" });
                return;
            }

            // Direct the query to a tab
            // We iterate through all open Gmail tabs until one provides a code
            const queryNextTab = (index) => {
                if (index >= tabs.length) {
                    sendResponse({ error: "Code not found in any open Gmail tabs" });
                    return;
                }

                const targetTab = tabs[index];
                chrome.tabs.sendMessage(targetTab.id, { action: "EXTRACT_GMAIL_OTP" }, (res) => {
                    // Check if we got a code. If not, try the next tab.
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