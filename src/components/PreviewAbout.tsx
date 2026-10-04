import { getPreview } from '../content/loader';

/** The early-preview text and the "Not here yet" list. Shared by the welcome notice and Settings, so the copy lives in one place. */
export function PreviewAbout() {
  const about = getPreview().about;
  return (
    <>
      <p className="settings__text">{about.body}</p>
      <p className="settings__text preview-list__title">{about.notHereTitle}</p>
      <ul className="preview-list">
        {about.notHere.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="settings__text preview-list__title">{about.bugTitle}</p>
      <p className="settings__text">{about.bugBody}</p>
    </>
  );
}
