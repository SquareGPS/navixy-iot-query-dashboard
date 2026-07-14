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
      // Top offset tracks --app-header-offset (our AppHeader height on routes
      // that render it, 0 on header-less routes like /login) + a 16px gap, so
      // toasts clear the header's top-right controls on app routes without
      // leaving a floating gap on /login. Sonner passes string offsets through
      // verbatim into `top: var(--offset-top)`, so a calc() works here. Right
      // edge keeps Sonner's default (32px desktop / 16px mobile).
      offset={{ top: "calc(var(--app-header-offset) + 16px)", right: 32 }}
      mobileOffset={{ top: "calc(var(--app-header-offset) + 16px)", right: 16 }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          // Errors keep the strong destructive treatment that Radix's old
          // `variant: destructive` toast had, so a failure never reads like a
          // success on the shared neutral surface (DO-327). `!` overrides the
          // neutral base above; the arbitrary variant repaints the description
          // text for contrast on the red background. Success/info stay neutral.
          error:
            "group-[.toaster]:!bg-destructive group-[.toaster]:!text-destructive-foreground group-[.toaster]:!border-destructive [&_[data-description]]:!text-destructive-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
