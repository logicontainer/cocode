import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Menubar({ code, hasChanges, onSubmit, onReset }: { code: number, hasChanges: boolean, onSubmit: () => void, onReset: () => void }) {
  const router = useRouter();

  const handleLeave = () => {
    router.push("/");
  };

  return (
    <div className="sticky top-2 z-50 flex w-full justify-center px-4">
      <div className="w-full max-w-4xl flex items-center justify-between px-5 py-3 bg-white/90 backdrop-blur-md border border-gray-200 rounded-full shadow-sm">
        <Link href="/" className="group flex items-center justify-center gap-2 cursor-pointer">
          <img src={"/icon-cocode-3.svg"} className="w-20" />
        </Link>
        <div className="flex items-center gap-2">

          <Button
            variant="ghost"
            className="text-gray-500 hover:text-gray-900 cursor-pointer"
            onClick={handleLeave}
          >
            Leave session {code}
          </Button>

          <Button
            variant="outline"
            className="text-gray-500 hover:text-gray-900 cursor-pointer"
            onClick={onReset}
            disabled={!hasChanges}
          >
            Reset changes
          </Button>
          <Button
            variant="default" // Emphasize the primary action
            className="rounded-full shadow-sm px-6 cursor-pointer bg-slate-800"
            onClick={onSubmit}
            disabled={!hasChanges}
          >
            Submit
          </Button>
        </div>

      </div>
    </div>
  );
}
