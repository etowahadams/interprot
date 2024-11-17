import { useContext } from "react";
import { Card, CardContent, CardTitle, CardHeader, CardDescription } from "@/components/ui/card";
import { SAEContext } from "../SAEContext";
import FullSeqsViewer from "./FullSeqsViewer";
import { ProteinActivationsData } from "@/utils";

export default function SAEFeatureCard({
  dim,
  proteinActivationsData,
}: {
  dim: number;
  proteinActivationsData: ProteinActivationsData;
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
        <FullSeqsViewer proteinActivationsData={proteinActivationsData} />
      </CardContent>
    </Card>
  );
}
