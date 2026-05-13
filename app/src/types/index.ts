export interface User {
  id: string;
  email: string;
  displayName: string;
  /** IANA time zone from the device; send on signup / profile update (e.g. America/Los_Angeles). */
  timezone: string;
  avatarCharacter: string;
  points: number;
  level: number;
  streak: number;
}

export interface Family {
  id: string;
  name: string;
  country: string;
  points: number;
  members: FamilyMember[];
}

export interface FamilyMember {
  userId: string;
  familyId: string;
  role: 'admin' | 'member';
  user: User;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  type: 'food' | 'fitness';
  points: number;
  isGlobal: boolean;
  eventId?: string;
  dayNumber?: number;
}

export interface Activity {
  id: string;
  userId: string;
  challengeId?: string;
  type: 'food' | 'fitness';
  description: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  mediaUrls?: string[];
  createdAt: string;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  accessCode: string;
  startDate: string;
  endDate: string;
  durationDays: number;
}
