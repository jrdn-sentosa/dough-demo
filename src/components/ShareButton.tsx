import { useState } from 'react';
import { getShare } from '../content/loader';
import type { BreadId } from '../domain/breads';
import type { ShareKind } from '../domain/share';
import { ShareSheet } from './ShareSheet';
import { SliceButton } from './SliceButton';

interface ShareButtonProps {
  kind: ShareKind;
  bread: BreadId;
  mastered: boolean;
}

/** "Share" opens the share sheet. Used on the celebration screen and the quiz end screen. */
export function ShareButton({ kind, bread, mastered }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <SliceButton onClick={() => setOpen(true)}>{getShare().button.label}</SliceButton>
      {open && <ShareSheet kind={kind} bread={bread} mastered={mastered} onClose={() => setOpen(false)} />}
    </>
  );
}
