import { useEffect, useState } from 'react';
import { getShare } from '../content/loader';
import type { BreadId } from '../domain/breads';
import { buildShareLink, cardFileName, shareCardContent, shareText } from '../domain/share';
import type { ShareKind, ShareSize } from '../domain/share';
import { renderCard } from '../share/renderCard';
import { copyShareText, shareCard } from '../share/shareImage';
import { ChoiceGroup } from './ChoiceGroup';
import { DraftNote } from './DraftNote';
import { LoafButton } from './LoafButton';
import { SliceButton } from './SliceButton';

interface ShareSheetProps {
  kind: ShareKind;
  bread: BreadId;
  /** The golden finish and sparkles on the loaf. */
  mastered: boolean;
  onClose: () => void;
}

/** The finished picture (or the failure, `blob: null`) for one request, so a change of shape never shows the old one. */
interface Made {
  key: string;
  blob: Blob | null;
  url: string | null;
}
type Note = 'downloaded' | 'copied' | 'copyFailed' | null;

function appOrigin(): string {
  return typeof window === 'undefined' ? '' : window.location.origin;
}

/**
 * Makes the picture as soon as the sheet opens (and again when the shape changes), so the "Share picture"
 * tap only has to hand over a finished picture. Phones only open their share sheet right after a tap.
 * Nothing about the student's money goes in: the card takes the kind, the bread and the golden finish only.
 */
export function ShareSheet({ kind, bread, mastered, onClose }: ShareSheetProps) {
  const copy = getShare();
  const [size, setSize] = useState<ShareSize>('story');
  const [made, setMade] = useState<Made | null>(null);
  const [note, setNote] = useState<Note>(null);

  const link = buildShareLink({ origin: appOrigin() });
  const text = shareText(kind, copy.card, link);
  const key = `${kind}:${bread}:${mastered}:${size}:${link}`;
  const current = made?.key === key ? made : null;
  const status = current === null ? 'preparing' : current.blob ? 'ready' : 'failed';

  useEffect(() => {
    let cancelled = false;
    renderCard({ size, content: shareCardContent(kind, copy.card, link), bread, mastered })
      .then((blob) => {
        if (cancelled) return;
        let url: string | null;
        try {
          url = URL.createObjectURL(blob);
        } catch {
          url = null;
        }
        setMade({ key, blob, url });
      })
      .catch(() => {
        if (!cancelled) setMade({ key, blob: null, url: null });
      });
    return () => {
      cancelled = true;
    };
  }, [key, size, kind, bread, mastered, link, copy.card]);

  useEffect(() => {
    const url = made?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [made]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const onShare = async () => {
    if (!current?.blob) return;
    const result = await shareCard({ blob: current.blob, fileName: cardFileName(kind, size), text });
    setNote(result === 'downloaded' ? 'downloaded' : null);
  };

  const onCopy = async () => {
    setNote((await copyShareText(text)) ? 'copied' : 'copyFailed');
  };

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="share-title">
      <div className="sheet__card share-sheet">
        <h2 id="share-title">{copy.sheet.title}</h2>
        <DraftNote draft={copy.draft} />
        <p>{copy.sheet.intro}</p>
        <ChoiceGroup
          legend={copy.sheet.sizeLegend}
          kind="single"
          name="share-size"
          options={[
            { id: 'story', label: copy.sheet.story },
            { id: 'post', label: copy.sheet.post },
          ]}
          value={[size]}
          onChange={(id) => {
            setSize(id as ShareSize);
            setNote(null);
          }}
        />
        <div className="share-sheet__preview">
          {status === 'preparing' && <p role="status">{copy.sheet.preparing}</p>}
          {status === 'failed' && <p role="alert">{copy.sheet.failed}</p>}
          {current?.url && <img src={current.url} alt={copy.sheet.previewAlt} />}
        </div>
        {note && (
          <p role="status">
            {note === 'downloaded' ? copy.sheet.downloaded : note === 'copied' ? copy.sheet.copied : copy.sheet.copyFailed}
          </p>
        )}
        <LoafButton onClick={onShare} disabled={status !== 'ready'}>
          {copy.sheet.shareImage}
        </LoafButton>
        <SliceButton onClick={onCopy}>{copy.sheet.copyText}</SliceButton>
        <SliceButton onClick={onClose}>{copy.sheet.close}</SliceButton>
      </div>
    </div>
  );
}
