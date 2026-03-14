import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Menubar({ onSubmit }: { onSubmit: () => void }) {
  const router = useRouter();

  const handleLeave = () => {
    router.push("/");
  };

  return (
    <div className="sticky top-2 z-50 flex w-full justify-center px-4">
      <div className="w-full max-w-4xl flex items-center justify-between px-5 py-3 bg-white/90 backdrop-blur-md border border-gray-200 rounded-full shadow-sm">
        <Link href="/" className="group">
          <h1 className="text-lg font-semibold tracking-tight text-gray-900 transition-colors group-hover:text-gray-600">
            CoCode <span className="font-normal text-gray-400">@ AUHack</span>
          </h1>
        </Link>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            className="text-gray-500 hover:text-gray-900 cursor-pointer"
            onClick={handleLeave}
          >
            Leave
          </Button>
          <Button
            variant="default" // Emphasize the primary action
            className="rounded-full shadow-sm px-6 cursor-pointer"
            onClick={onSubmit}
          >
            Submit
          </Button>
        </div>

      </div>
    </div>
  );
}
