"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import * as z from "zod"
import { Bug } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
    InputGroup,
    InputGroupAddon,
    InputGroupText,
    InputGroupTextarea,
} from "@/components/ui/input-group"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

const formSchema = z.object({
    title: z
        .string()
        .min(5, "Bug title must be at least 5 characters.")
        .max(32, "Bug title must be at most 32 characters."),
    description: z
        .string()
        .min(20, "Description must be at least 20 characters.")
        .max(100, "Description must be at most 100 characters."),
})

export function BugReportButton() {
    const [open, setOpen] = React.useState(false)

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: "",
            description: "",
        },
    })

    function onSubmit(data: z.infer<typeof formSchema>) {
        toast.success("Bug report submitted!", {
            description: "Thank you for helping us improve Minerva.",
            position: "bottom-right",
        })
        console.log("Bug report:", data)
        form.reset()
        setOpen(false)
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    size="icon"
                    className="fixed bottom-6 left-6 h-12 w-12 rounded-2xl z-50"
                    variant="outline"
                >
                    <Bug className="h-5 w-5" />
                    <span className="sr-only">Report a bug</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent
                side="top"
                align="start"
                className="w-[380px] p-0 rounded-xl"
                sideOffset={12}
            >
                <Card className="border-0 shadow-none">
                    <CardHeader>
                        <CardTitle className="text-base">Bug Report</CardTitle>
                        <CardDescription>
                            Help us improve by reporting bugs you encounter.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form id="bug-report-form" onSubmit={form.handleSubmit(onSubmit)}>
                            <FieldGroup>
                                <Controller
                                    name="title"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor="bug-report-title">
                                                Bug Title
                                            </FieldLabel>
                                            <Input
                                                {...field}
                                                id="bug-report-title"
                                                aria-invalid={fieldState.invalid}
                                                placeholder="Login button not working"
                                                autoComplete="off"
                                            />
                                            {fieldState.invalid && (
                                                <FieldError errors={[fieldState.error]} />
                                            )}
                                        </Field>
                                    )}
                                />
                                <Controller
                                    name="description"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor="bug-report-description">
                                                Description
                                            </FieldLabel>
                                            <InputGroup>
                                                <InputGroupTextarea
                                                    {...field}
                                                    id="bug-report-description"
                                                    placeholder="Describe what happened..."
                                                    rows={4}
                                                    className="min-h-20 resize-none"
                                                    aria-invalid={fieldState.invalid}
                                                />
                                                <InputGroupAddon align="block-end">
                                                    <InputGroupText className="tabular-nums">
                                                        {field.value.length}/100
                                                    </InputGroupText>
                                                </InputGroupAddon>
                                            </InputGroup>
                                            <FieldDescription>
                                                Steps to reproduce, expected vs actual behavior.
                                            </FieldDescription>
                                            {fieldState.invalid && (
                                                <FieldError errors={[fieldState.error]} />
                                            )}
                                        </Field>
                                    )}
                                />
                            </FieldGroup>
                        </form>
                    </CardContent>
                    <CardFooter className="pt-0 gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                form.reset()
                                setOpen(false)
                            }}
                        >
                            Reset
                        </Button>
                        <Button type="submit" form="bug-report-form">
                            Submit
                        </Button>
                    </CardFooter>
                </Card>
            </PopoverContent>
        </Popover>
    )
}
