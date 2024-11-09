import { useContext } from "react";
import { Card, CardContent, CardTitle, CardHeader, CardDescription } from "@/components/ui/card";
import { SAEContext } from "../SAEContext";
import FullSeqViewer from "./FullSeqViewer";

export default function SAEFeatureCard({
  dim,
  sequence,
  sae_acts,
  pdbId,
}: {
  dim: number;
  sequence: string;
  sae_acts: Array<number>;
  pdbId?: string;
}) {
  const { selectedModel, SAEConfig } = useContext(SAEContext);
  const desc = SAEConfig.curated?.find((f) => f.dim === dim)?.desc;
  return (
    <Card
      key={dim}
      className="cursor-pointer"
      onClick={() => {
        window.open(`#/sae-viz/${selectedModel}/${dim}?seq=${pdbId || sequence}`);
      }}
    >
      <CardHeader>
        <CardTitle className="text-left">Feature {dim}</CardTitle>
        {desc && <CardDescription>{desc}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <FullSeqViewer sequence={sequence} activations={sae_acts} showCopy={false} />
        </div>
      </CardContent>
    </Card>
  );
}
