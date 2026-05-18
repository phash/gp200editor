import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AutoLink } from '@/lib/autoLink';

describe('AutoLink', () => {
  it('renders plain text without changes', () => {
    render(<AutoLink text="hello world" />);
    expect(screen.getByText('hello world')).toBeTruthy();
  });

  it('linkifies http and https URLs', () => {
    render(<AutoLink text="visit https://example.com now" />);
    const link = screen.getByRole('link', { name: 'https://example.com' });
    expect(link.getAttribute('href')).toBe('https://example.com');
    expect(link.getAttribute('rel')).toBe('nofollow noopener noreferrer');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('handles multiple URLs', () => {
    render(<AutoLink text="see https://a.com and http://b.com end" />);
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('does not linkify javascript: or data: schemes', () => {
    render(<AutoLink text="click javascript:alert(1) here" />);
    expect(screen.queryByRole('link')).toBeFalsy();
    expect(screen.getByText(/click javascript:alert\(1\) here/)).toBeTruthy();
  });

  it('treats URL-like input as text-node never as HTML', () => {
    const { container } = render(<AutoLink text='<img src=x onerror=alert(1)>' />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('<img src=x onerror=alert(1)>');
  });
});
