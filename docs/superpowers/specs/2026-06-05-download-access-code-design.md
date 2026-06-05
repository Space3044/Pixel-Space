# Download Access Code Design

## Summary

Add a visitor-facing original-image download permission that is granted by a random access code. Admins select images in the console, generate a code with an expiration time, and share `/access` plus the code. Visitors enter the code on `/access`, see the authorized image list, and can download originals for only those images while the code is valid.

The feature must not change existing admin access, public gallery visibility, private-image direct access behavior, or location privacy rules. It only adds original-download permission for visitors who have a valid code.

## Confirmed Requirements

- Admins generate a code from selected images in the console.
- The code supports expiration presets: 1 day, 7 days, 30 days, and custom time.
- The default expiration is 7 days.
- Codes can be used by multiple visitors and can be reused multiple times until expiration.
- Visitors use a dedicated `/access` page.
- A valid code shows the authorized images and original download actions.
- Expired, invalid, empty, and image-less grants show clear feedback.
- Admin original download through `/api/original/:key` remains unchanged.

## Non-Goals

- No single-use codes.
- No download count limit.
- No grant management list, revoke UI, or audit log in this version.
- No public link that embeds the code in the URL.
- No changes to Cloudflare Access admin authentication.

## Data Model

Add a migration that creates two D1 tables.

```sql
CREATE TABLE download_grants (
  id         TEXT PRIMARY KEY NOT NULL,
  code_hash  TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_download_grants_expires_at ON download_grants (expires_at);

CREATE TABLE download_grant_images (
  grant_id  TEXT NOT NULL,
  image_key TEXT NOT NULL,
  PRIMARY KEY (grant_id, image_key),
  FOREIGN KEY (grant_id) REFERENCES download_grants(id) ON DELETE CASCADE,
  FOREIGN KEY (image_key) REFERENCES images(key) ON DELETE CASCADE
);

CREATE INDEX idx_download_grant_images_image_key ON download_grant_images (image_key);
```

Access codes are generated as 8-character uppercase codes using an alphabet without ambiguous characters. The database stores `sha256(normalized_code)` instead of the plaintext code. `normalized_code` is trimmed and uppercased before hashing.

## API Design

`POST /api/admin/download-grants`

Admin-only. Request body:

```json
{
  "keys": ["image-key-1", "image-key-2"],
  "expires_at": "2026-06-12T12:00:00.000Z"
}
```

The backend validates that `keys` contains 1 to 200 non-empty strings, all selected images exist, and `expires_at` is in the future. Response body:

```json
{
  "code": "A7K9P2QX",
  "expires_at": "2026-06-12T12:00:00.000Z",
  "image_count": 2,
  "access_url": "/access"
}
```

`POST /api/download-grants/verify`

Visitor-facing. Request body:

```json
{
  "code": "A7K9P2QX"
}
```

If the code is valid and unexpired, returns visitor-safe image records:

```json
{
  "expires_at": "2026-06-12T12:00:00.000Z",
  "images": []
}
```

The image records are produced through the existing `rowToRecord` and `scrubRecordForVisitor` flow so hidden locations remain hidden. Private images selected by an admin can appear in this grant result because the grant itself is the sharing permission.

`POST /api/download-grants/original/:key`

Visitor-facing original download. Request body:

```json
{
  "code": "A7K9P2QX"
}
```

The endpoint validates the code, expiration, image membership, and `tg_file_id`. It then streams the Telegram original with the same filename sanitization and `no-store` cache behavior used by the admin original endpoint. Invalid code, expired code, unauthorized image, missing image, and missing archive return existing JSON error responses.

## Frontend Design

In `LibraryView.vue`, keep the existing selection model and bottom batch action bar. Add a `生成验证码` action when `selectedKeys.size > 0`. The action opens a small dialog that lets the admin choose `1天`, `7天`, `30天`, or a custom expiration date/time. After creation, the dialog shows the generated code, `/access`, the expiration time, and copy buttons.

Create `AccessView.vue` under `src/features/access`. The page contains a compact code input and submit action. After a valid verification, it renders the authorized image list with thumbnail, title or original filename, dimensions, expiration text, and an original download button. Download uses `fetch` with `POST /api/download-grants/original/:key`, creates a blob URL, and triggers a browser download without placing the code in the URL.

Add a `/access` route with title `原图通行`. The route is public and does not require admin auth. It does not need to appear in the main navigation; generated grants expose the entry URL to share.

## Error Handling

- Invalid create payload: `400 invalid_download_grant_payload`.
- Empty image selection: `400 invalid_download_grant_payload`.
- Expiration not in the future: `400 invalid_expiration`.
- Some selected images missing: `400 image_not_found`.
- Invalid or expired visitor code: `404 download_grant_not_found`.
- Authorized grant with no remaining images: `200` with an empty `images` array and a page-level empty state.
- Original missing from Telegram archive: `404 original_not_archived`.
- Telegram fetch failure: `500 original_failed`.

## Test Plan

- Migration tests assert the new tables and indexes exist.
- Request/helper tests cover code normalization and hashing.
- Admin API tests cover successful grant creation, missing images, invalid expiration, and non-admin rejection.
- Visitor verify tests cover valid, expired, invalid, and empty-image grant responses.
- Visitor original download tests cover valid download, unauthorized image, expired code, and missing archive.
- UI tests assert LibraryView exposes the generate-code action and expiration presets.
- UI tests assert AccessView has the code form, valid result list, original download behavior, and error states.
- Router tests assert `/access` is public and titled `原图通行`.

## Implementation Notes

- Keep grant logic in a focused shared backend module such as `functions/_shared/download-grants.ts`.
- Reuse `parseJsonObject`, `normalizeStringList`, `rowToRecord`, `scrubRecordForVisitor`, `getTelegramFileUrl`, and `downloadName` behavior.
- Avoid adding a persistent visitor session. The verified code stays in the page state and is sent with each download request.
- Do not alter `/api/original/:key`; it remains admin-only.
- Do not add revoke or grant-list management until the current sharing flow exists and passes tests.
