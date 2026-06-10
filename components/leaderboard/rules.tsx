function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-5 border-b border-gray-800/50">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">{title}</h2>
      {children}
    </div>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-300 leading-relaxed">{children}</p>
}

export function Rules() {
  return (
    <div className="px-4 mt-2 mb-24">
      <h1 className="text-xl font-bold py-5 border-b border-gray-800">Rules</h1>

      <Section title="How to Play">
        <P>
          Each round, you predict the score of every match before the deadline. After matches are
          played, you earn points based on how accurate your predictions were. The player with the
          most points at the end of the World Cup wins.
        </P>
      </Section>

      <Section title="Rounds & Deadlines">
        <P>
          You can submit or edit your predictions for any match up until{' '}
          <strong className="text-white font-semibold">noon Central Time on the day of the match</strong>.
          Once that deadline passes, your prediction is locked and cannot be changed.
        </P>
        <P>
          <br />
          If a match kicks off before noon, the deadline moves to{' '}
          <strong className="text-white font-semibold">2 hours before kickoff</strong> instead.
        </P>
        <P>
          <br />
          There are no late entries. If you haven&apos;t predicted a match before its deadline, you get 0
          points for it.
        </P>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-gray-800">
                <th className="text-left pb-2 pr-4">Round</th>
                <th className="text-left pb-2">Start Date</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              {[
                ['Group Stage', 'June 11'],
                ['Round of 32', 'June 28'],
                ['Round of 16', 'July 4'],
                ['Quarterfinals', 'July 9'],
                ['Semifinals', 'July 14'],
                ['Third-Place Match & Final', 'July 18–19'],
              ].map(([round, date]) => (
                <tr key={round} className="border-b border-gray-800/40">
                  <td className="py-2 pr-4">{round}</td>
                  <td className="py-2">{date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-gray-500 mt-3">
          Knockout round matches only become available to predict once both teams are confirmed from
          the previous round.
        </p>
      </Section>

      <Section title="Scoring">
        <P>
          All predictions are based on the <strong className="text-white font-semibold">90-minute result only</strong>.
          Extra time and penalty shootouts do not count.
        </P>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-gray-800">
                <th className="text-left pb-2 pr-4">Result</th>
                <th className="text-left pb-2">Points</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              <tr className="border-b border-gray-800/40">
                <td className="py-2 pr-4">Exact score</td>
                <td className="py-2 font-bold text-emerald-400">3 pts</td>
              </tr>
              <tr className="border-b border-gray-800/40">
                <td className="py-2 pr-4">Right winner or draw, wrong score</td>
                <td className="py-2 font-bold text-yellow-400">1 pt</td>
              </tr>
              <tr className="border-b border-gray-800/40">
                <td className="py-2 pr-4">Wrong result</td>
                <td className="py-2 font-bold text-gray-500">0 pts</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Seeing Other Players' Predictions">
        <P>
          You can only see your own predictions before a match deadline. Once the deadline passes,
          everyone&apos;s predictions for that match become visible. This prevents copying.
        </P>
      </Section>

      <Section title="Prize Pool">
        <P>The prize pool is split between the top two finishers at the end of the tournament:</P>
        <ul className="mt-3 space-y-1.5 text-sm text-gray-300">
          <li><span className="text-white font-semibold">1st place:</span> 70%</li>
          <li><span className="text-white font-semibold">2nd place:</span> 30%</li>
        </ul>
        <p className="text-sm text-gray-500 mt-3">
          If two or more players are tied for 1st, the entire prize pool is divided evenly among
          them — 2nd place receives nothing. If two or more players are tied for 2nd (with a clear
          1st place winner), the 30% is divided evenly among all tied second-place finishers.
        </p>
      </Section>
    </div>
  )
}
