import { useApi } from '../useApi';
import { useModified } from '../useModified';

export function useWebsiteFavouriteMutation(websiteId: string) {
  const { post, del, useMutation } = useApi();
  const { touch } = useModified('websites');

  return useMutation({
    mutationFn: (isFavourite: boolean) =>
      isFavourite
        ? post(`/websites/${websiteId}/favourite`)
        : del(`/websites/${websiteId}/favourite`),
    onSuccess: () => {
      touch('websites');
    },
  });
}
