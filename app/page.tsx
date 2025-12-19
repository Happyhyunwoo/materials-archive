export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <header className="border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="text-3xl font-semibold tracking-tight text-gray-900">Yonsei HW Lab</div>
          <div className="mt-3 max-w-3xl text-sm leading-6 text-gray-700">
            We investigate second language acquisition and language processing using corpus methods, experimental
            paradigms, and computational modeling. Our work connects usage-based theory with quantitative evidence
            from learner corpora and behavioral experiments.
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <a href="/people" className="rounded-2xl border bg-white p-5 shadow-sm hover:bg-gray-50">
              <div className="text-sm font-semibold text-gray-900">People</div>
              <div className="mt-1 text-sm text-gray-600">Lab members and collaborators.</div>
            </a>
            <a href="/projects" className="rounded-2xl border bg-white p-5 shadow-sm hover:bg-gray-50">
              <div className="text-sm font-semibold text-gray-900">Projects</div>
              <div className="mt-1 text-sm text-gray-600">Ongoing and completed research.</div>
            </a>
            <a href="/publications" className="rounded-2xl border bg-white p-5 shadow-sm hover:bg-gray-50">
              <div className="text-sm font-semibold text-gray-900">Publications</div>
              <div className="mt-1 text-sm text-gray-600">Articles, proceedings, and preprints.</div>
            </a>
            <a href="/resources" className="rounded-2xl border bg-white p-5 shadow-sm hover:bg-gray-50">
              <div className="text-sm font-semibold text-gray-900">Resources</div>
              <div className="mt-1 text-sm text-gray-600">Teaching materials and code archive.</div>
            </a>
            <a href="/news" className="rounded-2xl border bg-white p-5 shadow-sm hover:bg-gray-50">
              <div className="text-sm font-semibold text-gray-900">News</div>
              <div className="mt-1 text-sm text-gray-600">Updates, talks, awards, announcements.</div>
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 space-y-10">
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="text-sm font-semibold text-gray-900">Research themes</div>
          <div className="mt-2 text-sm text-gray-700 leading-6">
            Our research focuses on morphosyntax and sentence processing in L2, genre-sensitive development in L2
            writing, and computational approaches to learner language. We combine usage-based accounts (construction
            learning, entrenchment, cue competition) with corpus-derived metrics and experimental evidence.
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="text-sm font-semibold text-gray-900">Methods</div>
          <div className="mt-2 text-sm text-gray-700 leading-6">
            We work with learner corpora (e.g., YELC, ICNALE) and implement reproducible pipelines in Python/R.
            Experimental work includes acceptability judgment tasks, self-paced reading, and eye-tracking, depending on
            the research question.
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="text-sm font-semibold text-gray-900">Contact</div>
          <div className="mt-2 text-sm text-gray-700 leading-6">
            Department of English Language and Literature, Yonsei University. For collaboration and student inquiries,
            please contact the lab via email.
          </div>
        </section>
      </main>

      <footer className="border-t bg-white/60">
        <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-gray-500">
          Yonsei HW Lab
        </div>
      </footer>
    </div>
  );
}
