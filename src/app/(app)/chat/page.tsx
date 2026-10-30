import { requireProfile } from "@/lib/session";
import { ChatPanel } from "./chat-panel";

export default async function ChatPage() {
  await requireProfile();
  return <ChatPanel />;
}
