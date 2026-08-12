const en = {
  profile: 'Profile',
  editProfile: 'Edit Profile',
  preferences: 'Preferences',
  notifications: 'Notifications',
  securityPrivacy: 'Security & Privacy',
  appData: 'App & Data',
  account: 'Account',
  signOut: 'Sign Out',
} as const;

const translations = { en };
export type TranslationKey = keyof typeof en;

export function t(key: TranslationKey, language: keyof typeof translations = 'en') {
  return translations[language][key];
}
