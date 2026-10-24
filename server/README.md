# Meeting minutes server · four-provider revision

Node.js 24 ESM / Vercel / Firebase Admin. All API actions use `/api/app?action=...`; mutations require same-origin JSON and authenticated secure cookie. Required environment variables and Firebase deny rules remain unchanged. No new provider key is placed in source or browser storage.

## Provider settings
`GET settings` returns only key registration booleans/last4, `transcribe` (gemini/openai), `summarize` (gemini/openai/claude/deepseek), `transcribeModel`, `summarizeModel`. Empty model selects a recommended model from that same provider's live model list. No cross-provider failure fallback.

Admin `POST settings`: `{provider,key}`, `{provider,remove:true}`, or selected engines/model IDs. A single key update preserves other keys and engine choices. Keys use AES-256-GCM encryption derived from SESSION_SECRET. Rotating SESSION_SECRET invalidates sessions and stored provider keys.

Admin `POST provider-models {provider,purpose}` returns `{provider,purpose,models:[{id,name}],recommended}`. `provider-test` returns safe connection metadata. These list models only, not inference. Key save validates syntax, not actual account access or billing.

## Gemini direct upload
The former 2MiB Vercel proxy chunks were rejected: live synthetic test showed required granularity 8388608 bytes; 2097152 returned400, 8388608 followed by final remainder returned200. Corrected transport avoids Vercel's request body limit:

1. `POST upload-start {name,size,mimeType}` validates max100MiB, starts one bounded Google resumable upload, returns `{transport:'direct',uploadUrl,uploadToken,chunkSize}`. The URL is an ephemeral upload-only capability, not an API key. Never log or persist it in the browser. The server rejects URLs containing API keys or unexpected hosts/paths.
2. Browser posts Blob chunks directly to the exact Google host with advertised granularity and upload-offset/command headers. CSP permits only that additional connect origin. No API key is sent by the browser. No blind retries after uncertain chunk acceptance.
3. `POST upload-complete {uploadToken,fileName}` retrieves metadata with the server key and checks session, nonce displayName, size, MIME and file identity. Returns `{file}` containing a signed encrypted receipt. Pass the whole object to analyze.
4. `POST upload-cancel {uploadToken}` cancels partial uploads; `{file}` deletes a verified completed file. Analysis finally attempts file deletion. Failed/abandoned provider objects may follow provider retention rules; no raw audio is stored in Firestore.

`upload-chunk` exists only to return a safe409 to stale 2MiB clients. `upload-diagnostic {consent:true}` is admin-only, uploads/deletes a synthetic9MiB WAV using provider chunk granularity and never invokes a model. Rate limited3/15min.

## Analysis and OpenAI transcription
`POST analyze {consent:true,memo,attendees,heldAt,link,file?,transcript?,transcriptionProofs?,audioMeta?}` returns a draft meeting. Memo-only uses the selected summarizer only. Gemini audio is transcribed first, then passed to the chosen summarizer. Drafts never auto-save; only validated confirmed meetings persist. Actual engine/model processing metadata is included in result/export. No remote link fetching.

OpenAI browser preparation: decode locally, downsample16kHz mono PCM16 WAV, split60seconds. Max source100MiB/60min with a conservative256MiB memory guard; browser internals cannot be hard-capped. `POST transcribe-chunk {consent:true,data,chunkIndex,offsetSeconds}` validates bounded WAV and uses only saved OpenAI model/key. Returns transcript, processing, signed proof. Browser preserves every proof including silence. analyze verifies session, order, exact transcript hashes, count, expiry and single actual model before accepting audioMeta and recording transcriber identity. At most120chunks/7200audioseconds per hour per session/IP. Summary attempts6/hour; uploads20/hour.

Errors return only safe `{error,code?,stage?,provider?,upstreamStatus?}`. Never return/log raw upstream bodies, keys, temporary capability URLs or meeting data. Existing8h HttpOnly Secure SameSiteStrict authentication, key length/distinctness and Origin checks remain.

## Verify
`node --test server/*.test.js` covers old security regression, four providers/settings, model discovery, request adapters/errors, proof/WAV validation, direct upload metadata/nonce rules and frontend-to-server PCM compatibility. Typecheck/build additionally required. Real provider inference requires explicit user consent and may cost money; mocks do not prove actual provider availability. Validate actual browser CORS with a synthetic file before retrying user material.
