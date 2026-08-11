# Houdini/TOP-Style DAG Rules

Use this when the user wants a detailed one-way acyclic dataflow, workflow network, methodology graph, or "like Houdini" diagram.

## Main Structure

Use a compact central spine:

```text
Source/Contract
  -> Raw artifact[]
  -> QualityGate
  -> Evidence/Event rows
  -> Coding/Mapping
  -> Reducer
  -> Matrix/View
  -> Estimator
  -> AuditEnvelope
  -> Claim/Output
```

The central spine should contain only the data transformation. Put supporting material on side rails.

## Node Anatomy

Each main node should have:

- stage label, for example `L4`
- short title, for example `TopicCoder`
- type chip, for example `measurement`
- output chip, for example `EventTopicLink[]`
- one short summary line
- optional badge: `LOCK`, `WARN`, `AUDIT`, `SAFE`, `NO LEAK`
- optional work-item dots showing cardinality/status

Do not put full schemas or paragraphs inside main nodes.

## Side Artifacts

Use side artifacts for:

- raw input examples
- evidence tables
- fixed codebooks or taxonomies
- assumption/config stacks
- status semantics tables
- formulas
- leakage ledgers and guardrails
- audit/reproducibility metadata
- output schemas

Connect artifacts through dashed side rails and pinned dots.

## Edge Grammar

- Main data wire: thick, dark, solid, usually vertical.
- Evidence/config/formula wire: thin, dashed, muted.
- Audit/guardrail wire: thin, dashed, amber/red only where risk is real.
- Labels belong on output stubs or small chips, not floating in the middle of a long edge.
- Use orthogonal routing where possible: stub -> bus rail -> target.

## Scientific/Research Diagrams

Researchers need provenance:

- input version/hash
- transform/process
- output artifact
- assumptions/thresholds
- confidence or uncertainty diagnostics
- audit/reproducibility metadata
- failure modes and limitations

Do not collapse "unknown" into "absent". Keep evaluability separate from presence when drawing statistical workflows.

## Multi-View Layout

For very detailed diagrams, include separate visual rooms:

- overview ribbon or summary frame
- full network frame
- per-item/per-topic lineage frame
- audit/reproducibility frame

Avoid one giant dense wall of text.
