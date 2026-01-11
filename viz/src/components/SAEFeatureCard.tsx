import { useContext } from "react";
import { Card, CardContent, CardTitle, CardHeader, CardDescription } from "@/components/ui/card";
import { SAEContext } from "../SAEContext";
import FullSeqsViewer from "./FullSeqsViewer";
import { ProteinActivationsData } from "@/utils";
import { Link } from "react-router-dom";
import Markdown from "@/components/Markdown";

export default function SAEFeatureCard({
  dim,
  proteinActivationsData,
  highlightStart,
  highlightEnd,
  seqContext,
}: {
  dim: number;
  proteinActivationsData: ProteinActivationsData;
  highlightStart?: number;
  highlightEnd?: number;
  seqContext?: { pdb?: string; seq?: string };
}) {
  const { SAEConfig } = useContext(SAEContext);

  const desc = SAEConfig.curated?.find((f) => f.dim === dim)?.desc;

  const searchParams = new URLSearchParams();
  if (seqContext?.pdb) {
    searchParams.set("pdb", seqContext.pdb);
  } else if (seqContext?.seq) {
    searchParams.set("seq", seqContext.seq);
  }
  const search = searchParams.toString();

  return (
    <Link to={`${dim}${search ? `?${search}` : ""}`} className="block">
      <Card key={dim} className="cursor-pointer">
        <CardHeader>
          <CardTitle className="text-left">Feature {dim}</CardTitle>
          {desc && (
            <CardDescription>
              <Markdown>{desc}</Markdown>
            </CardDescription>
          )}
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
