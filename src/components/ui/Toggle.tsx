export type ToggleProps = {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

/** A settings row whose change applies at once. Never inside a form with Save: use Checkbox there. */
export function Toggle({
  id,
  label,
  description,
  checked,
  onChange,
  disabled,
}: ToggleProps) {
  return (
    <div className="ltw-trow">
      <div>
        <div id={`${id}-label`} className="ltw-trow-l">
          {label}
        </div>
        {description && (
          <div id={`${id}-desc`} className="ltw-trow-d">
            {description}
          </div>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        className="ltw-toggle"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-desc` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      />
    </div>
  );
}
