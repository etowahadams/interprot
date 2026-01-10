import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExternalLink, Loader2 } from "lucide-react";

interface SuggestFeatureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureDim: number;
  modelName: string;
}

const GROUP_OPTIONS = [
  { value: "structural", label: "Structural" },
  { value: "amino acid identity", label: "Amino Acid Identity" },
  { value: "amino acid position", label: "Amino Acid Position" },
  { value: "other", label: "Other" },
];

const API_URL = import.meta.env.VITE_SUGGEST_FEATURE_API_URL;

export default function SuggestFeatureModal({
  open,
  onOpenChange,
  featureDim,
  modelName,
}: SuggestFeatureModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [group, setGroup] = useState("structural");
  const [customGroup, setCustomGroup] = useState("");
  const [contributorName, setContributorName] = useState("");
  const [contributorLink, setContributorLink] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    message: string;
    prUrl?: string;
  } | null>(null);

  const resetForm = () => {
    setName("");
    setDescription("");
    setGroup("");
    setCustomGroup("");
    setContributorName("");
    setContributorLink("");
    setSubmitResult(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !description || !group || !contributorName) {
      return;
    }

    const finalGroup = group === "other" ? customGroup : group;

    if (group === "other" && !customGroup) {
      return;
    }

    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelName,
          dim: featureDim,
          name,
          description,
          group: finalGroup,
          contributorName,
          contributorLink: contributorLink || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSubmitResult({
          success: true,
          message: "Pull request created successfully!",
          prUrl: data.prUrl,
        });
      } else {
        setSubmitResult({
          success: false,
          message: data.error || "Failed to create pull request. Please try again.",
        });
      }
    } catch {
      setSubmitResult({
        success: false,
        message: "Network error. Please check your connection and try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid =
    name && description && group && contributorName && (group !== "other" || customGroup);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Suggest as Curated Feature</DialogTitle>
          <DialogDescription>
            Suggest feature {featureDim} from {modelName} to be added to the curated list. This will
            create a pull request for review.
          </DialogDescription>
        </DialogHeader>

        {submitResult?.success ? (
          <div className="py-6 text-center">
            <div className="text-green-600 mb-4">
              <svg
                className="w-16 h-16 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-lg font-medium mb-2">{submitResult.message}</p>
            {submitResult.prUrl && (
              <a
                href={submitResult.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800"
              >
                View Pull Request <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <DialogFooter className="mt-6">
              <Button onClick={() => handleOpenChange(false)}>Close</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Feature Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., beta barrel"
                  maxLength={50}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this feature activates on. Markdown is supported."
                  className="min-h-[100px]"
                  maxLength={2000}
                />
                <p className="text-xs text-muted-foreground">Markdown supported</p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="group">Group Category *</Label>
                <Select value={group} onValueChange={setGroup}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {GROUP_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {group === "other" && (
                <div className="grid gap-2">
                  <Label htmlFor="customGroup">Custom Group Name *</Label>
                  <Input
                    id="customGroup"
                    value={customGroup}
                    onChange={(e) => setCustomGroup(e.target.value)}
                    placeholder="Enter custom group name"
                    maxLength={30}
                  />
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="contributorName">Your Name *</Label>
                <Input
                  id="contributorName"
                  value={contributorName}
                  onChange={(e) => setContributorName(e.target.value)}
                  placeholder="How you'd like to be credited"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="contributorLink">Your Profile Link (optional)</Label>
                <Input
                  id="contributorLink"
                  type="url"
                  value={contributorLink}
                  onChange={(e) => setContributorLink(e.target.value)}
                  placeholder="https://twitter.com/yourhandle"
                />
              </div>

              {submitResult && !submitResult.success && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                  {submitResult.message}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!isFormValid || isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating PR...
                  </>
                ) : (
                  "Submit"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
