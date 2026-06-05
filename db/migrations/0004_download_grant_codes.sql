-- Store the display code for admin-side download grant management.

ALTER TABLE download_grants ADD COLUMN code TEXT;

CREATE UNIQUE INDEX idx_download_grants_code ON download_grants (code);
