"use server";

import { retrieveRelevantCalls, summarizeCallsForPrompt } from "@/lib/data/ask";
import { answerQuestionAboutCalls } from "@/services/anthropic";

export async function askQuestionAction(question: string) {
  const calls = await retrieveRelevantCalls(question);
  const contextBlock = summarizeCallsForPrompt(calls);
  const answer = await answerQuestionAboutCalls({ question, contextBlock });
  return { answer, callsUsed: calls.map((c) => ({ id: c.id, name: `${c.contact?.firstname} ${c.contact?.lastname}` })) };
}
