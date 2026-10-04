/** The "what to look for" points for a high-yield savings account, from the where-to-keep lesson. */
export function HysaPoints({ intro, points, demoNote }: { intro: string; points: readonly string[]; demoNote: string }) {
  return (
    <div className="hysa-points">
      <p>{intro}</p>
      <ul>
        {points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <p className="hysa-points__note">{demoNote}</p>
    </div>
  );
}
