# Plan3 — BodyMap for Android (awaiting approval)

## Where it stands (found 12 Nov 2026, all uncommitted, from the 10 Nov session)
- `mobile/`: a Capacitor 8 app (`app.bodymap`) that opens the live site in a WebView. It adds "BodyMapApp" to the user
  agent, reads aloud with Android's own text-to-speech, shows `offline.html` when the site can't load, and has an
  icon and splash. Targets Android 7 (API 24) to Android 16 (API 36).
- Website "app mode", shown only inside the app: warm paper background, 20 px text, 56 px buttons, no animations,
  tab bar with icons, opens on Overview (no landing page). Touches 13 website files plus `lib/appMode.ts`.
- Not done yet: none of it is committed or deployed, so the live site has no app mode. This Mac has no Java or
  Android SDK, so the app has never been built or run.

## Approach: keep the WebView app, add native features where they matter
- One codebase. Every website change reaches the app after a push to `main`, with no app update.
- The 3D body, Hindi, trends, medicines and interactions all work as they are.
- Not chosen: a native rewrite (React Native or Kotlin). That means weeks of work, a second 3D body and two copies of
  every feature, for little gain to the user.
- Not chosen: a Trusted Web Activity, Chrome's way to list a website on the Play Store. It can't do the native
  reminders below.

## Phase 1 — get the existing app running (~1.5 h, plus the Android Studio download)
1. Install Android Studio, which brings Java and the Android SDK (about 3 GB, through Homebrew or the installer).
2. Check app mode in a browser with `?app=1` on desktop and phone widths, then commit and push the website part so
   the live site has it.
3. Build a debug APK and run it on the emulator and on one real phone, ideally a cheap one.
4. Check on the phone:
   - app mode look
   - camera upload
   - 3D body speed
   - Hindi read-aloud
   - the Android back button (goes back a page, exits from Overview)
   - offline screen
5. Make the offline screen bilingual. It is English only today.

## Phase 2 — native features worth installing for (~4 h)
- **Medicine reminders.** A notification at each slot time (8 AM, 2 PM, 8 PM) listing that slot's medicines, in the
  chosen language. It reschedules whenever the medicine plan changes. A "Taken" button on the notification is a
  stretch goal. Uses `@capacitor/local-notifications`, called from the page the same way read-aloud is today.
  Android 13+ asks for notification permission once, with a plain sentence explaining why.
- **Check-up reminders.** One notification on the morning a follow-up or routine test from Upcoming falls due.
- **Scan a document.** Take a photo with automatic edge detection and cropping, using Google's ML Kit document
  scanner if a maintained Capacitor plugin exists. Otherwise keep the camera photo, which works today.
- **Share.** Send a record's image or a one-page summary to the family WhatsApp or to the doctor, through Android's
  share sheet.
- Reminder times stay at 8 AM, 2 PM and 8 PM, as on the Medicines page. Choosing your own times is not in this round.

## Phase 3 — Play Store (~2 h of work, then Google's review)
- Release signing key, kept outside git, and an app bundle (.aab).
- A Play Console account, a one-time $25 fee paid by you.
- Store listing in English and Hindi, with phone screenshots.
- A privacy policy page on the site.
- Google's health apps declaration and data safety form: records stay on the phone, and a document is sent to
  Gemini through our server only to be read.
- Risk: Google rejects apps that are "just a website". Phase 2's reminders, scanning and sharing are what make it a
  real app, so Phase 3 goes after Phase 2.

## Decisions for you
- Distribution: a sideloaded APK for demos (Phase 1 is enough), or the Play Store (all three phases).
- Internet: the app needs internet to open. Bundling the site for offline use clashes with the API routes, so it is
  not in this plan. Records already stay on the phone.

## Not in this round
- iPhone. Capacitor can add iOS later, but it needs Xcode and a $99/year Apple developer account.
- Offline reading of reports, custom reminder times, home-screen widget, voice questions.
