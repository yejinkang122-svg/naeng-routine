# App Store Release Plan

## Goal

Turn `냉이랑 루틴` from a Vercel-hosted web app into an iOS app that can be tested with TestFlight and submitted to the App Store.

## Recommended Approach

Use Capacitor to wrap the current Next.js app as an iOS app.

Why:

- The current product is already functional as a responsive web app.
- Capacitor lets us reuse the existing UI and Supabase logic.
- We can add native capabilities later, such as camera/photo attachment and local reminders.
- It is much faster than rewriting the whole app in SwiftUI or React Native.

## App Review Risk

A pure website-in-a-WebView can be risky for App Review if it feels too thin or does not provide enough app-like value.

For the first App Store candidate, the app should include at least:

- Polished iOS app icon and launch screen.
- Stable login and demo account for reviewers.
- Native-safe behavior for back/scroll/status-bar areas.
- Camera/photo attachment or local reminder support if possible.
- Privacy policy and support URL.

## Current Blocker

This Mac currently has Command Line Tools, but not full Xcode selected.

`xcodebuild` reports:

```text
xcode-select: error: tool 'xcodebuild' requires Xcode,
but active developer directory '/Library/Developer/CommandLineTools'
is a command line tools instance
```

## User Tasks

1. Install Xcode from the Mac App Store.
2. Open Xcode once and accept the license.
3. Enroll in the Apple Developer Program if App Store/TestFlight distribution is needed.
4. Prepare App Store metadata:
   - App name: 냉이랑 루틴
   - Subtitle
   - Description
   - Keywords
   - Support URL
   - Privacy Policy URL
   - Demo account for App Review

## Developer Tasks

After Xcode is ready:

1. Install Capacitor dependencies.
2. Configure app id:

```text
com.yejinkang.naengroutine
```

3. Add iOS project.
4. Configure app icon and splash/launch assets.
5. Build and open in Xcode.
6. Run on local iPhone simulator or physical device.
7. Configure signing team in Xcode.
8. Archive build.
9. Upload to App Store Connect.
10. Submit to TestFlight first.
11. After TestFlight QA, submit to App Review.

## Estimated Timeline

If Xcode and Apple Developer account are ready:

- Capacitor iOS shell: 0.5 day
- Icon/launch screen/signing setup: 0.5 day
- TestFlight build upload: 0.5 day
- App Store metadata/privacy/demo preparation: 0.5-1 day
- Review iteration buffer: 1-3 days, depending on Apple review feedback

Total practical first submission estimate: 2-4 working days.

## 2nd Release Candidates

These features can improve App Review confidence and product quality:

- Native photo attachment for todo items.
- Local routine reminders.
- Template settings.
- Theme settings.
- AI meal chat input.
- More robust weekly analytics.
