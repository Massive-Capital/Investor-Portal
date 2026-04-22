import { parseOrganizationLabelsFromRow } from "./memberAdminShared";

export function UserOrganizationsCell({
  row,
}: {
  row: Record<string, unknown>;
}) {
  const orgs = parseOrganizationLabelsFromRow(row);
  if (orgs.length === 0) {
    return <span className="um_status_muted">—</span>;
  }
  if (orgs.length === 1) {
    return <span>{orgs[0]}</span>;
  }
  return (
    <div className="um_memberships_cell">
      {orgs.map((c, i) => (
        <div key={`${c}-${i}`} className="um_membership_row">
          <span className="um_membership_company">{c}</span>
        </div>
      ))}
    </div>
  );
}
