// ADR-0014 — root is unreachable; smoke-test on /widget or /panel
import { notFound } from 'next/navigation';

export default function RootPage() {
  notFound();
}
