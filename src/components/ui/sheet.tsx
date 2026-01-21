import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface SheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    children: React.ReactNode
}

const Sheet = ({ open, onOpenChange, children }: SheetProps) => {
    if (!open) return null
    return (
        <div className="fixed inset-0 z-[100] flex justify-end">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={() => onOpenChange(false)}
            />
            {/* Sidebar */}
            <div className="relative z-[101] w-full max-w-md h-full bg-[#0F172A] border-l border-white/10 shadow-2xl animate-in slide-in-from-right duration-300">
                {children}
            </div>
        </div>
    )
}

const SheetContent = ({ className, children }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn("flex flex-col h-full p-6", className)}>
        {children}
    </div>
)

const SheetHeader = ({ className, children }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn("flex flex-col space-y-2 text-center sm:text-left mb-6", className)}>
        {children}
    </div>
)

const SheetFooter = ({ className, children }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-auto pt-6", className)}>
        {children}
    </div>
)

const SheetTitle = React.forwardRef<
    HTMLHeadingElement,
    React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
    <h3
        ref={ref}
        className={cn("text-lg font-semibold text-white", className)}
        {...props}
    />
))
SheetTitle.displayName = "SheetTitle"

const SheetDescription = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
    <p
        ref={ref}
        className={cn("text-sm text-gray-400", className)}
        {...props}
    />
))
SheetDescription.displayName = "SheetDescription"

const SheetClose = ({ onClick, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button
        onClick={onClick}
        className={cn(
            "absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary",
            className
        )}
        {...props}
    >
        <X className="h-6 w-6 text-gray-400 hover:text-white" />
        <span className="sr-only">Close</span>
    </button>
)

export { Sheet, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription, SheetClose }
