/**
 * Simulates human-like typing into an input element.
 * @param {HTMLInputElement} element - The target input field.
 * @param {string} text - The text to type.
 * @param {number} minDelay - Minimum delay between keystrokes (ms).
 * @param {number} maxDelay - Maximum delay between keystrokes (ms).
 */
export async function humanType(element, text, minDelay = 100, maxDelay = 350) {
    if (!element) return;

    element.focus();
    
    // Clear field and fire relevant events
    element.value = '';
    element.dispatchEvent(new Event('input', { bubbles: true }));

    let currentVal = '';
    for (const char of text) {
        const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Keydown event for current char
        element.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
        
        // Update the value character by character
        currentVal += char;
        element.value = currentVal;
        
        // Input event must be fired for React/modern frameworks to detect change
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
    }
    
    // Final change event to signify end of input
    element.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Simulates a human-like click with a small delay.
 * @param {HTMLElement} element - The target element to click.
 */
export async function humanClick(element) {
    if (!element) return;

    // Hover effect
    element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    
    const clickDelay = Math.floor(Math.random() * (1200 - 600 + 1) + 600);
    await new Promise(resolve => setTimeout(resolve, clickDelay));
    
    element.focus();
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    element.click();
}
