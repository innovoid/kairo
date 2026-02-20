-- Function to delete all user data before account deletion
CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Delete user-specific data
  DELETE FROM user_workspace_settings WHERE user_id = current_user_id;
  DELETE FROM workspace_members WHERE user_id = current_user_id;
  DELETE FROM settings WHERE user_id = current_user_id;

  -- Note: Workspaces where user is sole owner are handled by RLS cascade
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION delete_user_account() TO authenticated;
