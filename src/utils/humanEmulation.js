/**
 * Direct fill into an input element.
 * Fast filling as requested, while maintaining framework compatibility.
 * @param {HTMLInputElement} element - The target input field.
 * @param {string} text - The text to fill.
 */
export async function humanType(element, text) {
    if (!element) return;

    element.focus();
    
    // Direct set value
    element.value = text;
    
    // Dispatch mandatory events for React/Stencil/Angular to detect the change
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    
    // Simulate a final keyup to mimic the end of a "typing" action
    element.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
    
    // Small delay for the framework to process the input
    await new Promise(resolve => setTimeout(resolve, 500));
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
