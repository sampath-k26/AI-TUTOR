import { describe, expect, it } from "vitest";
import { computeConceptCooccurrence } from "../../src/modules/materials/conceptMap";

describe("computeConceptCooccurrence", () => {
  it("returns every concept as a node, even one with no edges", () => {
    const graph = computeConceptCooccurrence(
      [
        { id: "a", name: "Mitochondria" },
        { id: "b", name: "Cell Membrane" },
      ],
      ["This chunk only mentions Mitochondria on its own."],
    );

    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(0);
  });

  it("creates an edge for two concepts that co-occur in the same chunk", () => {
    const graph = computeConceptCooccurrence(
      [
        { id: "a", name: "Mitochondria" },
        { id: "b", name: "Cell Membrane" },
      ],
      ["The Mitochondria is separate from the Cell Membrane in a eukaryotic cell."],
    );

    expect(graph.edges).toEqual([{ source: "a", target: "b", weight: 1 }]);
  });

  it("weights an edge higher for concepts that co-occur across more chunks", () => {
    const graph = computeConceptCooccurrence(
      [
        { id: "a", name: "Mitochondria" },
        { id: "b", name: "Cell Membrane" },
      ],
      [
        "Mitochondria and Cell Membrane both appear here.",
        "Again, Mitochondria sits near the Cell Membrane.",
        "Mitochondria alone this time.",
      ],
    );

    expect(graph.edges).toEqual([{ source: "a", target: "b", weight: 2 }]);
  });

  it("matches concept names case-insensitively", () => {
    const graph = computeConceptCooccurrence(
      [
        { id: "a", name: "DNA" },
        { id: "b", name: "RNA" },
      ],
      ["dna is transcribed into rna during this process."],
    );

    expect(graph.edges).toEqual([{ source: "a", target: "b", weight: 1 }]);
  });

  it("ignores concept names shorter than the minimum-length guard", () => {
    const graph = computeConceptCooccurrence(
      [
        { id: "a", name: "pH" },
        { id: "b", name: "Cell Membrane" },
      ],
      ["The pH level affects the Cell Membrane's permeability."],
    );

    expect(graph.edges).toHaveLength(0);
  });
});
