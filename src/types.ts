export type Page =
  | 'landing'
  | 'auth'
  | 'diagnosis'
  | 'dashboard'
  | 'meal-log'
  | 'meal-details'
  | 'content'
  | 'progress'
  | 'chat'
  | 'profile'
  | 'settings-account'
  | 'settings-notifications'
  | 'settings-theme'
  | 'settings-privacy'
  | 'settings-help'
  | 'admin-login'
  | 'admin-dashboard'
  | 'admin-users'
  | 'admin-articles';

export interface UserProfile {
  name: string;
  email: string;
  photo: string;
  gender: string;
  objectives: string[];
  initialEmotions: string[];
  triggers: string[];
  foods: string[];
  comorbidities: string[];
  height: number;
  weightEvolution: { date: string; value: number }[];
  waistEvolution: { date: string; value: number }[];
  armEvolution: { date: string; value: number }[];
  abdomenEvolution: { date: string; value: number }[];
  hipEvolution: { date: string; value: number }[];
  age: number;
  activityLevel: number;
  imc?: number;
  tmb?: number;
  net?: number;
}
