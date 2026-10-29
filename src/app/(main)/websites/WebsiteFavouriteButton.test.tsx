import { beforeEach, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@/test/render';

const post = vi.fn();
const del = vi.fn();
const touch = vi.fn();

vi.mock('@/components/hooks', async importOriginal => ({
  ...(await importOriginal<typeof import('@/components/hooks')>()),
  useApi: () => ({ post, del }),
  useModified: () => ({ touch }),
}));

const { WebsiteFavouriteButton } = await import('./WebsiteFavouriteButton');

beforeEach(() => {
  vi.clearAllMocks();
});

test('offers to add an unstarred website and stars it on click', async () => {
  post.mockResolvedValue({ ok: true });
  const { user } = render(<WebsiteFavouriteButton websiteId="website-1" isFavourite={false} />);

  const button = screen.getByRole('button', { name: 'Favourite' });
  expect(button).toHaveAttribute('aria-pressed', 'false');

  await user.click(button);

  expect(post).toHaveBeenCalledWith('/websites/website-1/favourite');
  expect(del).not.toHaveBeenCalled();
  await waitFor(() => expect(touch).toHaveBeenCalledWith('websites'));
  // Filled star, and the announcement flips to the reverse action.
  expect(screen.getByRole('button', { name: 'Unfavourite' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('offers to unstar a favourited website and unstars it on click', async () => {
  del.mockResolvedValue({ ok: true });
  const { user } = render(<WebsiteFavouriteButton websiteId="website-2" isFavourite />);

  await user.click(screen.getByRole('button', { name: 'Unfavourite' }));

  expect(del).toHaveBeenCalledWith('/websites/website-2/favourite');
  expect(post).not.toHaveBeenCalled();
  await waitFor(() => expect(touch).toHaveBeenCalledWith('websites'));
});

test('reverts the star and leaves the list alone when the request fails', async () => {
  del.mockRejectedValue(new Error('Unauthorized'));
  const { user } = render(<WebsiteFavouriteButton websiteId="website-3" isFavourite />);

  await user.click(screen.getByRole('button', { name: 'Unfavourite' }));

  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Unfavourite' })).toHaveAttribute(
      'aria-pressed',
      'true',
    ),
  );
  expect(touch).not.toHaveBeenCalled();
});
