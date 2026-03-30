import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  Icon: LucideIcon;
  label: string;
  value: ReactNode;
};

/** Read-only field row for view modals (icon + label + boxed value). */
export function ViewReadonlyField({ Icon, label, value }: Props) {
  return (
    <div className="um_view_field">
      <div className="um_view_field_head">
        <Icon className="um_view_field_icon" size={18} strokeWidth={1.75} aria-hidden />
        <span className="um_view_field_label">{label}</span>
      </div>
      <div className="um_view_field_box">{value}</div>
    </div>
  );
}
