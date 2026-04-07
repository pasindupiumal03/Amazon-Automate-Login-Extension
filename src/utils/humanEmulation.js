/**
 * Simulates human-like typing into an input element character by character.
 * Used for Gmail and PIN to bypass bot detection.
 */
export async function humanType(element, text, minDelay = 100, maxDelay = 350) {
    if (!element) return;

    element.focus();
    
    // Clear and focus
    element.value = '';
    element.dispatchEvent(new Event('input', { bubbles: true }));

    let currentVal = '';
    for (const char of text) {
        const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        element.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
        
        currentVal += char;
        element.value = currentVal;
        
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
    }
    
    element.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Direct fill into an input element.
 * Used for fast OTP filling as requested.
 */
export async function directFill(element, text) {
    if (!element) return;

    element.focus();
    element.value = text;
    
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    
    // Small delay to ensure the framework registers the change
    await new Promise(resolve => setTimeout(resolve, 300));
}

/**
 * Simulates a human-like click with a small delay.
 */
export async function humanClick(element) {
    if (!element) return;

    element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    
    const clickDelay = Math.floor(Math.random() * (1200 - 600 + 1) + 600);
    await new Promise(resolve => setTimeout(resolve, clickDelay));
    
    element.focus();
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    element.click();
}
