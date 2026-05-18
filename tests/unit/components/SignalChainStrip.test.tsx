import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SignalChainStrip } from '@/components/SignalChainStrip';

describe('SignalChainStrip', () => {
  it('renders 11 slot labels (PRE..VOL)', () => {
    render(<SignalChainStrip effects={[]} />);
    ['PRE','WAH','BST','AMP','NR','CAB','EQ','MOD','DLY','RVB','VOL'].forEach((l) =>
      expect(screen.getByText(l)).toBeInTheDocument(),
    );
  });

  it('shows real names from effects[] when provided', () => {
    render(<SignalChainStrip effects={['', '', '', 'Marshall® JCM800', '', 'Mesa Cab', '', '', '', '', '']} />);
    expect(screen.getByText('Marshall® JCM800')).toBeInTheDocument();
    expect(screen.getByText('Mesa Cab')).toBeInTheDocument();
  });
});
