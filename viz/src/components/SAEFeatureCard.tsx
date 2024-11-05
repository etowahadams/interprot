import { useContext } from "react";
import { Card, CardContent, CardTitle, CardHeader, CardDescription } from "@/components/ui/card";
import { SAEContext } from "../SAEContext";
import SeqViewer from "./SeqViewer";
import { sequenceToTokens } from "../utils.ts";

export default function SAEFeatureCard({
  dim,
  sequence,
  sae_acts,
}: {
  dim: number;
  sequence: string;
  sae_acts: Array<number>;
}) {
  const { selectedModel, SAEConfig } = useContext(SAEContext);
  const desc = SAEConfig.curated?.find((f) => f.dim === dim)?.desc;
  return (
    <Card
      key={dim}
      className="cursor-pointer"
      onClick={() => {
        window.open(`#/sae-viz/${selectedModel}/${dim}?seq=${sequence}`, "_blank");
      }}
    >
      <CardHeader>
        <CardTitle className="text-left">Feature {dim}</CardTitle>
        {desc && <CardDescription>{desc}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <SeqViewer
            seq={{
              tokens_acts_list: sae_acts,
              tokens_list: sequenceToTokens(sequence),
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
