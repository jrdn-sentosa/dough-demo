import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useData } from '../../app/DataProvider';
import { DraftNote } from '../../components/DraftNote';
import { LoafButton } from '../../components/LoafButton';
import { OutlineLoaf } from '../../components/OutlineLoaf';
import { SliceButton } from '../../components/SliceButton';
import { loafArtUrl } from '../../components/loafArt';
import { getComingSoonLoaves, getLoaf, getPlacement } from '../../content/loader';
import { FLOW_LOAF } from '../useLessonFlow';
import { nextForLoaf } from './next';
import { useGrowCushion } from './useGrowCushion';

type Panel = 'choose' | 'debt';

/**
 * "Choose your next loaf": Keep saving (grow the cushion) or Start investing (the risk quiz).
 * `recommendNext` decides which path gets the "Recommended" pill, and both stay choosable.
 * With card debt, Start investing first says paying off high-interest debt usually comes first.
 */
export function ChooseLoaf() {
  const loaf = getLoaf(FLOW_LOAF);
  if (loaf.status !== 'built') throw new Error('choosing the next loaf needs a built loaf');
  const copy = loaf.flow.choose;
  const placement = getPlacement();
  const { data } = useData();
  const navigate = useNavigate();
  const grow = useGrowCushion();
  const [panel, setPanel] = useState<Panel>('choose');

  const record = data?.loaves.find((l) => l.loafId === FLOW_LOAF);
  if (!data || !record) return null;
  const rec = nextForLoaf(data.profile, record);
  // Debt payoff leads, as in the mockup.
  const comingSoon = [...getComingSoonLoaves()].sort((a, b) => Number(b.id === 'debt-payoff') - Number(a.id === 'debt-payoff'));
  const debtLoaf = comingSoon.find((l) => l.id === 'debt-payoff');

  const personalize = () => navigate('/placement?retake=1&return=/choose-loaf');
  const startInvesting = () => {
    if (rec.debtUnknown) personalize();
    else if (rec.debtNote) setPanel('debt');
    else navigate('/risk-quiz');
  };

  if (panel === 'debt') {
    return (
      <div className="choose">
        <h1 className="choose__title">{copy.invest.title}</h1>
        <DraftNote draft={loaf.draft} />
        <section className="rec rec--note" aria-label={copy.debt.note}>
          <p className="rec__note">{copy.debt.note}</p>
          <p>{copy.debt.body}</p>
        </section>
        {debtLoaf && (
          <div className="option">
            <OutlineLoaf loafId={debtLoaf.id} width={56} />
            <div className="option__text">
              <span className="option__title">{debtLoaf.title}</span>
              <span className="option__why">{`${debtLoaf.bread}. ${debtLoaf.summary}`}</span>
            </div>
            <span className="pill pill--soon">{copy.comingSoon}</span>
          </div>
        )}
        <div className="choose__actions">
          <LoafButton onClick={() => navigate('/risk-quiz')}>{copy.debt.continueAnyway}</LoafButton>
          <SliceButton onClick={() => setPanel('choose')}>{copy.debt.back}</SliceButton>
        </div>
      </div>
    );
  }

  const growOption = rec.growTargetMonths === 6 ? loaf.growFurtherOption : loaf.growOption;
  const saveCard = rec.growTargetMonths !== null && (
    <PathCard
      key="save"
      recommended={rec.path === 'save'}
      recommendedLabel={copy.recommended}
      title={growOption.title}
      summary={growOption.summary}
      art={<img src={loafArtUrl(record.bread, 'shape')} alt="" aria-hidden="true" width={76} height={53} />}
      buttonLabel={rec.growTargetMonths === 6 ? copy.saveButtonFurther : copy.saveButton}
      loafButton={rec.path === 'save'}
      onChoose={() => grow.start(rec.growTargetMonths as 3 | 6)}
    />
  );
  const investCard = (
    <PathCard
      key="invest"
      recommended={rec.path === 'invest'}
      recommendedLabel={copy.recommended}
      title={copy.invest.title}
      summary={copy.invest.summary}
      art={<OutlineLoaf loafId="index-funds" width={76} />}
      buttonLabel={copy.invest.button}
      loafButton={rec.path === 'invest'}
      onChoose={startInvesting}
    />
  );
  const cards = rec.path === 'invest' ? [investCard, saveCard] : [saveCard, investCard];

  return (
    <div className="choose">
      <div className="choose__header">
        <h1 className="choose__title">{copy.title}</h1>
        <p className="choose__intro">{copy.intro}</p>
        <DraftNote draft={loaf.draft} />
      </div>

      {rec.needsPersonalization && (
        <section className="rec" aria-label={placement.personalizePrompt}>
          <p className="rec__prompt">{placement.personalizePrompt}</p>
          <LoafButton onClick={personalize}>{copy.personalize}</LoafButton>
        </section>
      )}

      {grow.error && !grow.sheet && (
        <p className="field-error" role="alert">
          {grow.error}
        </p>
      )}
      {rec.debtUnknown && !rec.needsPersonalization && <p className="choose__note">{copy.debtUnknown}</p>}

      <div className="choose__paths">{cards}</div>

      <section aria-label={copy.moreHeading}>
        <h2 className="choose__more">{copy.moreHeading}</h2>
        {comingSoon.map((l) => (
          <div className="option" key={l.id}>
            <OutlineLoaf loafId={l.id} width={56} />
            <div className="option__text">
              <span className="option__title">{l.title}</span>
              <span className="option__why">{`${l.bread}. ${l.breadWhy}`}</span>
            </div>
            <span className="pill pill--soon">{copy.comingSoon}</span>
          </div>
        ))}
      </section>

      <div className="choose__actions">
        <SliceButton onClick={() => navigate('/')}>{copy.notNow}</SliceButton>
      </div>
      {grow.sheet}
    </div>
  );
}

interface PathCardProps {
  recommended: boolean;
  recommendedLabel: string;
  title: string;
  summary: string;
  art: ReactNode;
  buttonLabel: string;
  /** Only the recommended path gets the loaf button: one per screen. */
  loafButton: boolean;
  onChoose: () => void;
}

function PathCard({ recommended, recommendedLabel, title, summary, art, buttonLabel, loafButton, onChoose }: PathCardProps) {
  return (
    <section className={`rec${recommended ? ' rec--recommended' : ' rec--plain'}`} aria-label={recommended ? recommendedLabel : title}>
      {recommended && <span className="pill pill--butter">{recommendedLabel}</span>}
      <div className="rec__top">
        <span className="rec__art">{art}</span>
        <div className="rec__text">
          <h2>{title}</h2>
          <p>{summary}</p>
        </div>
      </div>
      {loafButton ? <LoafButton onClick={onChoose}>{buttonLabel}</LoafButton> : <SliceButton onClick={onChoose}>{buttonLabel}</SliceButton>}
    </section>
  );
}
