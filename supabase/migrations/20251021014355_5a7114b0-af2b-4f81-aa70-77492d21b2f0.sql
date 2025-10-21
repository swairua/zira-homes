
-- Drop trial and subscription related tables
DROP TABLE IF EXISTS trial_configurations CASCADE;
DROP TABLE IF EXISTS trial_notification_templates CASCADE;
DROP TABLE IF EXISTS trial_status_logs CASCADE;
DROP TABLE IF EXISTS trial_usage_tracking CASCADE;

-- Drop subscription/trial related functions
DROP FUNCTION IF EXISTS get_landlord_trial_status(uuid) CASCADE;

-- Clean up any remaining trial/subscription related RPC functions
DROP FUNCTION IF EXISTS check_trial_limitation(uuid, text, integer) CASCADE;
DROP FUNCTION IF EXISTS get_trial_status(uuid) CASCADE;
DROP FUNCTION IF EXISTS check_plan_feature_access(uuid, text, integer) CASCADE;
