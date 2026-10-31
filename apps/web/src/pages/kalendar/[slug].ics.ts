import type { APIRoute } from 'astro';
import type { Team } from '@ok-strigova/scraper/model';
import { competitionFor, competitionShortName, matchesOf, snapshot, teamLabel, teams } from '../../lib/data';
import { buildCalendar } from '../../lib/ical';

export function getStaticPaths() {
  return teams.map((team) => ({ params: { slug: team.slug }, props: { team } }));
}

export const GET: APIRoute<{ team: Team }> = ({ props }) =>
  new Response(
    buildCalendar({
      name: `${teamLabel(props.team)} – utakmice`,
      matches: matchesOf(props.team),
      stamp: snapshot.generatedAt,
      competitionName: (id) => {
        const c = competitionFor(id);
        return c ? competitionShortName(c) : id;
      },
    }),
    { headers: { 'Content-Type': 'text/calendar; charset=utf-8' } },
  );
