// This file is a Server Component by default in the App Router
import { auth, currentUser } from "@clerk/nextjs/server";
import ClientChatComponent from "@/components/client-chat-component"; // Import your new Client Component

export default async function Page() {
  // Get the userId from auth() -- if null, the user is not signed in
  const { userId, getToken, sessionId } = await auth();

  // Protect the route by checking if the user is signed in
  if (!userId) {
    return <div>Sign in to view this page</div>;
  }

  // Get the Backend API User object when you need access to the user's information
  const user = await currentUser();
  const token = await getToken();

  // Pass necessary props to the Client Component
  return (
    <div>
      Welcome, {user?.firstName}!
      <ClientChatComponent
        userId={userId}
        sessionId={sessionId}
        initialToken={token}
      />
    </div>
  );
}
