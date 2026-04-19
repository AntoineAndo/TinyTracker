# Tiny Tracker

A tiny app to track anything in your daily life — fully offline.

Built with [Expo](https://expo.dev) and React Native.

## Features

- **Multiple tracker types** — Yes/No, count toward a target, 1–5 range, or running number log
- **Goal & neutral orientations** — goal trackers show streaks and a "Done" button; neutral trackers show Yes/No and no streak
- **Flexible frequency** — daily, weekly, or every N days
- **Streaks** — automatic streak tracking for daily goal trackers
- **Reminders** — optional per-tracker push notifications
- **Fully offline** — all data stored locally on device, no account required
- **Dark mode** — follows system appearance

## Getting started

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npx expo start
```

Then open the app in an [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/), [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/), or on a physical device via [Expo Go](https://expo.dev/go).

## Project structure

```
app/          Screen routes (Expo Router file-based routing)
components/   Shared UI components
context/      React contexts (trackers, settings)
hooks/        Custom hooks
lib/          Types, utilities, and storage layer
assets/       Images and fonts
```

## Tech stack

- [Expo](https://expo.dev) / React Native
- [Expo Router](https://docs.expo.dev/router/introduction/) for file-based navigation
- [AsyncStorage](https://react-native-async-storage.github.io/async-storage/) for offline persistence
- [React Hook Form](https://react-hook-form.com/) for tracker forms
