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
  // Local optimism, like ReplayPlayback: the star flips before the request resolves. The override
  // carries the website id because react-zen keys table rows by position, not id: a reordered list
  // reuses this component instance for whichever row lands in the same slot, and an unscoped value
  // would show here on an untouched neighbour.
  const [override, setOverride] = useState<{ websiteId: string; value: boolean } | null>(null);
  const favourite = override?.websiteId === websiteId ? override.value : isFavourite;
  const label = t(favourite ? labels.unfavourite : labels.favourite);

  const handlePress = async () => {
    setOverride({ websiteId, value: !favourite });

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
