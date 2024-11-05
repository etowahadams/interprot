import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export default function CustomSequenceSearchPage() {
  const [sequence, setSequence] = useState("");

  const handleSearch = async () => {
    console.log(sequence);
    try {
      const response = await fetch("https://api.runpod.ai/v2/yk9ehzl3h653vj/runsync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_RUNPOD_API_KEY}`,
        },
        body: JSON.stringify({
          input: {
            sequence: sequence,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const resp = await response.json();
      const data = resp.output.data;
      if (data.tokens_acts_list) {
        return data.tokens_acts_list;
      } else {
        console.error("Unexpected data format:", data);
      }
    } catch (error) {
      console.error("Error fetching activation data:", error);
    }
  };

  return (
    <>
      <main className="flex items-center justify-center min-h-screen p-4 w-full">
        <div className="w-full max-w-xl">
          <h1 className="text-4xl font text-center mb-8">Search against all features</h1>
          <div className="flex flex-col gap-4">
            <Textarea
              placeholder="Enter protein sequence..."
              value={sequence}
              onChange={(e) => setSequence(e.target.value)}
              className="w-full min-h-[120px] font-mono"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSearch();
                }
              }}
            />
            <div className="flex justify-center">
              <Button className="w-full" onClick={handleSearch}>
                Search
              </Button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
