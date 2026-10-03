CREATE TABLE tutor_password_reset_tokens (
  tutor_id uuid PRIMARY KEY REFERENCES tutor(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);
CREATE INDEX tutor_password_reset_tokens_expires_at_idx ON tutor_password_reset_tokens(expires_at);
