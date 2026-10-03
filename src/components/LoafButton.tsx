import type { ButtonHTMLAttributes } from 'react';

export function LoafButton({ children, className = '', type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={`loaf-button ${className}`.trim()} {...rest}>
      <span className="loaf-button__scores" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      {children}
    </button>
  );
}
