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
        console.log("[Auto-Login] Starting sequential tab-switch with FULL RELOAD...");
        const amazonTabId = sender.tab.id;

        chrome.tabs.query({ url: "*://mail.google.com/*" }, (tabs) => {
            if (tabs.length === 0) {
                sendResponse({ error: "Gmail tab not open" });
                return;
            }
            const gmailTab = tabs[0];

            // 1. Activate and Reload Gmail
            chrome.tabs.update(gmailTab.id, { active: true }, () => {
                chrome.tabs.reload(gmailTab.id, {}, () => {
                    console.log("[Auto-Login] Gmail reload triggered. Waiting for load...");

                    // 2. Wait for Tab to be Complete
                    const loadListener = (tabId, changeInfo) => {
                        if (tabId === gmailTab.id && changeInfo.status === "complete") {
                            chrome.tabs.onUpdated.removeListener(loadListener);
                            
                            console.log("[Auto-Login] Gmail loaded. Extracting ASAP...");
                            // 3. Short 500ms wait for Gmail UI render (instead of 2s)
                            setTimeout(() => {
                                chrome.tabs.sendMessage(gmailTab.id, { action: "EXTRACT_GMAIL_OTP" }, (res) => {
                                    console.log("[Auto-Login] Extraction complete. Switching back to Amazon...");
                                    
                                    // 4. Switch back to Amazon
                                    chrome.tabs.update(amazonTabId, { active: true }, () => {
                                        // 5. Final 1s wait on Amazon screen
                                        setTimeout(() => {
                                            sendResponse(res || { error: "Extraction failed" });
                                        }, 1000);
                                    });
                                });
                            }, 500);
                        }
                    };
                    chrome.tabs.onUpdated.addListener(loadListener);
                });
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