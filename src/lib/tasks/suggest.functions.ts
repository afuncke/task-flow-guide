import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

/**
 * The clarify assistant, backed by a real model through Lovable AI.
 * It only *proposes* settings — the panel stays fully editable, and if the
 * call fails the caller keeps its local heuristic suggestion.
 */

const Input = z.object({
  title: z.string(),
  notes: z.string().optional(),
  today: z.string(),
  state: z.object({
    location: z.string(),
    energy: z.string(),
    duration: z.string(),
    workWindow: z.string(),
  }),
  areas: z.array(z.object({ id: z.string(), name: z.string() })),
  knownTags: z.array(z.string()),
  projects: z.array(z.object({ id: z.string(), title: z.string() })),
});

const Result = z.object({
  kind: z.string(),
  title: z.string(),
  tags: z.array(z.string()),
  priority: z.string(),
  due: z.string(),
  minutes: z.number(),
  location: z.string(),
  energy: z.string(),
  workWindow: z.string(),
  areaId: z.string(),
  projectId: z.string(),
  waitingOn: z.string(),
  firstAction: z.string(),
  confidence: z.number(),
  headline: z.string(),
  reasons: z.array(z.string()),
});

export type AiSuggestion = z.infer<typeof Result>;

export const suggestWithAssistant = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<AiSuggestion | null> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return null;

    const gateway = createLovableAiGatewayProvider(key);

    const system = [
      "You help someone clarify a raw captured thought into a single task in a calm, GTD-style planner.",
      "Propose every setting at once. Be warm and non-judgemental; never shame the user for backlog or overdue work.",
      "Rules for the fields you return:",
      `- kind: one of "do-now" (under ~2 minutes), "next" (one concrete step), "project" (multiple steps), "waiting" (someone else's court), "someday" (a maybe).`,
      `- title: a short, concrete rewrite of the capture, starting with a verb where natural.`,
      `- tags: at most 3 lowercase tags; strongly prefer tags the user already uses.`,
      `- priority: "H", "M", "L", or "" for none.`,
      `- due: YYYY-MM-DD if the text implies a date, otherwise "". Resolve relative dates against today.`,
      `- minutes: a realistic estimate (10, 15, 30, 45, 60 or 90).`,
      `- location: "anywhere" | "home" | "office" | "errands".`,
      `- energy: "low" | "medium" | "high".`,
      `- workWindow: "any" | "work" | "personal".`,
      `- areaId: one of the given area ids, or "".`,
      `- projectId: one of the given project ids if this is clearly part of it, else "".`,
      `- waitingOn: who/what is blocking, only when kind is "waiting", else "".`,
      `- firstAction: the very first small step, only when kind is "project", else "".`,
      `- confidence: 0 to 1.`,
      `- headline: one short sentence framing the suggestion.`,
      `- reasons: 2-4 short plain-language reasons.`,
    ].join("\n");

    const prompt = [
      `Today is ${data.today}.`,
      `Captured text: ${JSON.stringify(data.title)}`,
      data.notes ? `Notes: ${JSON.stringify(data.notes)}` : "",
      `Their current state: ${JSON.stringify(data.state)}`,
      `Their areas of responsibility: ${JSON.stringify(data.areas)}`,
      `Tags they already use: ${JSON.stringify(data.knownTags)}`,
      `Open projects: ${JSON.stringify(data.projects)}`,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const { output } = await generateText({
        model: gateway("google/gemini-3.6-flash"),
        system,
        prompt,
        output: Output.object({ schema: Result }),
      });
      return output;
    } catch (error) {
      console.error("clarify assistant failed", error);
      return null;
    }
  });
