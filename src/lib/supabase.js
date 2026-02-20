import { createClient } from '@supabase/supabase-js';

// Dane pobrane z Supabase (Settings -> API)
const supabaseUrl = 'https://jpvexqnsngwkqrybfncj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwdmV4cW5zbmd3a3FyeWJmbmNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1ODc3MjUsImV4cCI6MjA4NzE2MzcyNX0.SbrvBiL7S6LjqXHoWXRq_LaglJnwy58HQjPgaVyVnsw';
export const supabase = createClient(supabaseUrl, supabaseAnonKey);