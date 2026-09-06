import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createManualCallAction } from "./actions";

export default async function NewManualCallPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Manual Call Entry</h1>
        <p className="text-sm text-muted">
          Use this when a call didn&apos;t sync automatically from Quo, or to analyze a transcript directly.
        </p>
      </div>

      {error && <div className="rounded-lg border border-bad/30 bg-bad/5 p-3 text-sm text-bad">{decodeURIComponent(error)}</div>}

      <Card className="p-6">
        <form action={createManualCallAction} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Contact first name</Label>
              <Input name="contactFirstName" required />
            </div>
            <div>
              <Label>Contact last name</Label>
              <Input name="contactLastName" required />
            </div>
            <div>
              <Label>Email</Label>
              <Input name="contactEmail" type="email" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input name="contactPhone" type="tel" />
            </div>
          </div>

          <div>
            <Label>Call type</Label>
            <Select name="callType" defaultValue="Proposal Planning">
              <option>Proposal Planning</option>
              <option>Gender Reveal</option>
              <option>Location Consultation</option>
              <option>Package Consultation</option>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Label>Deal / opportunity name (optional)</Label>
              <Input name="dealName" placeholder="e.g. Reyes — Central Park Proposal" />
            </div>
            <div>
              <Label>Deal amount</Label>
              <Input name="dealAmount" type="number" min="0" />
            </div>
            <div>
              <Label>Deal stage</Label>
              <Input name="dealStage" placeholder="e.g. Discovery Call" />
            </div>
            <div>
              <Label>Deal status</Label>
              <Select name="dealStatus" defaultValue="open">
                <option value="open">Open</option>
                <option value="closed_won">Closed Won</option>
                <option value="closed_lost">Closed Lost</option>
              </Select>
            </div>
          </div>

          <div>
            <Label>Transcript</Label>
            <Textarea
              name="transcriptText"
              required
              rows={12}
              placeholder={"Federico: Hi, thanks for calling...\nClient: Hi, we're looking into..."}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="submit" variant="secondary">
              Run analysis
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
