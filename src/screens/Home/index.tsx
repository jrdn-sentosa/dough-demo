import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useData } from '../../app/DataProvider';
import { AmountSheet } from '../../components/AmountSheet';
import { DraftNote } from '../../components/DraftNote';
import { HabitCard } from '../../components/HabitCard';
import { HysaPoints } from '../../components/HysaPoints';
import { LoafButton } from '../../components/LoafButton';
import { LoafIllustration } from '../../components/LoafIllustration';
import { SliceButton } from '../../components/SliceButton';
import { StageBar } from '../../components/StageBar';
import { TipRow } from '../../components/TipRow';
import { getLoaf } from '../../content/loader';
import { fillTemplate } from '../../content/template';
import { markTipSeen, setHysaCard } from '../../data/habit';
import { addHighYieldAccount } from '../../data/profile';
import { habitPeriod } from '../../domain/habits';
import { isMastered } from '../../domain/mastery';
import { accountRules } from '../../domain/placement';
import { stageChange, tipId, tipStatus } from '../../domain/tips';
import type { TipContext } from '../../domain/tips';
import { MAX_ENTRY_CENTS, checkAmount } from '../../money/amounts';
import { nowFromData } from '../../money/clock';
import { formatCents } from '../../money/format';
import { deposit, statusFor, withdraw } from '../../money/ledger';
import type { LoafStatus } from '../../money/ledger';
import { centsToInput, parseDollarsToCents } from '../../money/parse';
import { FLOW_LOAF } from '../useLessonFlow';
import { stageNotice } from './notice';
import type { StageNotice } from './notice';

type Sheet = 'add' | 'use' | null;

/**
 * What the student typed in an amount sheet: the cents when it is usable, otherwise what to tell them.
 * A typo-sized amount gets the money layer's own message, so the wording stays in one place.
 */
function readAmount(text: string, invalid: string): { cents: number | null; problem: string | null } {
  if (text.trim() === '') return { cents: null, problem: null };
  const cents = parseDollarsToCents(text);
  if (cents === null) return { cents: null, problem: invalid };
  const bad = checkAmount(cents, MAX_ENTRY_CENTS);
  return bad ? { cents: null, problem: bad.message } : { cents, problem: null };
}

const contextOf = (status: LoafStatus): TipContext => ({ stage: status.stage, baked: status.baked });

/** Home: the loaf at its stage, this period's habit, adding to the loaf or using the fund, and the tips that unlock as it rises. */
export function Home() {
  const loaf = getLoaf(FLOW_LOAF);
  if (loaf.status !== 'built') throw new Error('Home needs a built loaf');
  const copy = loaf.flow.home;
  const tips = loaf.tips;
  const { adapter, data, refresh } = useData();
  const navigate = useNavigate();

  const [sheet, setSheet] = useState<Sheet>(null);
  const [amountText, setAmountText] = useState('');
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [notice, setNotice] = useState<StageNotice | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [openTip, setOpenTip] = useState<number | null>(null);

  const record = data?.loaves.find((l) => l.loafId === FLOW_LOAF);
  if (!data || !record) return null;

  const status = statusFor(data, record);
  const ctx = contextOf(status);
  const mastered = isMastered(data.quizAttempts, FLOW_LOAF);
  // Baked and sitting at its target (not rebuilding, not growing): time to choose the next loaf.
  const readyForNext = status.baked && status.percent >= 100 && !status.growing;

  // While growing, the amount, stage and bar count the new part only. The whole fund gets its own line.
  const from = status.growFromCents ?? 0;
  const shownBalance = Math.max(0, status.balanceCents - from);
  const shownTarget = status.targetCents - from;
  const detail = fillTemplate(status.growing ? copy.percentOfNewGoal : copy.percentOfGoal, { percent: `${status.percent}%` });
  const stageLine = fillTemplate(copy.stageLineFormat, {
    stage: status.rebuilding ? copy.rebuilding : copy.stageLine[status.stage],
    detail,
  });

  const habit = data.habit;
  const period = habit
    ? habitPeriod(
        habit,
        data.transactions.filter((t) => t.loafId === FLOW_LOAF && t.type === 'deposit').map((t) => t.at),
        nowFromData(data),
      )
    : null;

  const seen = new Set(data.tipsSeen);
  const tipStages = tips.map((t) => t.stage);
  const showHysaCard = data.hysaCard === 'pending' && accountRules(data.profile?.accounts ?? undefined).needsHysaStep;

  const entry = readAmount(amountText, sheet === 'use' ? copy.useSheet.invalid : copy.addSheet.invalid);
  const amountCents = entry.cents;

  function openSheet(which: Exclude<Sheet, null>) {
    setSheet(which);
    setSheetError(null);
    setAmountText(which === 'add' && habit ? centsToInput(habit.amountCents) : '');
  }

  function changeAmount(text: string) {
    setAmountText(text);
    setSheetError(null);
  }

  function closeSheet() {
    setSheet(null);
    setSheetError(null);
  }

  async function addToLoaf() {
    if (amountCents === null) return;
    const result = await deposit(adapter, FLOW_LOAF, amountCents);
    if (!result.ok) {
      setSheetError(result.message);
      return;
    }
    await refresh();
    closeSheet();
    setMessage(null);
    if (result.baked) {
      // The celebration screen comes in the next milestone. Until then this is a placeholder.
      navigate('/loaf-complete', { state: { rebuilt: result.rebuilt, grown: result.grown } });
      return;
    }
    setNotice(stageNotice(stageChange(ctx, contextOf(result.status), tipStages), copy, tips));
  }

  async function takeFromFund() {
    if (amountCents === null) return;
    const result = await withdraw(adapter, FLOW_LOAF, amountCents);
    if (!result.ok) {
      setSheetError(result.message);
      return;
    }
    await refresh();
    closeSheet();
    setMessage(result.message);
    setNotice(stageNotice(stageChange(ctx, contextOf(result.status), tipStages), copy, tips));
  }

  async function toggleTip(index: number) {
    if (openTip === index) {
      setOpenTip(null);
      return;
    }
    setOpenTip(index);
    await markTipSeen(adapter, tipId(FLOW_LOAF, tips[index].stage));
    await refresh();
  }

  async function haveHysa() {
    await addHighYieldAccount(adapter);
    await refresh();
  }

  async function dismissHysa() {
    await setHysaCard(adapter, 'dismissed');
    await refresh();
  }

  return (
    <div className="home">
      <div className="home__header">
        <div className="home__top">
          <span className="home__eyebrow">{copy.eyebrow}</span>
          <Link className="home__shelf-link" to="/shelf">
            {copy.shelfLink}
          </Link>
        </div>
        <h1 className="home__title">{loaf.title}</h1>
        <DraftNote draft={loaf.draft} />
      </div>

      <section className="loaf-card" aria-label={loaf.title}>
        {mastered && (
          <span className="loaf-card__mastered">
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2B1B12" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5L19 7" />
            </svg>
            {copy.mastered}
          </span>
        )}
        <LoafIllustration loafId={FLOW_LOAF} stage={status.stage} mastered={mastered} />
        <div className="loaf-card__amount">
          <span className="loaf-card__big">{formatCents(shownBalance)}</span>
          <span className="loaf-card__of">{fillTemplate(copy.amountOf, { target: formatCents(shownTarget) })}</span>
        </div>
        <span className="loaf-card__stage">{stageLine}</span>
        {status.growing && (
          <span className="loaf-card__total">
            {fillTemplate(copy.wholeFund, { total: formatCents(status.balanceCents), target: formatCents(status.targetCents) })}
          </span>
        )}
        <span className="loaf-card__total">{copy.keptIn}</span>
        <StageBar percent={status.percent} stage={status.stage} names={copy.stageNames} label={copy.progressLabel} />
      </section>

      {(message || notice) && (
        <div className="notice home__notice" role="status">
          {message && <p>{message}</p>}
          {notice && <p>{notice.text}</p>}
          <div className="home__notice-actions">
            {notice?.tipIndex != null && (
              <button type="button" className="text-button" onClick={() => void toggleTip(notice.tipIndex as number)}>
                {copy.readTip}
              </button>
            )}
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setNotice(null);
                setMessage(null);
              }}
            >
              {copy.dismissNotice}
            </button>
          </div>
        </div>
      )}

      {habit && period && <HabitCard habit={habit} period={period} copy={copy.habitCard} />}

      <div className="home__actions">
        {readyForNext ? (
          <>
            <LoafButton onClick={() => navigate('/choose-loaf')}>{copy.chooseNext}</LoafButton>
            <SliceButton onClick={() => openSheet('add')}>{copy.add}</SliceButton>
          </>
        ) : (
          <LoafButton onClick={() => openSheet('add')}>{copy.add}</LoafButton>
        )}
        <SliceButton onClick={() => openSheet('use')}>{copy.use}</SliceButton>
      </div>

      {showHysaCard && (
        <section className="card hysa-card" aria-label={loaf.flow.savingSetup.hysa.title}>
          <div className="hysa-card__head">
            <h2>{loaf.flow.savingSetup.hysa.title}</h2>
            <button type="button" className="hysa-card__dismiss" aria-label={copy.hysaCardDismiss} onClick={() => void dismissHysa()}>
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <HysaPoints intro={loaf.flow.savingSetup.hysa.intro} points={loaf.flow.savingSetup.hysa.points} demoNote={loaf.flow.savingSetup.hysa.demoNote} />
          <SliceButton onClick={() => void haveHysa()}>{loaf.flow.savingSetup.hysa.haveOne}</SliceButton>
        </section>
      )}

      <section className="tips" aria-label={copy.tips.title}>
        <h2>{copy.tips.title}</h2>
        {tips.map((tip, i) => {
          const id = tipId(FLOW_LOAF, tip.stage);
          const state = tipStatus(tip.stage, ctx, seen.has(id));
          const meta =
            state === 'locked'
              ? tip.stage === 'baked'
                ? copy.tips.unlocksAtBaked
                : fillTemplate(copy.tips.unlocksAt, { stage: copy.stageNames[tip.stage] })
              : state === 'new'
                ? fillTemplate(copy.tips.unlockedAt, { stage: copy.stageNames[tip.stage] })
                : copy.tips.read;
          return (
            <TipRow
              key={id}
              id={tip.stage}
              title={tip.title}
              body={tip.body}
              status={state}
              meta={meta}
              newLabel={copy.tips.new}
              open={openTip === i && state !== 'locked'}
              onToggle={() => void toggleTip(i)}
            />
          );
        })}
      </section>

      <p className="home__disclaimer">{copy.disclaimer}</p>

      {sheet === 'add' && (
        <AmountSheet
          id="add"
          title={copy.addSheet.title}
          label={copy.addSheet.amountLabel}
          value={amountText}
          onChange={changeAmount}
          confirmLabel={fillTemplate(copy.addSheet.confirm, { amount: formatCents(amountCents ?? 0) })}
          cancelLabel={copy.addSheet.cancel}
          disabled={amountCents === null}
          error={sheetError ?? entry.problem}
          onConfirm={() => void addToLoaf()}
          onCancel={closeSheet}
        />
      )}
      {sheet === 'use' && (
        <AmountSheet
          id="use"
          title={copy.useSheet.title}
          intro={
            <>
              <p>{copy.useSheet.intro}</p>
              <p>{fillTemplate(copy.useSheet.available, { amount: formatCents(status.balanceCents) })}</p>
            </>
          }
          label={copy.useSheet.amountLabel}
          value={amountText}
          onChange={changeAmount}
          confirmLabel={fillTemplate(copy.useSheet.confirm, { amount: formatCents(amountCents ?? 0) })}
          cancelLabel={copy.useSheet.cancel}
          disabled={amountCents === null}
          error={sheetError ?? entry.problem}
          onConfirm={() => void takeFromFund()}
          onCancel={closeSheet}
        />
      )}
    </div>
  );
}
