'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PrestatairesPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/prestataires/garages'); }, []);
  return null;
}