jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { extra: { apiUrl: 'https://api.example.com/api/v1/' } },
    manifest: null,
  },
}));

import { getApiBaseUrl } from '../../lib/apiBaseUrl';

describe('apiBaseUrl smoke', () => {
  it('normalizes the API base from expo extra', () => {
    expect(getApiBaseUrl()).toBe('https://api.example.com/api/v1');
  });
});
