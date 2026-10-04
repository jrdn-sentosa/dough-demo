import { useNavigate } from 'react-router';
import { useData } from '../../app/DataProvider';
import { DraftNote } from '../../components/DraftNote';
import { LoafButton } from '../../components/LoafButton';
import { OutlineLoaf } from '../../components/OutlineLoaf';
import { SliceButton } from '../../components/SliceButton';
import { getLoaf, getRisk } from '../../content/loader';
import { fillTemplate } from '../../content/template';
import { FLOW_LOAF } from '../useLessonFlow';
import { nextForLoaf } from '../ChooseLoaf/next';
import { useGrowCushion } from '../ChooseLoaf/useGrowCushion';

/**
 * What the risk quiz found, in plain language. Educational, never instructions: it explains what a steadier
 * or growth-focused approach looks like and why, which loaf fits (still "Coming soon") and where the investments
 * would be held. Money needed within 3 years is pointed back to savings, with Grow your cushion offered.
 */
export function RiskResult() {
  const content = getRisk();
  const t = content.result;
  const loaf = getLoaf(FLOW_LOAF);
  if (loaf.status !== 'built') throw new Error('the risk result needs a built loaf');
  const { data } = useData();
  const navigate = useNavigate();
  const grow = useGrowCushion();

  const record = data?.loaves.find((l) => l.loafId === FLOW_LOAF);
  const risk = data?.profile?.risk;
  if (!data || !record || !risk) return null;
  const { result } = risk;
  const next = nextForLoaf(data.profile, record);
  const growOption = next.growTargetMonths === 6 ? loaf.growFurtherOption : loaf.growOption;
  const fits = result.loaf ? getLoaf(result.loaf) : null;

  return (
    <div className="risk-result">
      <h1 className="screen-title">{t.title}</h1>
      <DraftNote draft={content.draft} />
      <p className="risk-result__educational">{t.educational}</p>
      {risk.status !== 'complete' && <p className="notice">{t.skippedNote}</p>}

      {result.keepSavings ? (
        <>
          <section className="card" aria-label={t.keepSavings.title}>
            <h2>{t.keepSavings.title}</h2>
            <p>{t.keepSavings.body}</p>
          </section>
          {next.growTargetMonths !== null && (
            <section className="card" aria-label={growOption.title}>
              <h2>{growOption.title}</h2>
              <p>{t.keepSavings.grow}</p>
              <p className="risk-result__muted">{growOption.summary}</p>
              <SliceButton onClick={() => grow.start(next.growTargetMonths as 3 | 6)}>
                {next.growTargetMonths === 6 ? loaf.flow.choose.saveButtonFurther : loaf.flow.choose.saveButton}
              </SliceButton>
              {grow.error && !grow.sheet && (
                <p className="field-error" role="alert">
                  {grow.error}
                </p>
              )}
            </section>
          )}
        </>
      ) : (
        <>
          {result.approach && (
            <section className="card" aria-label={t.approach[result.approach].title}>
              <h2>{t.approach[result.approach].title}</h2>
              <p>{t.approach[result.approach].body}</p>
              {fits && (
                <div className="risk-result__fits">
                  <OutlineLoaf loafId={fits.id} width={56} />
                  <p>{fillTemplate(t.loafLine, { loaf: fits.title, bread: fits.bread })}</p>
                  <span className="pill pill--soon">{t.comingSoon}</span>
                </div>
              )}
            </section>
          )}
          <section className="card" aria-label={t.where[result.where ?? 'unknown'].title}>
            <h2>{t.where[result.where ?? 'unknown'].title}</h2>
            <p>{t.where[result.where ?? 'unknown'].body}</p>
          </section>
          {result.startSmall && <p className="notice">{t.startSmall}</p>}
          <p className="risk-result__muted">{t.knowledgeCheck}</p>
        </>
      )}

      <div className="risk-result__actions">
        <LoafButton onClick={() => navigate('/')}>{t.back}</LoafButton>
        <SliceButton onClick={() => navigate('/choose-loaf')}>{t.chooseAgain}</SliceButton>
      </div>
      {grow.sheet}
    </div>
  );
}
