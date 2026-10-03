/** Shown on screens whose content is still marked `"draft": true`. */
export function DraftNote({ draft }: { draft: boolean }) {
  if (!draft) return null;
  return (
    <p className="draft-note" role="note">
      Draft content, pending review
    </p>
  );
}
