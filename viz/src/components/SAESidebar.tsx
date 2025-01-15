import { useContext } from "react";
import { CuratedFeature, SAE_CONFIGS } from "../SAEConfigs";
import { Link } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  useSidebar,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import HomeNavigator from "@/components/HomeNavigator";
import { Toggle } from "@/components/ui/toggle";
import { Dices, Search } from "lucide-react";
import { SAEContext } from "../SAEContext";
import Markdown from "@/components/Markdown";
import { useNavigateWithSeqContext } from "@/hooks/useNagivateWithQueryParams";

export default function SAESidebar() {
  const { setOpenMobile } = useSidebar();
  const navigate = useNavigateWithSeqContext();
  const { model, feature, SAEConfig } = useContext(SAEContext);

  const handleFeatureChange = (feature: number) => {
    navigate(`/sae-viz/${model}/${feature}`);
    setOpenMobile(false);
  };

  const groupedFeatures = SAEConfig.curated?.reduce((acc, feature) => {
    const group = feature.group || "not classified";
    if (!acc[group]) acc[group] = [];
    acc[group].push(feature);
    return acc;
  }, {} as Record<string, CuratedFeature[]>);

  return (
    <>
      <div className="fixed flex items-center justify-between top-0 w-full bg-background border-b border-border z-50 py-4 px-6 md:hidden left-0 right-0">
        <SidebarTrigger />
        <Search onClick={() => navigate(`/sae-viz/${model}`)} />
      </div>
      <Sidebar>
        <SidebarHeader>
          <div className="m-3">
            <HomeNavigator />
          </div>
          <Select
            value={model}
            onValueChange={(value) =>
              navigate(
                `/sae-viz/${value}${
                  SAE_CONFIGS[value].defaultDim !== undefined
                    ? `/${SAE_CONFIGS[value].defaultDim}`
                    : ""
                }`
              )
            }
          >
            <SelectTrigger className="mb-3">
              <SelectValue placeholder="Select SAE Model" />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(SAE_CONFIGS).map((model) => (
                <SelectItem key={model} value={model}>
                  {model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-sm text-left px-3 mb-2">
            <Markdown>{SAEConfig.description}</Markdown>
          </div>
          <Link
            to={`/sae-viz/${model}/${Math.floor(Math.random() * SAEConfig.numHiddenDims)}`}
            className="mb-3 mx-3 py-2 flex items-center justify-center text-sm border rounded-md hover:bg-accent hover:text-accent-foreground bg-background shadow-sm transition-colors"
            onClick={() => setOpenMobile(false)}
          >
            <Dices className="w-4 h-4 mr-2" /> Random Feature
          </Link>
          <Link
            to={`/sae-viz/${model}`}
            className="mb-3 mx-3 py-2 flex items-center justify-center text-sm border rounded-md hover:bg-accent hover:text-accent-foreground bg-background shadow-sm transition-colors"
            onClick={() => setOpenMobile(false)}
          >
            <Search className="w-4 h-4 mr-2 shrink-0" />
            <span>Search SAE features</span>
          </Link>
          <Separator />
        </SidebarHeader>
        <SidebarContent>
          <ul className="space-y-2 font-medium">
            {groupedFeatures &&
              (Object.entries(groupedFeatures) as [string, CuratedFeature[]][]).map(
                ([group, features]) => (
                  <SidebarGroup key={group}>
                    <SidebarGroupLabel>{group}</SidebarGroupLabel>
                    {features.map((c) => (
                      <Toggle
                        key={`feature-${c.dim}`}
                        style={{ width: "100%", paddingLeft: 20, textAlign: "left" }}
                        className="justify-start"
                        pressed={feature === c.dim}
                        onPressedChange={() => handleFeatureChange(c.dim)}
                      >
                        {c.name}
                      </Toggle>
                    ))}
                  </SidebarGroup>
                )
              )}
            <SidebarGroup>
              <SidebarGroupLabel>all features</SidebarGroupLabel>
              {Array.from({ length: SAEConfig.numHiddenDims }, (_, i) => i).map((i) => (
                <Toggle
                  key={`feature-${i}`}
                  style={{ width: "100%", paddingLeft: 20 }}
                  className="justify-start"
                  pressed={feature === i}
                  onPressedChange={() => handleFeatureChange(i)}
                >
                  {i}
                </Toggle>
              ))}
            </SidebarGroup>
          </ul>
        </SidebarContent>
      </Sidebar>
    </>
  );
}
