import type { LucideIcon } from "lucide-react";
import "./card_radio_group.css";

export type CardRadioOption = {
  value: string;
  label: string;
  icon: LucideIcon;
};

type Props = {
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: CardRadioOption[];
  /** Accessible name for the radiogroup */
  ariaLabel?: string;
  disabled?: boolean;
};

export function CardRadioGroup({
  name,
  value,
  onChange,
  options,
  ariaLabel,
  disabled = false,
}: Props) {
  return (
    <div className="card_radio_group" role="radiogroup" aria-label={ariaLabel}>
      {options.map((opt) => {
        const selected = value === opt.value;
        const Icon = opt.icon;
        return (
          <label
            key={opt.value}
            className={`card_radio_card${selected ? " card_radio_card_selected" : ""}`}
          >
            <input
              type="radio"
              className="card_radio_input"
              name={name}
              value={opt.value}
              checked={selected}
              disabled={disabled}
              onChange={() => onChange(opt.value)}
            />
            <span className="card_radio_card_main">
              <Icon className="card_radio_card_icon" size={20} strokeWidth={1.75} aria-hidden />
              <span className="card_radio_card_label">{opt.label}</span>
            </span>
            <span className="card_radio_card_radio" aria-hidden />
          </label>
        );
      })}
    </div>
  );
}
