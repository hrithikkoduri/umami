import { Button, Icon } from '@umami/react-zen';
import { useState } from 'react';
import { useApi, useMessages, useModified } from '@/components/hooks';
import { Star } from '@/components/icons';

export function WebsiteFavouriteButton({
  websiteId,
  isFavourite,
}: {
  websiteId: string;
  isFavourite: boolean;
}) {
  const { post, del } = useApi();
  const { t, labels } = useMessages();
  const { touch } = useModified();
  // Local optimism, like ReplayPlayback: the star flips before the request resolves. The refetched
  // list remounts a row that moves, so a stale value cannot outlive the reorder.
  const [override, setOverride] = useState<boolean | null>(null);
  const favourite = override ?? isFavourite;
  const label = t(favourite ? labels.unfavourite : labels.favourite);

  const handlePress = async () => {
    setOverride(!favourite);

    try {
      await (favourite
        ? del(`/websites/${websiteId}/favourite`)
        : post(`/websites/${websiteId}/favourite`));
    } catch {
      // Keep the star honest when the row does not move away and remount.
      setOverride(null);
    }

    touch('websites');
  };

  return (
    <Button
      variant="quiet"
      aria-label={label}
      aria-pressed={favourite}
      title={label}
      onPress={handlePress}
    >
      <Icon>
        <Star fill={favourite ? 'currentColor' : 'none'} />
      </Icon>
    </Button>
  );
}
