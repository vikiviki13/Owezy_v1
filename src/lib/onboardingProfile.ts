import { supabase } from './supabase';

export interface OnboardingProfile {
  userId: string;
  onboardingCompleted: boolean;
  onboardingCompletedAt: string | null;
}

type OnboardingProfileRow = {
  user_id: string;
  onboarding_completed: boolean;
  onboarding_completed_at: string | null;
};

function mapProfile(row: OnboardingProfileRow): OnboardingProfile {
  return {
    userId: row.user_id,
    onboardingCompleted: row.onboarding_completed,
    onboardingCompletedAt: row.onboarding_completed_at,
  };
}

export async function getOnboardingProfile(userId: string): Promise<OnboardingProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, onboarding_completed, onboarding_completed_at')
    .eq('user_id', userId)
    .single();

  if (error) throw error;
  return mapProfile(data as OnboardingProfileRow);
}

export async function completeOnboarding(userId: string): Promise<OnboardingProfile> {
  const completedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      user_id: userId,
      onboarding_completed: true,
      onboarding_completed_at: completedAt,
      updated_at: completedAt,
    }, { onConflict: 'user_id' })
    .select('user_id, onboarding_completed, onboarding_completed_at')
    .single();

  if (error) throw error;
  return mapProfile(data as OnboardingProfileRow);
}

export function onboardingDestination(completed: boolean) {
  return completed ? '/home' : '/onboarding';
}
