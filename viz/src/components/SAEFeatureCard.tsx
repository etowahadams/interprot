import { useContext } from "react";
import { Card, CardContent, CardTitle, CardHeader, CardDescription } from "@/components/ui/card";
import { SAEContext } from "../SAEContext";
import FullSeqsViewer from "./FullSeqsViewer";
import { ProteinActivationsData } from "@/utils";
import { Link, useLocation } from "react-router-dom";

export default function SAEFeatureCard({
  dim,
  proteinActivationsData,
  highlightStart,
  highlightEnd,
}: {
  dim: number;
  proteinActivationsData: ProteinActivationsData;
  highlightStart?: number;
  highlightEnd?: number;
}) {
  const { SAEConfig } = useContext(SAEContext);
  const location = useLocation();
  const desc = SAEConfig.curated?.find((f) => f.dim === dim)?.desc;

  return (
    <Link to={`${dim}${location.search}`} className="block">
      <Card key={dim} className="cursor-pointer">
        <CardHeader>
          <CardTitle className="text-left">Feature {dim}</CardTitle>
          {desc && <CardDescription>{desc}</CardDescription>}
        </CardHeader>
        <CardContent>
          <FullSeqsViewer
            proteinActivationsData={proteinActivationsData}
            highlightStart={highlightStart}
            highlightEnd={highlightEnd}
          />
        </CardContent>
      </Card>
    </Link>
  );
}
