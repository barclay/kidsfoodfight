import type { AvailableChallenge } from '../types/challenges';

export type ChallengesStackParamList = {
  ChallengesList: undefined;
  ChallengeDetail: { challenge: AvailableChallenge };
  ChallengePost: { challengeId: string; challengeTitle: string };
  ChallengePhotoEditor: {
    challengeId: string;
    challengeTitle: string;
    imageUris: string[];
    comment?: string;
  };
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  ProfilePhotoCrop: { imageUri: string };
};
