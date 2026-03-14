"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { useRouter } from "next/navigation"

const FormSchema = z.object({
  code: z.string().min(4).max(4),
})

export default function InputOTPForm() {
  const router = useRouter();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      code: "",
    },
  })

  function onSubmit(data: z.infer<typeof FormSchema>) {
    router.push(`/answer?code=${data.code}`);
  }

  return (
    <div className="w-full h-screen flex justify-center items-center">
      <div className="space-y-6 border-gray-200 bg-white border p-4 rounded-lg flex-col justify-center items-center shadow-md">
        <p className="text-lg text-center">Join a Session</p>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem className="flex flex-col justify-center items-center w-full">
                  <FormControl>
                    {/* 4. Connect the InputOTP component to the form field */}
                    <InputOTP autoFocus maxLength={4} {...field}>
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                      </InputOTPGroup>
                    </InputOTP>
                  </FormControl>
                  <FormDescription>
                    Please enter the code from the presenter
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="flex justify-center w-full mt-4 cursor-pointer">Submit</Button>
          </form>
        </Form>
      </div>
    </div>

  )
}
