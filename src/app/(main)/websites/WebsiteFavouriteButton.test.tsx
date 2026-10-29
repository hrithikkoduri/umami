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

// react-zen renders table rows positionally (no React key), so a reordered list reuses each row's
// component instance for whichever website lands in that slot. Reproduce that here: no keys, rows
// reordered between renders.
function PositionalRows({ rows }: { rows: { id: string; isFavourite: boolean }[] }) {
  return (
    <div>
      {rows.map(row => (
        <WebsiteFavouriteButton key={undefined} websiteId={row.id} isFavourite={row.isFavourite} />
      ))}
    </div>
  );
}

test('a pending star does not leak onto the row that takes its slot after a reorder', async () => {
  post.mockResolvedValue({ ok: true });
  const { user, rerender } = render(
    <PositionalRows
      rows={[
        { id: 'w-a', isFavourite: false },
        { id: 'w-star', isFavourite: false },
      ]}
    />,
  );

  await user.click(screen.getAllByRole('button', { name: 'Favourite' })[1]);

  // The favourited row moves to the top; w-a takes its old slot.
  rerender(
    <PositionalRows
      rows={[
        { id: 'w-star', isFavourite: true },
        { id: 'w-a', isFavourite: false },
      ]}
    />,
  );

  const [first, second] = screen.getAllByRole('button');
  expect([first.getAttribute('aria-label'), first.getAttribute('aria-pressed')]).toEqual([
    'Unfavourite',
    'true',
  ]);
  expect([second.getAttribute('aria-label'), second.getAttribute('aria-pressed')]).toEqual([
    'Favourite',
    'false',
  ]);
});
