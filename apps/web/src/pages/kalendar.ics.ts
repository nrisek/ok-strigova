import type { APIRoute } from 'astro';
import { club, clubMatches, competitionFor, competitionShortName, snapshot } from '../lib/data';
import { buildCalendar } from '../lib/ical';

export const GET: APIRoute = () =>
  new Response(
    buildCalendar({
      name: `${club.name} – utakmice`,
      matches: clubMatches,
      stamp: snapshot.generatedAt,
      competitionName: (id) => {
        const c = competitionFor(id);
        return c ? competitionShortName(c) : id;
      },
    }),
    { headers: { 'Content-Type': 'text/calendar; charset=utf-8' } },
  );
