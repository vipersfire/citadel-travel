import {
  cloneElement,
  isValidElement,
  useId,
  type ReactNode,
  type ReactElement,
  type ComponentPropsWithoutRef,
} from 'react';
export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ComponentPropsWithoutRef<'button'> & { variant?: 'primary' | 'outline' | 'text' }) {
  return (
    <button
      {...props}
      type={type}
      className={`${variant === 'text' ? 'text-button' : 'button'} ${variant === 'outline' ? 'outline' : ''} ${className}`}
    />
  );
}
export function Field({
  label,
  help,
  error,
  children,
}: {
  label: string;
  help?: string;
  error?: string;
  children: ReactNode;
}) {
  const fieldId = useId();
  if (
    isValidElement(children) &&
    typeof children.type === 'string' &&
    ['input', 'select', 'textarea'].includes(children.type)
  ) {
    const child = children as ReactElement<
      Pick<ComponentPropsWithoutRef<'input'>, 'id' | 'aria-describedby' | 'aria-invalid'>
    >;
    const id = child.props.id || fieldId;
    const describedBy =
      [child.props['aria-describedby'], help ? `${id}-help` : null, error ? `${id}-error` : null]
        .filter(Boolean)
        .join(' ') || undefined;
    return (
      <div className="field">
        <label htmlFor={id}>{label}</label>
        {cloneElement(child, {
          id,
          'aria-describedby': describedBy,
          'aria-invalid': error ? true : child.props['aria-invalid'],
        })}
        {help && <small id={`${id}-help`}>{help}</small>}
        {error && (
          <span id={`${id}-error`} className="error-text" role="alert">
            {error}
          </span>
        )}
      </div>
    );
  }
  return (
    <label className="field">
      {label}
      {children}
      {help && <small>{help}</small>}
      {error && (
        <span className="error-text" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}
