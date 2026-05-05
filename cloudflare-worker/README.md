# Flux Ring R2 Upload Worker

Issues short-lived presigned PUT URLs so the admin frontend can upload
audio files directly to Cloudflare R2.

## Auth flow

1. Frontend obtains the current user's Firebase ID token
2. Sends it as `Authorization: Bearer <idToken>`
3. Worker decodes the UID from the token (no signature check)
4. Worker calls Firestore REST API with the **same token** to read
   `users/{uid}` — Firestore validates the token signature & expiration
5. Worker checks `admin === true` in the returned doc
6. If admin, issues a 5-minute presigned PUT URL for R2

This delegates JWT verification to Firestore, so the Worker doesn't need
to fetch/parse Firebase public keys.

## Setup

### 1. R2 bucket
- Cloudflare dashboard → R2 → Create bucket (e.g. `fluxring-sounds`)
- Settings → Public Access → "Allow Access" to get a `pub-*.r2.dev` URL
- Settings → CORS Policy:
  ```json
  [
    {
      "AllowedOrigins": ["https://fluxringweb.vercel.app"],
      "AllowedMethods": ["PUT", "GET"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3000
    }
  ]
  ```

### 2. R2 API token
- Cloudflare dashboard → R2 → Manage API Tokens
- Permissions: Object Read & Write, scoped to your bucket
- Save Access Key ID and Secret Access Key

### 3. Firestore security rules
Make sure authenticated users can read their own user doc:
```
match /users/{uid} {
  allow read: if request.auth.uid == uid;
}
```

### 4. Edit `wrangler.toml`
- `bucket_name`: your R2 bucket
- `FIREBASE_PROJECT_ID`: your Firebase project ID
- `R2_PUBLIC_BASE`: the `pub-*.r2.dev` URL
- `ALLOWED_ORIGIN`: your frontend origin (Vercel URL)

### 5. Deploy
```sh
cd cloudflare-worker
npm install -g wrangler
wrangler login
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY
wrangler secret put R2_ACCOUNT_ID
wrangler secret put R2_BUCKET_NAME
wrangler deploy
```

### 6. Configure the frontend (Vercel)
On Vercel → Project → Settings → Environment Variables, add:
```
VITE_R2_UPLOAD_ENDPOINT = https://fluxring-r2-uploader.<account>.workers.dev
```
Redeploy the frontend so the new env var is baked into the build.

## API

### `GET /`
Health check. Returns `R2 upload service: OK`.

### `POST /upload-url`
Headers:
- `Content-Type: application/json`
- `Authorization: Bearer <Firebase ID token>` (from `getIdToken()`)

Body:
```json
{
  "trackId": "abc123",
  "ext": "mp3",
  "contentType": "audio/mpeg",
  "kind": "audio"
}
```

Responses:
- `401` — token missing
- `403` — token invalid or user is not admin
- `200`:
  ```json
  {
    "uploadUrl": "https://<account>.r2.cloudflarestorage.com/...",
    "publicUrl": "https://pub-XXXX.r2.dev/tracks/abc123/audio.mp3",
    "key": "tracks/abc123/audio.mp3"
  }
  ```

The frontend then `PUT`s the file directly to `uploadUrl` with the
matching `Content-Type`, and stores `publicUrl` in Firestore as `r2_url`.
