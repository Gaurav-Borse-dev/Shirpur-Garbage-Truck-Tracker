# CleanTrack — Frontend Application

This directory contains the complete client-side frontend code for the CleanTrack application.

## Structure

- **`src/assets/`**: Images, logos, and visual assets.
- **`src/components/`**: Reusable UI components (AppSplash, BottomSheet, Header, Logo, RequireRole, Toast, TruckMap, icons).
- **`src/hooks/`**: Custom React hooks (useDriverLocation, usePushNotifications, useServerAuth, useTruckEta).
- **`src/routes/`**: TanStack Start file-based routing for Admin, Driver, Resident, OTP, and Login pages.
- **`src/store/`**: Zustand state stores (auth, notifications, trucks).
- **`src/lib/`**: Client helpers, map math, i18n translation strings, and truck route definitions.

## Commands

```bash
# Install dependencies
npm install

# Start frontend dev server
npm run dev

# Production build
npm run build
```
