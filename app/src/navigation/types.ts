import type { AvailableChallenge } from '../types/challenges';

export type ChallengesStackParamList = {
  ChallengesList: undefined;
  ChallengeDetail: { challenge: AvailableChallenge };
  ChallengePost: { challengeId: string; challengeTitle: string };
};
