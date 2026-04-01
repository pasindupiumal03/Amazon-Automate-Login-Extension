/**
 * Service to handle captcha solving via NopeCHA API.
 */
const API_KEY = "I-TV4EX6CLL6WC";
const BASE_URL = "https://api.nopecha.com/";

/**
 * Solves a captcha challenge.
 * @param {string} type - Captcha type ('image', 'recaptcha', 'hcaptcha', 'awswaf')
 * @param {object} challenge - Challenge data (images list or sitekey/url)
 */
export async function solveCaptcha(type, challenge) {
    try {
        console.log(`[NopeCHA] Requesting ${type} solve...`);
        
        const response = await fetch(BASE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                key: API_KEY,
                type: type,
                ...challenge
            })
        });

        const data = await response.json();

        if (data.error || !data.data) {
            throw new Error(`NopeCHA Error: ${data.message || data.error}`);
        }

        return data.data; 
    } catch (error) {
        console.error("[NopeCHA] Solve Failed:", error.message);
        return null;
    }
}

/**
 * Solves an image-based challenge (like grid of images).
 * @param {string} task - The prompt (e.g. 'Select all images with a car')
 * @param {string[]} images - Array of base64 strings or URLs of images
 */
export async function solveImageGrid(task, images) {
    return await solveCaptcha('image', {
        task: task,
        images: images
    });
}
