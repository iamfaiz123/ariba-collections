import { useEffect } from 'react';
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · Ariba Collections` : 'Ariba Collections — Ladies Suits';
  }, [title]);
}
