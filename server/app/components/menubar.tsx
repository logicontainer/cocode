import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Spinner } from "@/components/ui/spinner";

export default function Menubar({
  code,
  hasChanges,
  submitting,
  canSubmit,
  onSubmit,
  onReset,
}: {
  code: number;
  hasChanges: boolean;
  submitting: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
  onReset: () => void;
}) {
  const router = useRouter();

  const handleLeave = () => {
    router.push("/");
  };

  return (
    <div className="z-50 flex w-full justify-stretch">
      <div className="w-full flex items-center justify-between px-2 md:px-4 py-3 bg-white/90 backdrop-blur-md border border-zinc-100 rounded-md md:rounded-3xl shadow-sm">
        <Link
          href="/"
          className="group flex items-center justify-center gap-2 cursor-pointer"
        >
          <img src={"/icon-cocode-3.svg"} className="w-20" />
        </Link>
        <div className="flex items-center gap-1 md:gap-2">
          <Button
            variant="ghost"
            className="text-gray-500 hover:text-gray-900 cursor-pointer rounded-md md:rounded-full"
            onClick={handleLeave}
          >
            <p className="hidden md:block">Leave session {code}</p>
            <p className="block md:hidden">Leave {code}</p>
          </Button>

          <Button
            variant="outline"
            className="text-gray-500 hover:text-gray-900 cursor-pointer rounded-md md:rounded-full"
            onClick={onReset}
            disabled={!hasChanges}
          >
            <p className="hidden md:block">Reset changes</p>
            <p className="block md:hidden">Reset</p>
          </Button>
          <Button
            variant="default" // Emphasize the primary action
            className="rounded-md md:rounded-full shadow-sm px-6 cursor-pointer bg-slate-800 hover:bg-slate-700"
            onClick={onSubmit}
            disabled={!canSubmit}
          >
            {submitting ? <Spinner /> : "Submit"}
          </Button>
        </div>
      </div>
    </div>
  );
}
