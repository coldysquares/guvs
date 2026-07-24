const localPitchSource = {
  id: "pitch-html",
  label: "pitch_constellation.html",
  kind: "local design artifact",
  status: "source",
  note:
    "The directly inspected local pitch artifact defines STaeT as an explorable argument rather than a deck or scrolling one-pager."
};

const localPitchTwin = {
  id: "pitch-txt",
  label: "pitch_constellation.txt",
  kind: "local text twin",
  status: "corroborates",
  note:
    "A byte-matched local text copy of the same single-file HTML artifact. It is evidence for this fixture, not a current product manifest."
};

function pitchNode({
  id,
  title,
  subtitle,
  summary,
  tone = "violet",
  confidence = "source-backed fixture",
  tags = [],
  facts = [],
  sources = []
}) {
  return {
    id,
    title,
    subtitle,
    summary,
    tone,
    confidence,
    tags,
    facts,
    sources: [localPitchSource, ...sources]
  };
}

export const pitchDataset = {
  id: "aster-pitch-v3",
  title: "STaeT pitch pond",
  kicker: "Aster lens / argument + provenance",
  description:
    "The same membrane engine renders an explorable pitch: thesis, problem, experience, proof, guardrails, and ask.",
  sourceLabel: "Local pitch artifact",
  layout: "radial",
  rootId: "staet",
  initiallyVisible: ["staet"],
  nodes: [
    pitchNode({
      id: "staet",
      title: "STaeT",
      subtitle: "The thesis · center membrane",
      summary:
        "A calm place that holds your real, current state so you do not rebuild it from scratch—and helps you act when you are stuck.",
      tone: "gold",
      tags: ["thesis", "calm state", "explorable pitch"],
      facts: [
        { label: "Not", value: "A to-do app" },
        { label: "Core verbs", value: "Holds · shows · helps" },
        { label: "Pitch form", value: "Explore, do not scroll" }
      ],
      sources: [localPitchTwin]
    }),
    pitchNode({
      id: "problem",
      title: "The Problem",
      subtitle: "Why it exists",
      summary:
        "Files, projects, and the thread of work scatter between days. The argument locates the failure in the container, not in the person using it.",
      tone: "rose",
      tags: ["container failure", "fragmentation"],
      facts: [
        { label: "Symptom", value: "The thread evaporates between days" },
        { label: "Pressure", value: "Opening missed work becomes a wall" },
        { label: "Thesis", value: "The container keeps failing" }
      ]
    }),
    pitchNode({
      id: "morning",
      title: "The Morning",
      subtitle: "The experience",
      summary:
        "A plain readout catches what changed, shows what is alive now, and avoids shame-based overdue language.",
      tone: "teal",
      tags: ["daily readout", "calm interface"],
      facts: [
        { label: "First signal", value: "Nothing slipped" },
        { label: "Tone", value: "No red · no overdue · no shame" },
        { label: "Question", value: "What is alive right now?" }
      ]
    }),
    pitchNode({
      id: "cell",
      title: "The Cell",
      subtitle: "The unit",
      summary:
        "A task, project, or idea opens as a cell holding its state, one next move, and the files or messages that belong to it.",
      tone: "violet",
      tags: ["unit", "context container", "protocell"],
      facts: [
        { label: "Holds", value: "State + next move + context" },
        { label: "Avoids", value: "Digging through folders" },
        { label: "Interaction", value: "Open the cell’s own world" }
      ]
    }),
    pitchNode({
      id: "activation",
      title: "Activation",
      subtitle: "The unlock",
      summary:
        "When the user is frozen, the system proposes the smallest possible first move so beginning stops feeling impossible.",
      tone: "lime",
      tags: ["smallest move", "start support"],
      facts: [
        { label: "Goal", value: "Cross the activation line" },
        { label: "Method", value: "Shrink the first move" },
        { label: "Boundary", value: "Help, do not nag" }
      ]
    }),
    pitchNode({
      id: "baseline",
      title: "Baseline Drift",
      subtitle: "The insight",
      summary:
        "A slipped baseline becomes a traceable cause, not a moral judgment: find what broke in the environment and surface the repair.",
      tone: "orange",
      tags: ["cause tracing", "no shame"],
      facts: [
        { label: "Rejects", value: "You are lazy" },
        { label: "Looks for", value: "The broken sprayer" },
        { label: "Output", value: "A repairable cause" }
      ]
    }),
    pitchNode({
      id: "cultivation",
      title: "Cultivation",
      subtitle: "How it is fed",
      summary:
        "The pitch imagines a quiet nightly pass that notices what changed across real tools and files, then places each artifact with the context it belongs to.",
      tone: "teal",
      tags: ["nightly intake", "low maintenance"],
      facts: [
        { label: "Cadence", value: "Nightly" },
        { label: "Input", value: "Files · meetings · messages" },
        { label: "Promise", value: "It comes to you" }
      ],
      sources: [
        {
          id: "cultivation-boundary",
          label: "Implementation boundary",
          kind: "fixture note",
          status: "unresolved",
          note:
            "This pitch claim is represented as product intent here. The V3 demo does not assert that every named connector is currently wired."
        }
      ]
    }),
    pitchNode({
      id: "stands",
      title: "Where It Stands",
      subtitle: "The proof beat",
      summary:
        "The source pitch claims substantial supporting machinery already exists and frames the remaining work as integration plus one new piece.",
      tone: "blue",
      confidence: "historical source claim",
      tags: ["proof beat", "source claim"],
      facts: [
        { label: "Claim", value: "Much of the engine already exists" },
        { label: "Remaining", value: "Wire the nightly routine" },
        { label: "Claim class", value: "Historical pitch language" }
      ],
      sources: [
        {
          id: "proof-gate",
          label: "Claim gate",
          kind: "provenance note",
          status: "scope",
          note:
            "The pitch artifact is direct evidence that this claim was written. It is not, by itself, current runtime verification."
        }
      ]
    }),
    pitchNode({
      id: "rules",
      title: "The Rules",
      subtitle: "The guardrails",
      summary:
        "Calm by default: no streaks, shame, or silent destructive actions. Anything consequential waits for the user’s yes.",
      tone: "gold",
      tags: ["guardrails", "user control", "calm"],
      facts: [
        { label: "No", value: "Streaks · shame · punishment" },
        { label: "Control", value: "Consequential actions wait for yes" },
        { label: "Daily test", value: "If it feels like Slack, it failed" }
      ]
    }),
    pitchNode({
      id: "ask",
      title: "The First Move",
      subtitle: "The ask",
      summary:
        "Build the small, safe piece that notices what changed each night. Everything else in the pitch stacks on that bounded first move.",
      tone: "lime",
      tags: ["ask", "safe first move", "read-only"],
      facts: [
        { label: "Build", value: "Notice what changed nightly" },
        { label: "Safety", value: "Read-only · deletes nothing" },
        { label: "Reason", value: "Everything else stacks on it" }
      ]
    })
  ],
  bonds: [
    {
      from: "staet",
      to: "problem",
      label: "answers",
      type: "tension",
      evidence: "The source pitch positions the thesis as a response to container failure."
    },
    {
      from: "staet",
      to: "morning",
      label: "becomes",
      type: "supports",
      evidence: "The morning readout is the first concrete experience of the thesis."
    },
    {
      from: "staet",
      to: "cell",
      label: "is composed of",
      type: "supports",
      evidence: "The cell is named as the unit holding state, next move, and context."
    },
    {
      from: "staet",
      to: "rules",
      label: "is bounded by",
      type: "supports",
      evidence: "The source gives calm and user control as non-negotiable guardrails."
    },
    {
      from: "problem",
      to: "morning",
      label: "is relieved by",
      type: "supports",
      evidence: "The readout answers the fear that work slipped between days."
    },
    {
      from: "morning",
      to: "cultivation",
      label: "depends on",
      type: "supports",
      evidence: "A morning readout needs a prior pass that notices what changed."
    },
    {
      from: "cell",
      to: "activation",
      label: "can trigger",
      type: "supports",
      evidence: "The active cell contains the next move used to cross the starting line."
    },
    {
      from: "cell",
      to: "baseline",
      label: "can reveal",
      type: "supports",
      evidence: "The cell’s context can expose the environmental cause of drift."
    },
    {
      from: "cultivation",
      to: "stands",
      label: "requires proof",
      type: "reference",
      evidence: "The pitch moves from desired nightly cultivation to its implementation-status claim."
    },
    {
      from: "cell",
      to: "stands",
      label: "is supported by",
      type: "reference",
      evidence: "The proof beat names existing metadata and file machinery as support for the cell."
    },
    {
      from: "stands",
      to: "ask",
      label: "narrows into",
      type: "supports",
      evidence: "The proof beat resolves into the bounded first implementation move."
    },
    {
      from: "staet",
      to: "ask",
      label: "starts with",
      type: "supports",
      evidence: "The source pitch connects the central thesis directly to the first move."
    }
  ]
};
