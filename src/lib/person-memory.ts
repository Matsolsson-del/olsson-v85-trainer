const PERSON_KEY = "travhub.person";
const PERSON_EXPIRY_KEY = "travhub.person.expires";
const NINETY_DAYS_MS = 1000 * 60 * 60 * 24 * 90;

export function rememberPerson(slug: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PERSON_KEY, slug);
  localStorage.setItem(PERSON_EXPIRY_KEY, String(Date.now() + NINETY_DAYS_MS));
}

export function getRememberedPerson(): string | null {
  if (typeof window === "undefined") return null;
  const slug = localStorage.getItem(PERSON_KEY);
  const expires = Number(localStorage.getItem(PERSON_EXPIRY_KEY) ?? 0);
  if (!slug || !expires || expires < Date.now()) {
    forgetPerson();
    return null;
  }
  return slug;
}

export function forgetPerson() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PERSON_KEY);
  localStorage.removeItem(PERSON_EXPIRY_KEY);
}
