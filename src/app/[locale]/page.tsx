import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  // Home page redirects to editor — the editor IS the main page
  const t = await getTranslations('home');
  void t; // ensure locale is resolved
  redirect('./editor');
}
