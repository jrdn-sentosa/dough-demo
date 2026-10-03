import { LoafButton } from '../../components/LoafButton';
import { SliceButton } from '../../components/SliceButton';

// Placeholder until the Home screen is built (milestone 7).
export function Home() {
  return (
    <>
      <h1 className="wordmark">Dough!</h1>
      <p>Scaffold is running.</p>
      <div className="stack">
        <LoafButton>Start baking</LoafButton>
        <SliceButton>Maybe later</SliceButton>
      </div>
    </>
  );
}
