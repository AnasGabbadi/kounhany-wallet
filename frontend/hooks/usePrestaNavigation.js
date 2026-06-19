import { useRouter, useSearchParams } from 'next/navigation';

// Config centralisée — ajouter un type ici suffit
export const PRESTA_TYPES = {
  garages: {
    label: 'Garages',
    path: '/prestataires/garages',
    filter: (p) => p.type === 'GARAGE',
  },
  pieces: {
    label: 'Pièces',
    path: '/prestataires/pieces',
    filter: (p) => p.type === 'PROVIDER',
  },
};

export function usePrestaNavigation() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Lire le type depuis l'URL (?from=garages)
  const from = searchParams.get('from') || 'garages';
  const currentType = PRESTA_TYPES[from] || PRESTA_TYPES.garages;

  const goToWallet = (prestataireId, type) => {
    router.push(`/prestataires/${prestataireId}/wallet?from=${type}`);
  };

  const goBack = () => {
    router.push(currentType.path);
  };

  return { from, currentType, goToWallet, goBack };
}