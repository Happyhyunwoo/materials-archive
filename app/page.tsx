export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      {/* Title */}
      <h1 className="text-4xl font-semibold tracking-tight text-gray-900">
        Yonsei HW Lab
      </h1>

      {/* Description */}
      <p className="mt-6 max-w-3xl text-lg leading-8 text-gray-700">
        The Yonsei HW Lab investigates second language acquisition and sentence
        processing through corpus-based analysis, experimental paradigms, and
        computational modeling. Our research focuses on usage-based approaches
        to grammar, lexical-semantic development, and cross-linguistic variation.
      </p>

      {/* Section cards */}
      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <a
          href="/people"
          className="rounded-2xl border bg-white p-6 shadow-sm transition hover:bg-gray-50"
        >
          <h2 className="text-lg font-semibold text-gray-900">People</h2>
          <p className="mt-2 text-base text-gray-600">
            Lab members, students, and collaborators.
          </p>
        </a>

        <a
          href="/projects"
          className="rounded-2xl border bg-white p-6 shadow-sm transition hover:bg-gray-50"
        >
          <h2 className="text-lg font-semibold text-gray-900">Projects</h2>
          <p className="mt-2 text-base text-gray-600">
            Ongoing and completed research projects.
          </p>
        </a>

        <a
          href="/publications"
          className="rounded-2xl border bg-white p-6 shadow-sm transition hover:bg-gray-50"
        >
          <h2 className="text-lg font-semibold text-gray-900">Publications</h2>
          <p className="mt-2 text-base text-gray-600">
            Journal articles, preprints, and conference papers.
          </p>
        </a>

        <a
          href="/resources"
          className="rounded-2xl border bg-white p-6 shadow-sm transition hover:bg-gray-50"
        >
          <h2 className="text-lg font-semibold text-gray-900">Resources</h2>
          <p className="mt-2 text-base text-gray-600">
            Teaching materials, datasets, and code repositories.
          </p>
        </a>

        <a
          href="/news"
          className="rounded-2xl border bg-white p-6 shadow-sm transition hover:bg-gray-50"
        >
          <h2 className="text-lg font-semibold text-gray-900">News</h2>
          <p className="mt-2 text-base text-gray-600">
            Talks, awards, announcements, and lab updates.
          </p>
        </a>
      </div>
    </div>
  );
}

