BEGIN;

DROP SCHEMA IF EXISTS ct4 CASCADE;
DROP ROLE IF EXISTS ct4_app;
CREATE ROLE ct4_app NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE SCHEMA ct4;

CREATE TABLE ct4.workspaces (
  id uuid PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE ct4.memberships (
  workspace_id uuid NOT NULL REFERENCES ct4.workspaces(id),
  user_id uuid NOT NULL,
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE ct4.issues (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES ct4.workspaces(id),
  identifier text NOT NULL,
  title text NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  UNIQUE (workspace_id, identifier)
);

ALTER TABLE ct4.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE ct4.workspaces FORCE ROW LEVEL SECURITY;
ALTER TABLE ct4.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE ct4.memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE ct4.issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE ct4.issues FORCE ROW LEVEL SECURITY;

CREATE POLICY workspace_member_select ON ct4.workspaces
  FOR SELECT TO ct4_app
  USING (
    id = current_setting('app.workspace_id', true)::uuid
    AND EXISTS (
      SELECT 1
      FROM ct4.memberships membership
      WHERE membership.workspace_id = id
        AND membership.user_id = current_setting('app.user_id', true)::uuid
    )
  );

CREATE POLICY membership_self_select ON ct4.memberships
  FOR SELECT TO ct4_app
  USING (
    workspace_id = current_setting('app.workspace_id', true)::uuid
    AND user_id = current_setting('app.user_id', true)::uuid
  );

CREATE POLICY issue_member_select ON ct4.issues
  FOR SELECT TO ct4_app
  USING (
    workspace_id = current_setting('app.workspace_id', true)::uuid
    AND EXISTS (
      SELECT 1
      FROM ct4.memberships membership
      WHERE membership.workspace_id = issues.workspace_id
        AND membership.user_id = current_setting('app.user_id', true)::uuid
    )
  );

CREATE POLICY issue_member_update ON ct4.issues
  FOR UPDATE TO ct4_app
  USING (
    workspace_id = current_setting('app.workspace_id', true)::uuid
    AND EXISTS (
      SELECT 1
      FROM ct4.memberships membership
      WHERE membership.workspace_id = issues.workspace_id
        AND membership.user_id = current_setting('app.user_id', true)::uuid
    )
  )
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);

GRANT USAGE ON SCHEMA ct4 TO ct4_app;
GRANT SELECT ON ct4.workspaces, ct4.memberships TO ct4_app;
GRANT SELECT, UPDATE ON ct4.issues TO ct4_app;

INSERT INTO ct4.workspaces (id, name) VALUES
  ('10000000-0000-4000-8000-000000000001', 'Alpha'),
  ('20000000-0000-4000-8000-000000000002', 'Beta');

INSERT INTO ct4.memberships (workspace_id, user_id) VALUES
  ('10000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002');

INSERT INTO ct4.issues (id, workspace_id, identifier, title) VALUES
  ('11000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000001', 'ENG-1', 'Alpha issue'),
  ('22000000-0000-4000-8000-000000000022', '20000000-0000-4000-8000-000000000002', 'ENG-1', 'Beta issue');

COMMIT;
