import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      // Top-right so toasts clear the host platform's AI Assistant button,
      // overlaid at the bottom-right of our iframe (DO-308). Matches the Radix
      // toaster's position for a consistent placement across both systems.
      position="top-right"
      // Push below our own fixed AppHeader (h-[56px]) so a visible toast never
      // covers the header's top-right controls; right edge keeps Sonner's default
      // (32px desktop / 16px mobile).
      offset={{ top: 72, right: 32 }}
      mobileOffset={{ top: 72, right: 16 }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
