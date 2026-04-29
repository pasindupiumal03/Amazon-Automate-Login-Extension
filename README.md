# AutomatePro - Amazon Hiring Login Automation Extension

AutomatePro is a high-performance Chrome extension (Manifest V3) engineered to automate the Amazon Hiring login flow on `https://auth.hiring.amazon.com/*` with precision and resilience.

It handles the complete login lifecycle:
1. Auto-filling email and PIN credentials.
2. Triggering verification code delivery.
3. Fetching OTP securely via an API bridge or direct open Gmail tab extraction.
4. Implementing intelligent error recovery for invalid OTPs and rate limits.
5. Submitting verification and continuing the login flow seamlessly.

![AutomatePro Logo](./src/assets/icons/logo.jpg)

## Core Capabilities & Features

### 1. Dual High-Speed OTP Strategies
- **API Mode (`api`)**: Fetches OTP from a designated Google Apps Script endpoint.
- **Visual Sync Tab Mode (`tab`)**: Reads the OTP directly from an open Gmail tab (`mail.google.com`). Employs a brute-force full page reload on the Gmail tab to ensure the absolute latest email is extracted, bypassing stale cache issues.

### 2. Intelligent Multi-Stage Error Recovery
- **High-Precision Error Detection**: Actively monitors for "Invalid OTP" or "Requests Limit Exceeded" messages by targeting specific DOM footers.
- **Staged Resync (First Failure)**: Automatically clears the input field, initiates a tailored 7-second cooldown to let Amazon's backend process the rejection, and triggers a fresh sync with Gmail to fetch a new OTP.
- **Safety Shutdown (Consecutive Failures)**: If a second consecutive OTP error occurs, the extension safely halts automation to prevent infinite loops, updating local storage to disable the global automation flag.

### 3. Precision Timing Optimization
- **Zero-Latency Monitoring**: Utilizes a tight 200ms detection loop immediately after triggering the verification code, eliminating polling gaps.
- **Synchronized Visual Switching**: Orchestrates exact transition timing—a 4-second delay for the initial fetch and a 500ms extraction wait—ensuring transitions align perfectly with Amazon's DOM state changes.
- **Settling Buffers**: Enforces 1-second stabilization waits when switching back to the Amazon portal to prevent verifying before the UI is ready.

### 4. Automation Speed Control
- **Fast Mode**: Injects credentials via direct-fill inputs for maximum speed.
- **Slow Mode**: Simulates human-like typing and click delays to emulate organic user behavior.

### 5. CAPTCHA Safety Lockdown
- Detects common CAPTCHA widgets (e.g., reCAPTCHA, Arkose, FunCaptcha) and specific text indicators.
- Automatically pauses automation for 15 seconds to allow for manual resolution.

## Project Structure

1. `src/popup.jsx`: React popup UI and settings management.
2. `src/content.jsx`: Amazon + Gmail content-script automation logic, tight loops, and error recovery sequences.
3. `src/background.jsx`: Service worker message routing, orchestrating visual tab switches and Gmail tab reloading.
4. `src/utils/humanEmulation.js`: Helper functions for human-like typing, clicking, and direct filling.
5. `src/controllers/storageController.js`: Storage initialization and helpers.
6. `public/manifest.json`: Extension manifest and permissions.
7. `scripts/check.js` & `scripts/package.js`: Build health check and zip packaging utilities.

## Requirements

1. Node.js 18+ recommended.
2. Chrome/Chromium browser with developer mode enabled.
3. **(Optional)** If using API mode: A deployed Google Apps Script endpoint that returns JSON.

## Install And Build

Install dependencies and build the production bundle:
```bash
npm install
npm run build
```

For development watch mode:
```bash
npm run dev
```

Validate output bundle:
```bash
npm run check
```

### Loading the Extension in Chrome:
1. Open `chrome://extensions`.
2. Enable **Developer mode** in the top right.
3. Click **Load unpacked**.
4. Select the generated `dist/` directory from this project.

## Usage Guide

1. Open the Amazon Hiring authentication page: `https://auth.hiring.amazon.com/#/login`.
2. Open the extension popup and configure your preferred OTP strategy:
   - **API (GAS Bridge)**: Uses a web app endpoint.
   - **Gmail (Opened Tab)**: Extracts OTP from an active Gmail tab.
3. Select the automation speed:
   - **Fast (Full Fill)** or **Slow (Human)**.
4. Enter your credentials and endpoint URL:
   - Gmail Address.
   - Personal PIN.
   - GAS URL (Required only for API mode).
5. Click **Launch Automation**.
6. **Important**: If using `tab` mode, ensure you keep a Gmail tab open in the background for extraction.

## OTP API Contract (API Mode)

Your Google Apps Script (GAS) endpoint must return JSON in the following format:
```json
{ "otp": "123456" }
```

**Optional Auto-Fill Behavior:**
- The popup calls your URL with `?type=getEmail` (or `&type=getEmail`).
- If the response contains `{ "email": "you@example.com" }`, the extension will auto-save the Gmail address in settings.

## Permissions Required

Configured in `public/manifest.json`:
1. `storage`: For managing local settings and state persistence.
2. `activeTab`, `tabs`, `scripting`: For tab messaging, switching, and automation.
3. **Host permissions**:
   - `https://auth.hiring.amazon.com/*`
   - `https://mail.google.com/*`

## Packaging for Distribution

To bundle the extension into a `.zip` file for distribution:
```bash
npm run package
```
*Note: If packaging fails due to a missing dependency, install it via: `npm install archiver --save-dev`*

## Important Notes

1. This project is intended for personal productivity.
2. Automation sequences are highly dependent on the DOM structure. Changes to the Amazon or Gmail interfaces may require updates to the selectors used in `content.jsx`.
3. Always comply with site policies and organizational rules when using automation tools.
