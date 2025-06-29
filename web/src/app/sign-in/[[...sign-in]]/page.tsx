import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="w-screen h-[100vh - 4rem] grid justify-center">
      <SignIn />
    </div>
  );
}
