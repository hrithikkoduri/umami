'use client';

import { Button, Icon } from '@umami/react-zen';
import { Star } from '@/components/icons';

export interface FavouriteButtonProps {
  isFavourite: boolean;
  onToggle: () => void;
  label: string;
  isPending?: boolean;
}

export function FavouriteButton({ isFavourite, onToggle, label, isPending }: FavouriteButtonProps) {
  return (
    <Button
      variant="quiet"
      aria-pressed={isFavourite}
      aria-label={label}
      isDisabled={isPending}
      onPress={onToggle}
    >
      <Icon size="sm" color={isFavourite ? undefined : 'muted'}>
        <Star fill={isFavourite ? 'currentColor' : 'none'} />
      </Icon>
    </Button>
  );
}
