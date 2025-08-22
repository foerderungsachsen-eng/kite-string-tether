/*
  # Add Token System for Webhook Executions

  1. Changes
    - Add `tokens_cost` column to webhooks table (default 1)
    - Add index for better performance
    
  2. Security
    - No changes to RLS policies needed
    - Column is accessible via existing policies
*/

-- Add tokens_cost column to webhooks table
ALTER TABLE public.webhooks 
ADD COLUMN IF NOT EXISTS tokens_cost integer DEFAULT 1 NOT NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_webhooks_tokens_cost ON public.webhooks(tokens_cost);

-- Add comment for documentation
COMMENT ON COLUMN public.webhooks.tokens_cost 
IS 'Number of tokens required to execute this webhook (default: 1)';

-- Update existing webhooks to have default token cost
UPDATE public.webhooks 
SET tokens_cost = 1 
WHERE tokens_cost IS NULL;

-- Grant necessary permissions
GRANT SELECT, UPDATE ON public.webhooks TO authenticated;