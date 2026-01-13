import { redColorMapHex } from "@/utils";

interface SequenceActivationViewerProps {
  sequence: string;
  activations: number[];
  maxActivation: number;
  activeResidueIndex: number | null;
  hoverIndex: number | null;
  onHoverIndexChange: (index: number | null) => void;
  structurePositions?: Set<number>;
}

const SequenceActivationViewer = ({
  sequence,
  activations,
  maxActivation,
  activeResidueIndex,
  hoverIndex,
  onHoverIndexChange,
  structurePositions,
}: SequenceActivationViewerProps) => {
  return (
    <div className="rounded-lg border bg-white p-3">
      {/* Fixed info bar - updates on hover */}
      <div className="text-xs text-gray-600 mb-2 h-5 flex items-center gap-3 border-b pb-2">
        {hoverIndex !== null ? (
          <>
            <span>
              <span className="text-gray-400">Position:</span>{" "}
              <span className="font-medium text-gray-900">{hoverIndex + 1}</span>
            </span>
            <span>
              <span className="text-gray-400">Residue:</span>{" "}
              <span className="font-medium text-gray-900">{sequence[hoverIndex]}</span>
            </span>
            <span>
              <span className="text-gray-400">SAE Activation:</span>{" "}
              <span className="font-medium text-gray-900">
                {(activations[hoverIndex] ?? 0).toFixed(2)}
              </span>
            </span>
            {structurePositions && !structurePositions.has(hoverIndex) && (
              <span className="text-gray-400 italic">(Not in structure)</span>
            )}
          </>
        ) : (
          <span className="text-gray-400 italic">Hover over a residue to see details</span>
        )}
      </div>

      {/* Sequence display */}
      <div className="overflow-x-auto" onMouseLeave={() => onHoverIndexChange(null)}>
        <div
          className="flex flex-wrap gap-0.5 p-0.5"
          style={{ fontFamily: "monospace", fontSize: "12px" }}
        >
          {sequence.split("").map((char, index) => {
            const activation = activations[index] ?? 0;
            const isActive = activeResidueIndex === index;
            const isInStructure = structurePositions ? structurePositions.has(index) : true;
            const color =
              maxActivation > 0 ? redColorMapHex(activation, maxActivation) : "transparent";

            return (
              <span
                key={index}
                onMouseEnter={() => onHoverIndexChange(index)}
                style={{
                  backgroundColor: color,
                  display: "inline-flex",
                  width: "12px",
                  height: "16px",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: isInStructure ? "pointer" : "default",
                  boxShadow: isActive && isInStructure ? "0 0 0 2px #2563eb" : "none",
                  borderRadius: "2px",
                  opacity: isInStructure ? 1 : 0.6,
                }}
              >
                {char}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SequenceActivationViewer;
