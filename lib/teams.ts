// Knockout fixtures are stored with an empty team name until the matchup is
// resolved. Render those as "TBD" rather than a blank space.
export function displayTeamName(name: string): string {
  return name || 'TBD'
}
