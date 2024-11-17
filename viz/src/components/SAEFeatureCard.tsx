import { useContext } from "react";
import { Card, CardContent, CardTitle, CardHeader, CardDescription } from "@/components/ui/card";
import { SAEContext } from "../SAEContext";
import FullSeqsViewer from "./FullSeqsViewer";
import { ProteinSequence } from "@/utils";

export default function SAEFeatureCard({
  dim,
  sequence,
  sae_acts,
}: {
  dim: number;
  sequence: ProteinSequence;
  sae_acts: Array<number>;
  pdbId?: string;
}) {
  const { SAEConfig, setSelectedFeature } = useContext(SAEContext);
  const desc = SAEConfig.curated?.find((f) => f.dim === dim)?.desc;

  return (
    <Card
      key={dim}
      className="cursor-pointer"
      onClick={() => {
        setSelectedFeature(dim);
      }}
    >
      <CardHeader>
        <CardTitle className="text-left">Feature {dim}</CardTitle>
        {desc && <CardDescription>{desc}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <FullSeqsViewer sequence={sequence} activations={sae_acts} showCopy={false} />
        </div>
      </CardContent>
    </Card>
  );
}
