-- Add is_paid column to profiles table for subscription gating
ALTER TABLE public.profiles ADD COLUMN is_paid boolean NOT NULL DEFAULT false;