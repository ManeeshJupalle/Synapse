export default function Onboarding({ onDone }: { onDone: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="card max-w-lg w-full p-10 animate-slide-up">
        {/* Logo */}
        <div className="text-6xl mb-4 text-center">🧠</div>

        {/* Heading */}
        <h1 className="text-3xl font-bold text-center">Welcome to Synapse</h1>
        <p className="text-synapse-muted mt-2 mb-8 text-center">
          Your second brain — built automatically as you browse.
        </p>

        {/* Steps */}
        <div className="flex flex-col gap-3">
          {/* Step 1 */}
          <div className="border border-synapse-border rounded-xl p-4 flex items-start gap-3">
            <span className="w-7 h-7 rounded-full bg-synapse-accent text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
              1
            </span>
            <div>
              <p className="font-semibold text-synapse-text">Browse normally</p>
              <p className="text-sm text-synapse-muted mt-0.5">
                Visit articles, blog posts, docs — anything you'd normally read.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="border border-synapse-border rounded-xl p-4 flex items-start gap-3">
            <span className="w-7 h-7 rounded-full bg-synapse-accent2 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
              2
            </span>
            <div>
              <p className="font-semibold text-synapse-text">Stay for 15 seconds</p>
              <p className="text-sm text-synapse-muted mt-0.5">
                Synapse only captures pages you actually read — not things you click past.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="border border-synapse-border rounded-xl p-4 flex items-start gap-3">
            <span className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
              3
            </span>
            <div>
              <p className="font-semibold text-synapse-text">Come back here</p>
              <p className="text-sm text-synapse-muted mt-0.5">
                Your knowledge graph builds automatically. No tagging, no manual work.
              </p>
            </div>
          </div>
        </div>

        {/* Privacy chips */}
        <div className="flex justify-center gap-2 mt-6">
          <span className="chip">No API calls</span>
          <span className="chip">All on-device</span>
          <span className="chip">No telemetry</span>
        </div>

        {/* CTA */}
        <button
          onClick={onDone}
          className="btn-primary w-full mt-8 py-3 text-base justify-center"
        >
          Start browsing →
        </button>

        {/* Footer note */}
        <p className="text-xs text-synapse-muted text-center mt-3">
          You can change capture settings anytime in the Settings tab.
        </p>
      </div>
    </div>
  );
}
