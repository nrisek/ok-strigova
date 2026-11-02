import upravaJson from '../content/uprava.json';
import sponzoriJson from '../content/sponzori.json';

export interface Person {
  name: string;
  role: string;
  email?: string;
  phone?: string;
  /** Putanja do fotografije u public/; bez nje se prikazuje avatar.svg. */
  photo?: string;
}

export interface OrgLevel {
  title: string;
  people: Person[];
}

export interface OrgGroup {
  title: string;
  description?: string;
  people: Person[];
}

export interface Management {
  note?: string;
  /** Hijerarhija odozgo prema dolje. */
  chart: OrgLevel[];
  /** Tijela izvan glavne hijerarhije (stručni stožer, nadzorni odbor). */
  groups: OrgGroup[];
}

export interface Contribution {
  what: string;
  season: string;
}

export interface Sponsor {
  name: string;
  initials: string;
  website?: string;
  since?: number;
  /** Putanja do logotipa u public/; bez njega se prikazuju inicijali. */
  logo?: string;
  contributions: Contribution[];
}

export interface SponsorTier {
  id: string;
  title: string;
  description?: string;
  sponsors: Sponsor[];
}

export interface Sponsors {
  note?: string;
  contactEmail?: string;
  tiers: SponsorTier[];
}

export const management = upravaJson as Management;
export const sponsors = sponzoriJson as Sponsors;
