\set ON_ERROR_STOP on

BEGIN;
SET LOCAL ROLE ct4_app;
SELECT set_config('app.user_id', 'aaaaaaaa-0000-4000-8000-000000000001', true);
SELECT set_config('app.workspace_id', '10000000-0000-4000-8000-000000000001', true);

DO $$
DECLARE
  visible_count integer;
  leaked_count integer;
  changed_count integer;
BEGIN
  SELECT count(*) INTO visible_count FROM ct4.issues;
  IF visible_count <> 1 THEN
    RAISE EXCEPTION 'expected one visible issue, got %', visible_count;
  END IF;

  SELECT count(*) INTO leaked_count
  FROM ct4.issues
  WHERE id = '22000000-0000-4000-8000-000000000022';
  IF leaked_count <> 0 THEN
    RAISE EXCEPTION 'cross-workspace direct read leaked % rows', leaked_count;
  END IF;

  UPDATE ct4.issues
  SET title = 'Accepted revision', revision = revision + 1
  WHERE id = '11000000-0000-4000-8000-000000000011'
    AND revision = 1;
  GET DIAGNOSTICS changed_count = ROW_COUNT;
  IF changed_count <> 1 THEN
    RAISE EXCEPTION 'expected accepted revision update';
  END IF;

  UPDATE ct4.issues
  SET title = 'Stale overwrite', revision = revision + 1
  WHERE id = '11000000-0000-4000-8000-000000000011'
    AND revision = 1;
  GET DIAGNOSTICS changed_count = ROW_COUNT;
  IF changed_count <> 0 THEN
    RAISE EXCEPTION 'stale revision unexpectedly updated % rows', changed_count;
  END IF;
END
$$;

SELECT id, identifier, title, revision FROM ct4.issues ORDER BY identifier;
ROLLBACK;
