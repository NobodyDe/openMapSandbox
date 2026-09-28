interface AttributesTableProps {
  attributes: Record<string, string>;
}

export function AttributesTable({ attributes }: AttributesTableProps) {
  return (
    <table className="mt-1 w-full">
      <tbody>
        {Object.entries(attributes).map(([key, value]) => (
          <tr key={key} className="odd:bg-slate-100">
            <th className="pr-2 text-left font-medium text-slate-500">{key}</th>
            <td>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
