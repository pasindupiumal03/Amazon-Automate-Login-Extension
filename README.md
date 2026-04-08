# AutomatePro - Amazon Hiring Login Automation Extension

AutomatePro is a Chrome extension (Manifest V3) that automates the Amazon Hiring login flow on `https://auth.hiring.amazon.com/*`.

It can:

1. Auto-fill email and PIN.
2. Trigger verification code delivery.
3. Fetch OTP by either API bridge or open Gmail tab scanning.
4. Submit verification and continue login flow.

![AutomatePro Logo](./src/assets/icons/logo.jpg)

## Current Capabilities

1. Dual OTP strategies:
   - `api`: fetch OTP from your Google Apps Script endpoint.
   - `tab`: read OTP directly from an open Gmail tab (`mail.google.com`).
2. Automation speed modes:
   - `fast`: direct-fill inputs quickly.
   - `slow`: human-like typing/click delays.
3. CAPTCHA safety lockdown:
   - Detects common CAPTCHA widgets/text.
   - Pauses automation for 15 seconds when detected.
4. Re-login recovery:
   - Detects sign-in state and attempts to restart flow.
5. OTP retry loop:
   - Polls up to 50 attempts at 800ms intervals.
   - Avoids reusing the same OTP in session storage.
6. Gmail keepalive service worker alarm:
   - Periodically refreshes Gmail tabs to keep inbox session active.
7. Persistent settings:
   - Stores email, PIN, OTP method, GAS URL, speed, and run state in `chrome.storage.local`.

## Project Structure

1. `src/popup.jsx`: React popup UI and settings management.
2. `src/content.jsx`: Amazon + Gmail content-script automation logic.
3. `src/background.jsx`: service worker message routing and Gmail keepalive alarms.
4. `src/utils/humanEmulation.js`: human-like typing/click helpers and direct fill.
5. `src/controllers/storageController.js`: storage helpers.
6. `public/manifest.json`: extension manifest and permissions.
7. `scripts/check.js`: build health check helper.
8. `scripts/package.js`: zip packaging helper.

## Requirements

1. Node.js 18+ recommended.
2. Chrome/Chromium browser with developer mode.
3. If using OTP API mode: a deployed Google Apps Script endpoint that returns JSON.

## Install And Build

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

Load in Chrome:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select the generated `dist/` folder.

## Using The Extension

1. Open Amazon Hiring auth page: `https://auth.hiring.amazon.com/#/login`.
2. Open popup and choose OTP strategy:
   - `API (GAS Bridge)` if using a web app endpoint.
   - `Gmail (Opened Tab)` if reading OTP from Gmail tab.
3. Set automation speed:
   - `Fast (Full Fill)` or `Slow (Human)`.
4. Enter and save:
   - Gmail address.
   - Personal PIN.
   - GAS URL (required only for API mode).
5. Click `Launch Automation`.
6. Keep a Gmail tab open if using `tab` mode.

## OTP API Contract (API Mode)

Your GAS endpoint should return JSON such as:

```json
{ "otp": "123456" }
```

Optional email auto-fill behavior in popup:

- Popup calls your URL with `?type=getEmail` (or `&type=getEmail` if query exists).
- If response contains `{ "email": "you@example.com" }`, it auto-saves Gmail address.

## Permissions Used

From `public/manifest.json`:

1. `storage` for local settings.
2. `activeTab`, `tabs`, `scripting` for tab messaging/automation.
3. `alarms` for MV3-safe keepalive scheduling.
4. Host permissions:
   - `https://auth.hiring.amazon.com/*`
   - `https://mail.google.com/*`

## Packaging

The project includes:

```bash
npm run package
```

This builds then runs `scripts/package.js` to produce `extension.zip`.

Note: if packaging fails with missing `archiver`, install it first:

```bash
npm install archiver --save-dev
```

## Notes

1. This project is intended for personal productivity and testing.
2. Automation behavior can break if Amazon or Gmail DOM changes.
3. Always comply with site policies and your organization rules.
