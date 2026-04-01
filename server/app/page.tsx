"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";

const FormSchema = z.object({
  code: z.string().min(4).max(4),
});

export default function InputOTPForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      code: "",
    },
  });

  function onSubmit(data: z.infer<typeof FormSchema>) {
    setIsLoading(true);
    router.push(`/answer?code=${data.code}`);
  }

  return (
    <div className="w-full h-screen flex flex-col justify-center items-center gap-6">
      <div className="flex w-full justify-center">
        <img src={"/icon-cocode-3.svg"} className="w-30" />
      </div>
      <div className="space-y-6 border-zinc-100 bg-white border p-4 rounded-lg flex-col justify-center items-center shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
        <p className="text-xl font-bold text-center mb-2 text-slate-800">
          Join a Session
        </p>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem className="flex flex-col justify-center items-center w-full">
                  <FormControl>
                    <InputOTP
                      autoFocus
                      maxLength={4}
                      pattern={REGEXP_ONLY_DIGITS}
                      {...field}
                    >
                      <InputOTPGroup className="*:data-[slot=input-otp-slot]:h-16 *:data-[slot=input-otp-slot]:w-16 *:data-[slot=input-otp-slot]:text-2xl">
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                      </InputOTPGroup>
                    </InputOTP>
                  </FormControl>
                  <FormDescription>Enter the code to join</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="flex justify-center w-full mt-4 bg-slate-800 hover:bg-slate-700 rounded-full"
              disabled={isLoading}
            >
              {isLoading ? <Spinner /> : "Join"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
