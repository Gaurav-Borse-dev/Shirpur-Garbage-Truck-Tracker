# CleanTrack — Backend Server & Services

This directory contains all backend logic, server endpoints, authentication services, push notification services, realtime tracking, and Supabase configuration.

## Structure

- **`src/server/`**:
  - `auth.functions.ts`: Server functions for Admin login and OTP verification.
  - `session.server.ts`: Encrypted session cookie issuance and validation.
  - `push.server.ts` & `push.functions.ts`: Server-side Web Push notification handlers.
  - `fcm.server.ts`: Firebase Cloud Messaging server integration.
  - `tracking.server.ts` & `tracking.functions.ts`: Realtime vehicle tracking server handlers.
  - `server.ts`: Server entry point and SSR error normalization wrapper.
- **`src/integrations/supabase/`**:
  - `client.ts`: Supabase client initialization.
  - `auth-attacher.ts`: Supabase auth headers & token synchronization.
  - `types.ts`: Auto-generated Supabase database type definitions.
- **`supabase/`**:
  - Database migrations, project configuration (`config.toml`), and Edge Functions.

## Commands

```bash
# Install dependencies
npm install

# Start backend server in development mode
npm run dev

# Build backend production bundle
npm run build
```
