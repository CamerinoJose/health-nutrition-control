# Known Errors and Solutions

This file documents common errors, warnings, and their solutions for the BienestarApp Mobile project.

---

## 1. expo-notifications: Android Push notifications (remote notifications) functionality provided by expo-notifications was removed from Expo Go with the release of SDK 53

**Solution:**
- Use a development build (EAS Dev Client) instead of Expo Go for full push notification support.
- See: https://docs.expo.dev/develop/development-builds/introduction/

---

## 2. SafeAreaView has been deprecated and will be removed in a future release

**Solution:**
- Replace all usages of `SafeAreaView` from `react-native` with `SafeAreaView` from `react-native-safe-area-context`.
- See: https://github.com/th3rdwave/react-native-safe-area-context

---

## 3. Background image failed to load: Unexpected HTTP code 503

**Solution:**
- This is a temporary error from the Unsplash API. No code change needed. Try again later or use a static image if persistent.

---

## 4. Property 'require' doesn't exist (Expo Go)

**Solution:**
- Ensure babel.config.js uses 'babel-preset-expo'.
- All icons in app.json must be valid, square PNGs (1024x1024).
- No require(), process, or Node.js globals in your code or dependencies.
- All dependencies must match the Expo SDK version.
- Clear cache with `npx expo start -c` after any config or dependency change.

---

Add new errors and solutions as they are discovered.
