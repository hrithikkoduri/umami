import { Button, Icon, useToast } from '@umami/react-zen';
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
  const { toast } = useToast();
  const { t, labels, messages, getErrorMessage } = useMessages();
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
      // Ordering is server-owned, so the row only moves once the list refetches.
      touch('websites');
    } catch (error) {
      setOverride(null);
      toast(getErrorMessage(error as Error) || t(messages.error));
    }
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
