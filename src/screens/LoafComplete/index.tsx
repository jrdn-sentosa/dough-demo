import { useNavigate } from 'react-router';
import { DraftNote } from '../../components/DraftNote';
import { LoafButton } from '../../components/LoafButton';
import { getLoaf } from '../../content/loader';
import { FLOW_LOAF } from '../useLessonFlow';

// Placeholder until the celebration screen is built (milestone 8). A deposit that bakes the loaf lands here.
export function LoafComplete() {
  const loaf = getLoaf(FLOW_LOAF);
  if (loaf.status !== 'built') throw new Error('the celebration needs a built loaf');
  const copy = loaf.flow.home.completePlaceholder;
  const navigate = useNavigate();
  return (
    <div className="new-loaf">
      <h1 className="screen-title">{copy.title}</h1>
      <DraftNote draft={loaf.draft} />
      <p>{copy.body}</p>
      <div className="new-loaf__actions">
        <LoafButton onClick={() => navigate('/')}>{copy.home}</LoafButton>
      </div>
    </div>
  );
}
