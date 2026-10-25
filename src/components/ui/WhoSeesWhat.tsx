export type WhoSeesWhatProps = {
  rows: { who: string; team: string | null; career: string | null }[];
};

/** Per track, what each other person can see. State the strongest true thing. */
export function WhoSeesWhat({ rows }: WhoSeesWhatProps) {
  return (
    <table className="ltw-wsw">
      <thead>
        <tr>
          <th scope="col">Who</th>
          <th scope="col">Grow in my role</th>
          <th scope="col">Change careers</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.who}>
            <th scope="row">{row.who}</th>
            <td>{row.team}</td>
            <td>{row.career}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
