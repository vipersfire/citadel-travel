import { useId, type ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as SelectPrimitive from '@radix-ui/react-select';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check, ChevronDown, X } from 'lucide-react';
export function Select({
  label,
  options,
  value,
  onValueChange,
  name,
}: {
  label: string;
  options: { value: string; label: string }[];
  value?: string;
  onValueChange: (value: string) => void;
  name?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label id={id}>{label}</label>
      <SelectPrimitive.Root value={value} onValueChange={onValueChange} name={name}>
        <SelectPrimitive.Trigger className="select-trigger" aria-labelledby={id}>
          <SelectPrimitive.Value placeholder="Choose…" />
          <SelectPrimitive.Icon>
            <ChevronDown size={16} />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content className="select-content" position="popper">
            <SelectPrimitive.Viewport>
              {options.map((o) => (
                <SelectPrimitive.Item key={o.value} value={o.value} className="select-item">
                  <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator>
                    <Check size={16} />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  );
}
export function Checkbox({
  label,
  checked,
  onCheckedChange,
  name,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  name?: string;
}) {
  const id = useId();
  return (
    <label className="checkbox" htmlFor={id}>
      <CheckboxPrimitive.Root
        id={id}
        className="checkbox-control"
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        name={name}
      >
        <CheckboxPrimitive.Indicator>
          <Check size={16} />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      {label}
    </label>
  );
}
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dialog-overlay" />
        <DialogPrimitive.Content
          className="dialog-content"
          aria-describedby={description ? 'dialog-description' : undefined}
        >
          <div className="section-head">
            <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <button className="icon-button" aria-label="Close dialog">
                <X />
              </button>
            </DialogPrimitive.Close>
          </div>
          {description && (
            <DialogPrimitive.Description id="dialog-description">
              {description}
            </DialogPrimitive.Description>
          )}
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
export function Tabs({
  value,
  onValueChange,
  tabs,
}: {
  value: string;
  onValueChange: (value: string) => void;
  tabs: { value: string; label: string; content: ReactNode }[];
}) {
  return (
    <TabsPrimitive.Root value={value} onValueChange={onValueChange}>
      <TabsPrimitive.List className="filter-tabs" aria-label="Workspace tabs">
        {tabs.map((t) => (
          <TabsPrimitive.Trigger
            key={t.value}
            value={t.value}
            className={value === t.value ? 'selected' : ''}
          >
            {t.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {tabs.map((t) => (
        <TabsPrimitive.Content key={t.value} value={t.value}>
          {t.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}
