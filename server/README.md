# Meeting minutes server

Node ESM, Firebase Admin SDK only. All routes use `/api/app?action=ACTION`. Response errors are `{ "error": "Korean safe message" }`. Responses are never cached. There is no CORS exception.

## Deployment

Required server-only variables: `FIREBASE_SERVICE_ACCOUNT_JSON` (JSON service account with Firestore permissions), `ACCESS_KEY`, `ADMIN_KEY`, and `SESSION_SECRET` (at least 32 characters, generate with a cryptographic RNG). Use separate access/admin keys, each at least 12 characters. Never prefix any of these with VITE_. No Gemini environment variable is necessary: an administrator registers it in the app. Firebase client rules must deny all direct reads/writes. Configure Vercel `api/app.js` maxDuration 300 seconds in vercel.json as well; the module exports maxDuration/config. Plan limits must support this duration. Firebase project must have Firestore Native database provisioned.

Firestore collections: `meetings` (confirmed only), `_mmSettings` (encrypted keys), `_mmRateLimits` (HMAC IDs and counts), `_mmUploads` (progress only). Optionally enable Firestore TTL on `expiresAt` for the latter two internal collections. No raw IP, audio, upload URL, transcript draft, or plaintext API key is stored. Meeting records are shared across authenticated users of this single app. Scope to organization/user if separate tenants are introduced.

SESSION_SECRET rotation logs users out and makes existing encrypted provider credentials unreadable; register AI keys again after rotation. Cookies always use Secure, so integration testing requires HTTPS. Origin is required and must match the request Host on every mutation; command-line tests must explicitly set Origin.

## Contract

- GET session: `{authenticated,admin,configured}`; no login needed.
- POST login `{key,admin?:boolean}`: same session shape. Admin elevation requires an existing authenticated user. 8 attempts per IP/role per 15 minute window, transaction enforced.
- POST logout `{}` clears cookie.
- GET settings: `{keys:{gemini,openai,claude,deepseek},transcribe:'gemini',summarize:'gemini'}`. Each key contains only `{registered,tail}`.
- POST settings (admin): `{provider,key}` OR `{provider,remove:true}` OR `{transcribe:'gemini',summarize:'gemini'}`. Only provider:'gemini' is accepted for registration/removal; other providers and selector values are rejected.
- GET meetings: `{meetings:[...]}`, most recent 200 by authoritative server createdAt.
- POST meetings `{meeting}`: validates the full src/types.ts shape, confirmed status only, UUID v4, byte-size cap with metadata headroom. Returns `{meeting}` with server-authoritative createdAt. Existing confirmed records can be updated. Firestore `_savedAt` is a server timestamp and omitted from API.
- DELETE meetings `{id}` returns `{ok:true}`.
- POST analyze `{memo,attendees,heldAt,link,file?,consent?}`. attendees may be a string (comma/newline separated) or string[]. Link is validated but never fetched. At least a memo or verified file is required. consent is a UI acknowledgement and is not stored. Returns `{meeting}` with draft status. Never saves drafts. Six attempts per rolling fixed hourly window for BOTH session and HMAC IP. API failures count as attempts.
- POST upload-start `{name,size,mimeType}` => `{uploadToken,chunkSize:2097152}`. Maximum 100MiB; accepted audio/video MIME whitelist. Twenty upload starts per session/IP hourly window.
- POST upload-chunk `{uploadToken,offset,data,final}`: canonical base64 only, offset multiple of 2MiB; each nonfinal chunk exactly 2MiB, final must end at declared size. Nonfinal returns `{ok:true,offset}`. Final returns `{file:{uri,mimeType,name,size,deleteName,receipt}}`. Pass this ENTIRE object to analyze. Tokens are encrypted AND HMAC-signed; no upload URL or API key is exposed. Chunks are transactionally serialized; a failed/uncertain chunk requires restarting the upload.
- POST upload-cancel `{file}` deletes a completed Gemini file with a valid receipt. There is no resumable-partial cancel UI/API. Completed abandoned files and failed deletions rely on Gemini Files automatic expiration; backend immediately attempts deletion in analysis finally, including analysis errors/limits. No uploaded audio is retained in Firestore.

Gemini model is discovered from live listModels, preferring stable gemini-2.5-flash, then another stable versioned Flash (no preview/latest alias). Audio/video processing is polled for up to approximately 150 seconds; overall analysis deadline leaves room below 300 seconds. Memo-only analysis forces an empty transcript. Missing facts/owners/dates are explicitly unknown and no remote links are retrieved. User must review generated content before confirm/save.

## Verification

`node --test server/backend.test.js` runs nine local suites (no network/secrets): encryption/tampering/expiry, cookie security, same-origin checks, complete meeting schema and UTF-8 size, upload bounds, handler auth and malformed JSON, unsigned URI rejection, upload token/session/base64/offset guards, disabled provider rejection, and readiness enforcement for short/identical authentication keys.

`node node_modules/oxlint/bin/oxlint api server` checks server sources.

Live follow-up: verify Firebase connection and deny rules; HTTPS normal login then admin elevation; register a Gemini key; confirm only last four characters return; memo-only analysis and confirmed save/reload/delete; small MP3 upload with >2MiB multiple chunks and server deletion; >100MiB/forged receipts rejected; six successful/failed analyses then seventh 429; origin mismatch and unsigned session cookie rejected; settings inaccessible without admin; key removal blocks analysis. Real Gemini generation and Firestore transactions require deployment credentials and were not exercised by the offline tests.
