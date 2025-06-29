"use client"; // This marks it as a Client Component

import { FormEvent } from "react";

interface ClientChatComponentProps {
  initialToken: string | null; // Pass the token as a prop
  userId: string;
  sessionId: string;
}

export default function ClientChatComponent({
  initialToken,
  userId,
  sessionId,
}: ClientChatComponentProps) {
  async function handleSubmit(event: FormEvent) {
    event.preventDefault(); // Don't forget this!

    const form = event.target as HTMLFormElement;
    const chatInput = form.elements.namedItem("chat") as HTMLInputElement;

    const message = chatInput.value;
    await fetch(`/api/chat`, {
      // Corrected fetch path to a dedicated API route
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: initialToken,
        message: message,
        userId,
        sessionId,
      }), // Use the passed token
    });
    chatInput.value = "";
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="absolute w-screen bottom-0 left-0 flex justify-center items-center gap-4 px-4 py-2">
        <div className="flex-row"></div>
        <input type="text" name="chat" id="" />
        <button type="submit">send {sessionId}</button>
      </div>
    </form>
  );
}
