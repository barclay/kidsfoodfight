import { render, waitFor } from '@testing-library/react-native';
import App from '../../../App';

describe('App smoke', () => {
  it('boots past splash and shows the login surface when unauthenticated', async () => {
    const screen = render(<App />);

    await waitFor(
      () => {
        expect(screen.getByText('Kids Food Fight')).toBeTruthy();
        expect(screen.getByText('Sign in to continue')).toBeTruthy();
      },
      { timeout: 5000 },
    );
  });
});
