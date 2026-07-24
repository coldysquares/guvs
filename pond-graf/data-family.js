const demoBoundary = {
  id: "demo-boundary",
  label: "Curated Skywalker fixture",
  kind: "local demonstration",
  status: "scope",
  note:
    "A deliberately simplified fictional family used to demonstrate membranes, provenance states, conflicts, and progressive discovery. It is not a canon audit."
};

function record(id, label, note, status = "supported") {
  return {
    id,
    label,
    kind: "demo record",
    status,
    note
  };
}

export const familyDataset = {
  id: "pond-family-v3",
  title: "Skywalker family pond",
  kicker: "POND lens / people + provenance",
  description:
    "Enter one person, inspect what qualifies the claim, then follow a supported family path.",
  sourceLabel: "Curated fictional demonstration",
  layout: "lineage",
  rootId: "shmi",
  initiallyVisible: ["shmi"],
  nodes: [
    {
      id: "shmi",
      title: "Shmi Skywalker",
      subtitle: "Generation 1 · lineage anchor",
      summary:
        "The family begins with a person, not a complete chart. Enter Shmi’s membrane to see what is known, what remains unresolved, and which bond can be followed next.",
      tone: "teal",
      confidence: "curated demo",
      tags: ["lineage anchor", "progressive discovery", "fictional fixture"],
      facts: [
        { label: "Recorded child", value: "Anakin Skywalker", status: "supported" },
        { label: "Recorded partner", value: "Cliegg Lars", status: "supported" },
        { label: "Paternal claim", value: "Unresolved in this fixture", status: "conflict" }
      ],
      sources: [
        demoBoundary,
        record(
          "shmi-lineage",
          "Lineage card S-01",
          "Supports the Shmi → Anakin parent bond inside this local demonstration."
        ),
        record(
          "shmi-unknown",
          "Open paternal field",
          "The prototype preserves an unknown field instead of manufacturing a second parent.",
          "conflict"
        )
      ]
    },
    {
      id: "cliegg",
      title: "Cliegg Lars",
      subtitle: "Generation 1 · partner branch",
      summary:
        "Cliegg opens the Lars branch. The same membrane can hold a partnership claim, a parent claim, and the source note that qualifies each one.",
      tone: "teal",
      confidence: "supported fixture",
      tags: ["partner branch", "Lars line"],
      facts: [
        { label: "Recorded partner", value: "Shmi Skywalker" },
        { label: "Recorded child", value: "Owen Lars" },
        { label: "Branch role", value: "Connects Skywalker and Lars lines" }
      ],
      sources: [
        demoBoundary,
        record(
          "cliegg-household",
          "Household card L-01",
          "Supports the simplified Cliegg–Shmi partnership and Cliegg–Owen parent records."
        )
      ]
    },
    {
      id: "owen",
      title: "Owen Lars",
      subtitle: "Generation 2 · Lars branch",
      summary:
        "Owen demonstrates a contextual family path: a real relationship can matter to exploration without being reduced to a single parent/partner label.",
      tone: "blue",
      confidence: "contextual fixture",
      tags: ["Lars branch", "context bond"],
      facts: [
        { label: "Recorded parent", value: "Cliegg Lars" },
        { label: "Context tie", value: "Step-family connection to Anakin" },
        { label: "Display state", value: "Surfaced through exploration" }
      ],
      sources: [
        demoBoundary,
        record(
          "owen-context",
          "Relationship note L-02",
          "Demonstrates a contextual tie that should not be mislabeled as a direct parent or sibling bond.",
          "context"
        )
      ]
    },
    {
      id: "anakin",
      title: "Anakin Skywalker",
      subtitle: "Generation 2 · descendant node",
      summary:
        "Anakin is a dense membrane: child, partner, parent, and step-family context coexist without forcing the user into a detached detail panel.",
      tone: "blue",
      confidence: "supported fixture",
      tags: ["descendant", "branch point", "multiple bond types"],
      facts: [
        { label: "Recorded parent", value: "Shmi Skywalker" },
        { label: "Recorded partner", value: "Padmé Amidala" },
        { label: "Recorded children", value: "Luke and Leia" }
      ],
      sources: [
        demoBoundary,
        record(
          "anakin-family",
          "Family card A-01",
          "Supports the parent, partner, and descendant paths used by this demonstration."
        ),
        record(
          "anakin-name-state",
          "Identity-state note A-02",
          "Shows how a future implementation could hold name or identity changes without silently collapsing them.",
          "lead"
        )
      ]
    },
    {
      id: "padme",
      title: "Padmé Amidala",
      subtitle: "Generation 2 · partner node",
      summary:
        "Padmé’s membrane keeps her own facts and evidence visible while also exposing the bonds that connect her to Anakin, Luke, and Leia.",
      tone: "blue",
      confidence: "supported fixture",
      tags: ["partner", "parent", "Naboo branch"],
      facts: [
        { label: "Recorded partner", value: "Anakin Skywalker" },
        { label: "Recorded children", value: "Luke and Leia" },
        { label: "Branch context", value: "Naboo / Amidala line" }
      ],
      sources: [
        demoBoundary,
        record(
          "padme-family",
          "Family card P-01",
          "Supports the simplified partner and parent claims in the fixture."
        )
      ]
    },
    {
      id: "luke",
      title: "Luke Skywalker",
      subtitle: "Generation 3 · descendant node",
      summary:
        "Luke is a familiar proof of the interaction: enter a person, understand the immediate claim, then move sideways to a sibling or backward to a parent.",
      tone: "gold",
      confidence: "supported fixture",
      tags: ["descendant", "twin", "familiar demo"],
      facts: [
        { label: "Recorded parents", value: "Anakin and Padmé" },
        { label: "Recorded sibling", value: "Leia Organa" },
        { label: "Generation", value: "3" }
      ],
      sources: [
        demoBoundary,
        record(
          "luke-family",
          "Descendant card T-01",
          "Supports Luke’s parent and twin-sibling paths in the fixture."
        )
      ]
    },
    {
      id: "leia",
      title: "Leia Organa",
      subtitle: "Generation 3 · descendant + adoption node",
      summary:
        "Leia demonstrates why provenance belongs inside the person’s membrane: biological parent, sibling, adoptive parent, partner, and child claims can remain distinct.",
      tone: "gold",
      confidence: "multi-source fixture",
      tags: ["descendant", "adoption", "branch point"],
      facts: [
        { label: "Biological parents", value: "Anakin and Padmé" },
        { label: "Adoptive parents", value: "Bail and Breha Organa" },
        { label: "Recorded sibling", value: "Luke Skywalker" }
      ],
      sources: [
        demoBoundary,
        record(
          "leia-lineage",
          "Lineage card T-02",
          "Supports Leia’s biological parent and sibling claims."
        ),
        record(
          "leia-adoption",
          "Adoption card O-01",
          "Keeps adoptive parentage explicit instead of flattening every parent bond into one type."
        )
      ]
    },
    {
      id: "bail",
      title: "Bail Organa",
      subtitle: "Generation 2 · adoptive parent",
      summary:
        "Bail’s membrane demonstrates a typed adoption bond. The relationship is visible and traversable without erasing how it differs from biological lineage.",
      tone: "rose",
      confidence: "supported fixture",
      tags: ["Organa branch", "adoptive parent"],
      facts: [
        { label: "Recorded partner", value: "Breha Organa" },
        { label: "Adopted child", value: "Leia Organa" },
        { label: "Bond type", value: "Adoption" }
      ],
      sources: [
        demoBoundary,
        record(
          "bail-household",
          "Organa household card O-02",
          "Supports the fixture’s adoptive-parent and partner paths."
        )
      ]
    },
    {
      id: "breha",
      title: "Breha Organa",
      subtitle: "Generation 2 · adoptive parent",
      summary:
        "Breha keeps the Organa household visible as its own membrane rather than appearing only as a label buried beneath Leia’s record.",
      tone: "rose",
      confidence: "supported fixture",
      tags: ["Organa branch", "adoptive parent"],
      facts: [
        { label: "Recorded partner", value: "Bail Organa" },
        { label: "Adopted child", value: "Leia Organa" },
        { label: "Branch role", value: "Organa household" }
      ],
      sources: [
        demoBoundary,
        record(
          "breha-household",
          "Organa household card O-03",
          "Supports the fixture’s adoptive-parent and partner paths."
        )
      ]
    },
    {
      id: "han",
      title: "Han Solo",
      subtitle: "Generation 3 · partner node",
      summary:
        "Han opens the next branch through a partner bond. The map grows because the user follows evidence-bearing relationships, not because the whole chart is dumped at once.",
      tone: "gold",
      confidence: "supported fixture",
      tags: ["partner", "Solo branch"],
      facts: [
        { label: "Recorded partner", value: "Leia Organa" },
        { label: "Recorded child", value: "Ben Solo" },
        { label: "Generation", value: "3" }
      ],
      sources: [
        demoBoundary,
        record(
          "han-household",
          "Solo household card H-01",
          "Supports the simplified partner and parent paths in this fixture."
        )
      ]
    },
    {
      id: "ben",
      title: "Ben Solo",
      subtitle: "Generation 4 · descendant node",
      summary:
        "Ben is the current edge of this curated pond. A real private dataset could continue expanding without changing the interaction model.",
      tone: "orange",
      confidence: "supported fixture",
      tags: ["descendant", "current frontier"],
      facts: [
        { label: "Recorded parents", value: "Leia Organa and Han Solo" },
        { label: "Generation", value: "4" },
        { label: "Frontier", value: "No further fixture path" }
      ],
      sources: [
        demoBoundary,
        record(
          "ben-lineage",
          "Descendant card B-01",
          "Supports the final parent path in this deliberately narrow demonstration."
        )
      ]
    }
  ],
  bonds: [
    {
      from: "shmi",
      to: "anakin",
      label: "parent",
      type: "parent",
      evidence: "Lineage card S-01 records Anakin as Shmi’s child.",
      sourceIds: ["shmi-lineage"]
    },
    {
      from: "shmi",
      to: "cliegg",
      label: "partner",
      type: "partner",
      evidence: "Household card L-01 records the partnership in this fixture."
    },
    {
      from: "cliegg",
      to: "owen",
      label: "parent",
      type: "parent",
      evidence: "Household card L-01 records Owen on the Lars branch."
    },
    {
      from: "anakin",
      to: "owen",
      label: "step-family context",
      type: "context",
      evidence: "Relationship note L-02 preserves this as context, not a direct sibling claim."
    },
    {
      from: "anakin",
      to: "padme",
      label: "partner",
      type: "partner",
      evidence: "Family cards A-01 and P-01 support this demonstration bond."
    },
    {
      from: "anakin",
      to: "luke",
      label: "parent",
      type: "parent",
      evidence: "Descendant card T-01 records Luke on this branch."
    },
    {
      from: "padme",
      to: "luke",
      label: "parent",
      type: "parent",
      evidence: "Descendant card T-01 records Luke on this branch."
    },
    {
      from: "anakin",
      to: "leia",
      label: "parent",
      type: "parent",
      evidence: "Lineage card T-02 records Leia on this branch."
    },
    {
      from: "padme",
      to: "leia",
      label: "parent",
      type: "parent",
      evidence: "Lineage card T-02 records Leia on this branch."
    },
    {
      from: "luke",
      to: "leia",
      label: "sibling",
      type: "sibling",
      evidence: "Descendant cards T-01 and T-02 record the twin-sibling path."
    },
    {
      from: "bail",
      to: "breha",
      label: "partner",
      type: "partner",
      evidence: "Organa household cards O-02 and O-03 support the fixture bond."
    },
    {
      from: "bail",
      to: "leia",
      label: "adoptive parent",
      type: "adoption",
      evidence: "Adoption card O-01 marks this path as adoptive parentage."
    },
    {
      from: "breha",
      to: "leia",
      label: "adoptive parent",
      type: "adoption",
      evidence: "Adoption card O-01 marks this path as adoptive parentage."
    },
    {
      from: "leia",
      to: "han",
      label: "partner",
      type: "partner",
      evidence: "Solo household card H-01 supports the fixture bond."
    },
    {
      from: "leia",
      to: "ben",
      label: "parent",
      type: "parent",
      evidence: "Descendant card B-01 records Ben on the Solo branch."
    },
    {
      from: "han",
      to: "ben",
      label: "parent",
      type: "parent",
      evidence: "Descendant card B-01 records Ben on the Solo branch."
    }
  ]
};
