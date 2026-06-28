import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeviceStatusBar } from '@/components/DeviceStatusBar';
import type { UseMidiDeviceReturn } from '@/hooks/useMidiDevice';
import type { PushProgress } from '@/core/devicePush';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/../messages/en.json';

// Minimal connected device — only the fields DeviceStatusBar reads on the
// 'connected' render path. Cast keeps the test from enumerating the whole hook.
function connectedDevice(): UseMidiDeviceReturn {
  return {
    status: 'connected',
    errorMessage: null,
    currentSlot: 0,
    presetNames: Array(256).fill(''),
    namesLoadProgress: 256,
    deviceInfo: null,
    handshakeStep: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
  } as unknown as UseMidiDeviceReturn;
}

function wrap(pushProgress: PushProgress | null) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <DeviceStatusBar
        midiDevice={connectedDevice()}
        currentPresetName="Test"
        hasPreset
        onPullRequest={() => {}}
        onPushRequest={() => {}}
        pushProgress={pushProgress}
      />
    </NextIntlClientProvider>,
  );
}

describe('DeviceStatusBar push indicator', () => {
  it('shows nothing when no push is in flight', () => {
    wrap(null);
    expect(screen.queryByTestId('push-progress')).toBeNull();
  });

  it('shows the sending label and block count while configuring', () => {
    wrap({ completed: 3, total: 22, phase: 'configuring' });
    const el = screen.getByTestId('push-progress');
    expect(el.textContent).toContain('Sending to device');
    expect(el.textContent).toContain('3/22');
  });

  it('shows the done label when the push finishes', () => {
    wrap({ completed: 22, total: 22, phase: 'done' });
    const el = screen.getByTestId('push-progress');
    expect(el.textContent).toContain('Sent to device');
  });
});
