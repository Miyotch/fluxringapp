# Flux Ring R2 Upload Worker

Issues short-lived presigned PUT URLs so the admin frontend can upload
audio files directly to Cloudflare R2 without exposing R2 credentials.

## Setup

1. **Create an R2 bucket** in the Cloudflare dashboard (e.g. `fluxring-sounds`).
   - Enable Public Access → "Allow Access" to get a `pub-*.r2.dev` URL.

2. **Create R2 API token** (Cloudflare dashboard → R2 → Manage API Tokens):
   - Permissions: Object Read & Write
   - Bucket: select your bucket
   - Save the Access Key ID and Secret Access Key.

3. **Configure CORS** on the bucket (R2 dashboard → bucket → Settings → CORS Policy):
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

4. **Edit `wrangler.toml`**:
   - `bucket_name`: your R2 bucket
   - `R2_PUBLIC_BASE`: the `pub-*.r2.dev` URL
   - `ALLOWED_ORIGIN`: your frontend origin

5. **Install wrangler & deploy**:
   ```sh
   cd cloudflare-worker
   npm install -g wrangler
   wrangler login
   wrangler secret put ADMIN_TOKEN          # generate a strong random string
   wrangler secret put R2_ACCESS_KEY_ID
   wrangler secret put R2_SECRET_ACCESS_KEY
   wrangler secret put R2_ACCOUNT_ID
   wrangler secret put R2_BUCKET_NAME       # same as bucket_name
   wrangler deploy
   ```

6. **Configure the frontend** (`.env` or build env):
   ```
   VITE_R2_UPLOAD_ENDPOINT=https://fluxring-r2-uploader.<account>.workers.dev
   VITE_R2_ADMIN_TOKEN=<the same ADMIN_TOKEN you set above>
   ```

## API

### `POST /upload-url`
Headers: `Authorization: Bearer <ADMIN_TOKEN>`

Body:
```json
{
  "trackId": "abc123",
  "ext": "mp3",
  "contentType": "audio/mpeg",
  "kind": "audio"
}
```

Response:
```json
{
  "uploadUrl": "https://<account>.r2.cloudflarestorage.com/...",
  "publicUrl": "https://pub-XXXX.r2.dev/tracks/abc123/audio.mp3",
  "key": "tracks/abc123/audio.mp3"
}
```

The frontend then `PUT`s the file directly to `uploadUrl` with the
matching `Content-Type`, and stores `publicUrl` in Firestore as `r2_url`.
