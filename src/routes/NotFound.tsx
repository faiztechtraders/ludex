import { ButtonLink } from '@/components/ui/Button.tsx';

export default function NotFound() {
  return (
    <div className="panel mx-auto max-w-lg p-12 text-center">
      <p className="brand-gradient-text font-display text-6xl font-bold">404</p>
      <h1 className="mt-3 font-display text-2xl font-bold text-text">Nothing here</h1>
      <p className="mt-3 text-sm text-text-secondary">
        That route does not exist in Ludex. It happens.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <ButtonLink to="/">Go home</ButtonLink>
        <ButtonLink to="/spin" variant="secondary">
          Just pick me a game
        </ButtonLink>
      </div>
    </div>
  );
}
