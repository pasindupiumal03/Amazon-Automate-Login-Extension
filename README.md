# 🚀 AutomatePro: Amazon Hiring Portal Login Engine

AutomatePro is a high-performance, professional Chrome extension designed to provide a completely hands-free login experience for the Amazon Hiring portal (`auth.hiring.amazon.com`). It automates every step of the security flow, including credential entry, PIN verification, and automated OTP retrieval from Gmail.

![AutomatePro Logo](./src/assets/icons/logo.jpg)

## ✨ Key Features

- **⚡ Instant Automation**: Skip manual typing. The engine fills your Gmail, Personal PIN, and OTP directly and instantly.
- **🛡️ Stealth Monitoring**: Uses advanced `MutationObserver` technology to watch the page silently, minimizing detection risks.
- **🔒 Captcha Hard-Lock**: Automatically detects captchas and enters a 15-second "Lockdown Mode" to allow solvers like NopeCHA to work without interference.
- **📧 Gmail OTP Bridge**: Connects to a custom Google Apps Script (GAS) to fetch recruitment verification codes directly from your inbox.
- **🔄 Session Self-Healing**: Automatically detects session expirations and clicks "Sign In" to restart the login flow.
- **🎨 Premium UI/UX**: Modern, minimalist React-based popup interface with field-level persistence and auto-discovery.

---

## 🛠️ Installation

### 1. Developer Mode

1. Download or clone this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the `dist/` folder of this project.

### 2. Building from Source

If you make changes to the code, you must rebuild the extension:

```bash
yarn install
yarn build
```

---

## ⚙️ Setup Guide (Gmail OTP Bridge)

To enable automatic OTP retrieval, you must deploy the Gmail bridge script:

1. Go to [script.google.com](https://script.google.com).
2. Create a **New Project**.
3. Copy the contents of `scripts/gas_bridge.js` into the editor.
4. Click **Deploy** > **New Deployment**.
5. **Select Type**: Web App.
6. **Execute as**: Me (Your Gmail).
7. **Who has access**: Anyone (Required for the extension to communicate).
8. Click **Deploy** and copy the **Web App URL**.

---

## 🚀 How to Use

1. **Connect API**: Paste your Gmail Bridge URL into the "GAS URL" field in the popup and click the **Save Icon**.
2. **Auto-Discovery**: The extension will automatically fetch and save your Gmail address from the API.
3. **Configure PIN**: Enter your **Personal PIN** and click the Save icon.
4. **Launch**: Navigate to the Amazon Hiring login page and click **Launch Automation**.
5. **Sit Back**: The engine will now handle the entire sequence:
   - Types Email/PIN.
   - Requests verification code.
   - Waits for Captcha solve (if present).
   - Fetches & fills OTP from Gmail.
   - Clicks final Continue to enter the dashboard.

---

## 🧪 Technical Stack

- **Frontend**: React, Tailwind CSS, Webpack.
- **Storage**: `chrome.storage.local` for per-profile persistence.
- **Logic**: Vanilla JavaScript with custom Human-Emulation utilities.
- **Bridge**: Google Apps Script (GAS) with Gmail API integration.

## 🤝 Support & Safety

This tool is designed for personal productivity. Ensure you comply with Amazon's Terms of Service while using automation tools.

**Built for high-volume recruitment professionals.**
