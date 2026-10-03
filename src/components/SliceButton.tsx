import type { ButtonHTMLAttributes } from 'react';

export function SliceButton({ children, className = '', type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={`slice-button ${className}`.trim()} {...rest}>
      {children}
    </button>
  );
}
