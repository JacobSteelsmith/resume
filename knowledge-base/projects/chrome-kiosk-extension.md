# Google Chrome Kiosk Extension - Secure Exam Delivery Platform

## Project Overview

Jacob built and published a Google Chrome extension to the Chrome Web Store early in his career, providing a secure kiosk-mode exam delivery platform. The extension was deployed organization-wide across test centers, replacing expensive third-party kiosk software with a custom-built solution. This Chrome App enforced a locked-down testing environment that prevented candidates from navigating away from the exam, accessing other applications, or capturing screen content during proctored assessments.

## Security Features

### Fullscreen Enforcement

The extension used the Chrome `overrideEscFullscreen` permission to maintain persistent fullscreen mode. The Chrome App Window API launched the application in fullscreen state on startup, and the overrideEscFullscreen permission prevented candidates from exiting fullscreen via the Escape key. This created an immersive, locked-down testing environment where the exam content occupied the entire screen with no browser chrome visible.

### Key Interception and Prevention

Jacob implemented comprehensive keyboard event interception to block potentially disruptive key combinations:

- **Escape key** (keyCode 27): Intercepted and suppressed to prevent fullscreen exit attempts
- **PrintScreen key** (keyCode 44): Blocked to prevent screen capture of exam content
- **Alt key** (keyCode 18): Intercepted to prevent Alt+Tab application switching
- **Ctrl key** (keyCode 17): Blocked to prevent Ctrl+C copying and other keyboard shortcuts

All intercepted key events triggered both `preventDefault()` and `stopPropagation()` to ensure complete suppression, followed by a visual warning to the candidate.

### Blur and Focus-Loss Detection

The extension monitored window focus state to detect when candidates attempted to switch away from the exam application. When focus loss was detected:

1. An audio alert (`alert.mp3`) played on loop to draw attention back to the exam
2. A countdown warning displayed indicating the exam would close in 5 seconds
3. If the candidate returned focus, the warning dismissed with a secondary reminder about the consequences
4. After repeated violations (4 blur events), the exam automatically terminated by redirecting the webview to an exam-closed endpoint with a reason code

This graduated response system balanced security enforcement with candidate experience, giving legitimate accidental focus losses a chance to recover while terminating deliberate cheating attempts.

### Automatic Exam Termination

After repeated security violations (blur/focus-loss events exceeding the threshold), the extension automatically terminated the exam session. The webview navigated to a server-side exam closure endpoint with a reason parameter, ensuring the termination was recorded server-side for proctor review and audit purposes.

### Webview Data Clearing on Close

When the extension window closed, the `onclose` handler cleared all webview data including application cache, cookies, file systems, IndexedDB, localStorage, and WebSQL storage. This ensured no exam content, session tokens, or candidate data persisted on the testing machine between sessions, maintaining both security and candidate privacy.

## Chrome App Architecture

### Kiosk-Enabled Manifest

The extension used Chrome App manifest version 2 with `kiosk_enabled: true`, enabling deployment in Chrome OS kiosk mode at test centers. The manifest declared permissions for `webview`, `fullscreen`, `overrideEscFullscreen`, `power` (to prevent sleep), and `accessibilityFeatures` for compatibility with assistive technologies. The `app.background.scripts` entry point launched the Chrome App Window.

### Chrome App Window API

The background script (`main.js`) used `chrome.app.runtime.onLaunched` to create a fullscreen Chrome App window via `chrome.app.window.create()`. The window launched in fullscreen state immediately, providing an instant locked-down environment without any transition period where candidates could interact with the underlying OS.

### Webview Sandboxing

The `<webview>` tag provided sandboxed rendering of exam content, isolating the exam website from the Chrome App's privileged context. The webview loaded the exam redirect endpoint and rendered all exam content within this sandboxed container. This architecture separated the security enforcement layer (Chrome App) from the exam content layer (webview), enabling the exam platform to operate independently while the kiosk enforced the secure environment.

### Custom User Agent

Jacob configured a custom user agent string (a kiosk identifier prepended to the default user agent) via `setUserAgentOverride()`. This enabled server-side detection of the kiosk environment, allowing the exam platform to verify that candidates were accessing exams through the approved secure browser rather than a standard web browser.

### PostMessage Communication

The extension established cross-origin communication between the Chrome App and the sandboxed webview content using the `postMessage` API. The app sent an initialization message on `loadstop` to establish the communication channel, and listened for messages from the exam content (such as "exit" commands) to coordinate actions like closing the exam window. This event-driven architecture enabled the exam platform to trigger kiosk-level actions without direct DOM access.

## Early-Career Initiative and Business Impact

Jacob developed this Chrome kiosk extension as a self-directed project early in his career, identifying the business need for secure exam delivery without the cost of expensive third-party kiosk software solutions. The extension was published to the Chrome Web Store and deployed organization-wide at test centers, demonstrating initiative in solving real operational problems through software engineering.

The project showcased Jacob's ability to:

- Identify and solve business problems independently without direction
- Ship production software used across an entire organization
- Work with browser security APIs and Chrome extension architecture
- Design graduated security enforcement systems
- Publish and maintain software through the Chrome Web Store distribution channel

## Technologies

- Google Chrome App APIs (Window API, Runtime API, Commands API)
- Chrome Web Store publishing and distribution
- Webview tag with sandboxed content rendering
- PostMessage cross-origin communication
- JavaScript event handling and keyboard interception
- HTML5 Audio API for alert notifications
- Chrome kiosk mode (kiosk_enabled manifest flag)
- Chrome permissions model (overrideEscFullscreen, webview, fullscreen, power)
