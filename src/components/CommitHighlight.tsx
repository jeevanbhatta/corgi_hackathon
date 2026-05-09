'use client';

type CommitHighlightProps = {
  active: boolean;
  children: React.ReactNode;
};

export default function CommitHighlight({ active, children }: CommitHighlightProps) {
  return (
    <div className="relative flex items-center justify-center">
      {active && (
        <>
          <span className="absolute size-8 rounded-full bg-cyan-300/20 blur-md" />
          <span className="absolute size-7 animate-ping rounded-full border border-cyan-300/70" />
        </>
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
