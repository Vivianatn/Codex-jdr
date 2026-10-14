/**
 * Database schema (D-262). Never edit a past migration: add a new one.
 * Statements are separated by `;` at the end of a line.
 */
export const MIGRATIONS: string[] = [
  // 1: accounts, campaigns, members, join requests, campaign records.
  `
  CREATE TABLE users (
    id uuid PRIMARY KEY,
    email text NOT NULL,
    email_key text NOT NULL UNIQUE,
    display_name text NOT NULL,
    password_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_login_at timestamptz,
    failed_logins int NOT NULL DEFAULT 0,
    locked_until timestamptz
  );
  CREATE TABLE sessions (
    token_hash text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL
  );
  CREATE INDEX sessions_user ON sessions (user_id);
  CREATE TABLE password_resets (
    token_hash text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
    expires_at timestamptz NOT NULL
  );
  CREATE TABLE campaigns (
    id text PRIMARY KEY,
    owner_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
    name text NOT NULL,
    invite_code text UNIQUE,
    listed boolean NOT NULL DEFAULT false,
    live jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE members (
    campaign_id text NOT NULL REFERENCES campaigns ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('owner', 'editor', 'player')),
    character_id text,
    joined_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (campaign_id, user_id)
  );
  CREATE INDEX members_user ON members (user_id);
  CREATE TABLE join_requests (
    id uuid PRIMARY KEY,
    campaign_id text NOT NULL REFERENCES campaigns ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
    message text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (campaign_id, user_id)
  );
  CREATE SEQUENCE record_rev;
  CREATE TABLE records (
    tbl text NOT NULL,
    id text NOT NULL,
    campaign_id text NOT NULL REFERENCES campaigns ON DELETE CASCADE,
    data bytea,
    rev bigint NOT NULL,
    updated_by uuid,
    updated_device text,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tbl, id)
  );
  CREATE INDEX records_campaign_rev ON records (campaign_id, rev);
  CREATE INDEX records_campaign_tbl ON records (campaign_id, tbl)
  `,
  // 2: profiles (picture, banner, motto, adventurer code) and adventurers (friends, D-267).
  `
  ALTER TABLE users ADD COLUMN bio text NOT NULL DEFAULT '';
  ALTER TABLE users ADD COLUMN avatar text;
  ALTER TABLE users ADD COLUMN banner text;
  ALTER TABLE users ADD COLUMN profile_rev int NOT NULL DEFAULT 0;
  ALTER TABLE users ADD COLUMN friend_code text UNIQUE;
  CREATE TABLE friendships (
    requester uuid NOT NULL REFERENCES users ON DELETE CASCADE,
    addressee uuid NOT NULL REFERENCES users ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    accepted_at timestamptz,
    PRIMARY KEY (requester, addressee),
    CHECK (requester <> addressee)
  );
  CREATE INDEX friendships_addressee ON friendships (addressee)
  `,
]
